import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Copy, DoorOpen, LogIn, Plus, Share2, UserPlus, Users } from '../../ui/icons.js';
import { EmptyState } from '../../ui/States.jsx';
import { loadRecentRooms } from '../../engine/userData.js';
import { normalizeRoomCode, ROOM_CODE_LENGTH } from '../../../shared/model/roomCode.js';
import { JOIN_SOURCE } from '../../engine/rooms.js';
import { roomInviteLink, shareToTelegram, haptic } from '../../lib/telegram.js';
import { trackMetric } from '../../lib/telemetry.js';
import { METRIC } from '../../../shared/telemetry/events.js';
import { sfx } from '../../lib/sound.js';
import { requestFriend } from '../../engine/social.js';
import { withPlural, FORMS } from '../../../shared/i18n/plural.js';

/**
 * Комнаты и друзья.
 *
 * Один источник кодов на всё: ручной ввод, ссылка, deep-link и список
 * недавних проходят через normalizeRoomCode. Разъехавшийся формат —
 * главная причина, по которой комнаты «не находятся», и здесь он
 * технически невозможен.
 */
export function RoomsView({ room, user, onCreate, onEnterRoom, onOpenMember, toasts }) {
  const [friendBusy, setFriendBusy] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState([]);

  // Список недавних комнат склеивается из локальной копии и членства в базе:
  // на новом устройстве он не окажется пустым.
  const refreshRecent = useCallback(() => {
    loadRecentRooms(user?.uid).then(setRecent).catch(() => setRecent([]));
  }, [user?.uid]);

  useEffect(refreshRecent, [refreshRecent, room.code]);

  const normalized = normalizeRoomCode(input);
  const inputTooShort = input.replace(/[^A-Za-z0-9]/g, '').length < ROOM_CODE_LENGTH;

  const handleJoin = async (code, source) => {
    setBusy(true);
    try {
      await room.join(code, source);
      onEnterRoom?.();
      setInput('');
    } catch (error) {
      toasts.error(error?.message ?? 'Не удалось войти в комнату');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      await onCreate();
      onEnterRoom?.();
    } catch (error) {
      toasts.error(error?.message ?? 'Не удалось создать комнату');
    } finally {
      setBusy(false);
    }
  };

  if (room.code && room.state) {
    return <RoomLobby room={room} user={user} toasts={toasts} onEnterRoom={onEnterRoom} />;
  }

  return (
    <div className="view">
      <header className="view__head">
        <h1 className="view__title">Смотрим вместе</h1>
        <p className="view__sub">
          Создайте комнату и отправьте код другу. Свайпаете одновременно —
          при обоюдном «да» приходит мэтч.
        </p>
      </header>

      <button
        type="button"
        className="btn btn--primary btn--lg btn--block"
        onClick={handleCreate}
        disabled={busy}
      >
        <Plus size={20} /> Создать комнату
      </button>

      <div className="auth__divider">или войти по коду</div>

      <form
        className="section"
        onSubmit={(e) => { e.preventDefault(); if (normalized) handleJoin(normalized, JOIN_SOURCE.MANUAL); }}
      >
        <input
          className="code-input"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase().slice(0, 8))}
          placeholder="––––"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
          aria-label="Код комнаты"
          aria-invalid={Boolean(input) && !normalized && !inputTooShort}
        />

        {Boolean(input) && !normalized && !inputTooShort && (
          <p className="row gap-2" style={{ color: 'var(--coral)', fontSize: 'var(--t-small)' }}>
            <AlertCircle size={16} /> Код состоит из 4 символов — букв и цифр.
          </p>
        )}

        <button
          type="submit"
          className="btn btn--ghost btn--lg btn--block"
          disabled={!normalized || busy}
        >
          <LogIn size={20} /> Войти в комнату {normalized ?? ''}
        </button>
      </form>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Недавние комнаты</h2>
          {recent.length > 0 && <span className="faint" style={{ fontSize: 'var(--t-small)' }}>{recent.length}</span>}
        </div>

        {recent.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Пока пусто"
            text="Комнаты, в которых вы были, появятся здесь — чтобы вернуться в один тап."
          />
        ) : (
          <div className="room-list">
            {recent.map((entry) => {
              // Завершённая комната не притворяется живой: нажатие на неё
              // упёрлось бы в отказ, а причина осталась бы непонятной.
              const done = entry.status === 'closed' || entry.status === 'expired';
              return (
                <button
                  key={entry.code}
                  type="button"
                  className="room-row"
                  data-done={String(done)}
                  onClick={() => handleJoin(entry.code, JOIN_SOURCE.RECENT)}
                  disabled={busy || done}
                >
                  <span className="room-row__code">{entry.code}</span>
                  <span className="stack grow">
                    <span style={{ fontSize: 'var(--t-small)' }}>
                      {entry.role === 'host' ? 'Вы создали' : 'Вы заходили'}
                    </span>
                    <span className="faint" style={{ fontSize: 'var(--t-micro)' }}>
                      {formatAgo(entry.at)}
                    </span>
                  </span>
                  {done
                    ? <span className="chip">{entry.status === 'closed' ? 'завершена' : 'истекла'}</span>
                    : <DoorOpen size={20} color="var(--text-low)" />}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/** Лобби активной комнаты: код, участники, приглашение, старт сессии. */
function RoomLobby({ room, user, toasts, onEnterRoom }) {
  const invite = roomInviteLink(room.code);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const share = () => {
    room.trackInvite();
    haptic('light');
    if (shareToTelegram({ url: invite, text: `Заходи в комнату ${room.code} — выберем кино вместе 🍿` })) return;
    navigator.share?.({ title: 'MatchWatch', text: `Код комнаты: ${room.code}`, url: invite })
      ?.catch(() => copy());
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      trackMetric(METRIC.ROOM_INVITE_SENT, { room: room.code });
      sfx.tick();
    } catch {
      toasts.error('Не удалось скопировать. Продиктуйте код: ' + room.code);
    }
  };

  /*
   * Заявка в друзья прямо из комнаты. Момент, когда с человеком уже
   * смотрят кино, — единственный, когда добавление в друзья не требует
   * объяснений; в списке поиска его потом надо ещё найти по нику.
   */
  const addFriend = async (member) => {
    setFriendBusy(member.uid);
    try {
      const status = await requestFriend(member.uid);
      toasts.success(status === 'accepted'
        ? `${member.name} теперь в друзьях`
        : `Заявка отправлена ${member.name}`);
    } catch (error) {
      toasts.error(error?.message ?? 'Не получилось добавить в друзья');
    } finally {
      setFriendBusy(null);
    }
  };

  const waiting = room.members.length < 2;

  return (
    <div className="view">
      <header className="view__head">
        <h1 className="view__title">Комната готова</h1>
        <p className="view__sub">Отправьте код — и начинайте свайпать одновременно.</p>
      </header>

      <div className="room-hero">
        <span className="eyebrow" style={{ textAlign: 'center' }}>Код комнаты</span>
        <div className="room-code" aria-label={`Код комнаты ${room.code.split('').join(' ')}`}>
          {room.code}
        </div>

        <div className="row gap-3">
          <button type="button" className="btn btn--primary grow" onClick={share}>
            <Share2 size={16} /> Пригласить
          </button>
          <button type="button" className="btn btn--ghost" onClick={copy}>
            <Copy size={16} /> {copied ? 'Скопировано' : 'Ссылка'}
          </button>
        </div>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Участники</h2>
          <span className={`badge ${room.onlineCount > 1 ? 'badge--live' : ''}`}>
            {room.onlineCount} в сети
          </span>
        </div>

        <div className="room-members">
          {room.members.map((member) => {
            const isMe = member.uid === user.uid;
            return (
              <div className="member" key={member.uid}>
                {/* Тап по человеку открывает его профиль: смотреть кино
                    с незнакомцем странно, а узнать вкус — половина смысла. */}
                <button
                  type="button"
                  className="member__link"
                  onClick={() => !isMe && onOpenMember?.(member)}
                  disabled={isMe}
                  aria-label={isMe ? member.name : `Профиль: ${member.name}`}
                >
                  {member.photo
                    ? <img className="member__avatar" src={member.photo} alt="" />
                    : <div className="member__avatar" />}
                  <span className="stack grow">
                    <span className="member__name">
                      {member.name}{isMe ? ' (вы)' : ''}
                    </span>
                    <span className="member__state">
                      {member.online ? 'в сети, свайпает' : `не в сети · ${formatAgo(member.lastSeen)}`}
                    </span>
                  </span>
                </button>
                {member.host && <span className="chip chip--gold">хост</span>}
                {!isMe && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--sm"
                    disabled={friendBusy === member.uid}
                    onClick={() => addFriend(member)}
                    aria-label={`Добавить ${member.name} в друзья`}
                    title="Добавить в друзья"
                  >
                    <UserPlus size={16} />
                  </button>
                )}
                <span className="member__presence" data-online={String(Boolean(member.online))} />
              </div>
            );
          })}
        </div>

        {waiting && (
          <p className="status-strip">
            Ждём второго участника. Свайпать можно уже сейчас — мэтчи появятся,
            как только друг зайдёт.
          </p>
        )}
      </section>

      <div className="row gap-3">
        <button type="button" className="btn btn--primary btn--lg grow" onClick={onEnterRoom}>
          Начать свайпать
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => room.leave()}>
          Выйти
        </button>
      </div>

      {room.isHost && (
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          onClick={() => {
            // Действие необратимо и задевает не только хоста — спрашиваем.
            if (!window.confirm('Завершить комнату для всех? Вернуться в неё будет нельзя, '
              + 'но мэтчи уже лежат в вашем «Буду смотреть».')) return;
            room.close();
            toasts.success('Комната завершена');
          }}
        >
          <DoorOpen size={16} /> Завершить комнату для всех
        </button>
      )}
    </div>
  );
}

function formatAgo(timestamp) {
  const ms = typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp;
  if (!ms) return 'давно';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'только что';
  if (diff < 3600_000) return `${withPlural(Math.floor(diff / 60_000), FORMS.MINUTE)} назад`;
  if (diff < 86_400_000) return `${withPlural(Math.floor(diff / 3600_000), FORMS.HOUR)} назад`;
  return `${withPlural(Math.floor(diff / 86_400_000), FORMS.DAY)} назад`;
}

export { formatAgo };
