import { useState } from 'react';
import { Check, Link2, Link2Off, Loader2, Send } from '../../ui/icons.js';
import { StatusStrip } from '../../ui/States.jsx';
import { ENV } from '../../lib/env.js';
import { describeError } from '../../lib/api.js';

/**
 * Привязка Telegram к аккаунту.
 *
 * Смысл карточки — снять развилку, в которой пользователь заводит второй
 * аккаунт, сам того не заметив. У человека, зарегистрировавшегося по email,
 * первый заход в Mini App иначе создаёт отдельный профиль с пустой историей,
 * и объяснить это постфактум уже нечем.
 *
 * Привязать можно только изнутри Telegram: подпись initData выдаёт клиент
 * Telegram, а в обычном браузере её взять неоткуда.
 */
export function TelegramLinkCard({ user, links, inTelegram, onLink, onUnlink, toast }) {
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  const linked = Boolean(links?.telegram?.linked);
  const unavailable = Boolean(links?.unavailable);
  // Аккаунт заведён самим Telegram: настоящей почты у него нет.
  const telegramOnly = !user?.email;

  const run = async (kind, action, successText) => {
    setBusy(kind);
    setNotice(null);
    try {
      const result = await action();
      if (toast?.success) toast.success(successText); else setNotice(successText);
      if (result?.orphanReplaced) {
        setNotice('Прежний телеграмный профиль остался отдельно — история из него не переносится.');
      }
    } catch (error) {
      const { text } = describeError(error);
      setNotice(text);
      toast?.error?.(text);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="section">
      <h2 className="section__title">Вход через Telegram</h2>

      <div className="member">
        <Send size={20} color={linked ? 'var(--coral)' : 'var(--text-mid)'} />
        <span className="stack grow" style={{ minWidth: 0 }}>
          <span className="member__name">
            {linked ? 'Telegram привязан' : 'Telegram не привязан'}
          </span>
          <span className="member__state">
            {linked
              ? 'Открывая Mini App, вы попадаете в этот же аккаунт.'
              : 'Без привязки Mini App заведёт отдельный профиль с пустой историей.'}
          </span>
        </span>
        {linked && <Check size={20} color="var(--coral)" />}
      </div>

      {unavailable && (
        <StatusStrip tone="warn">
          Привязка выключена: на сервере не задан SUPABASE_SERVICE_ROLE_KEY.
        </StatusStrip>
      )}

      {!unavailable && !linked && inTelegram && (
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy === 'link'}
          onClick={() => run('link', onLink, 'Telegram привязан к аккаунту.')}
        >
          {busy === 'link'
            ? <><Loader2 size={16} className="spin" /> Привязываем…</>
            : <><Link2 size={16} /> Привязать этот Telegram</>}
        </button>
      )}

      {!unavailable && !linked && !inTelegram && (
        <p className="faint" style={{ fontSize: 'var(--t-small)' }}>
          Привязка делается изнутри Telegram: откройте MatchWatch
          {ENV.telegramBot ? ` в @${ENV.telegramBot}` : ' в боте'} и нажмите
          «Привязать этот Telegram» здесь же, в профиле.
        </p>
      )}

      {!unavailable && linked && telegramOnly && (
        <p className="faint" style={{ fontSize: 'var(--t-small)' }}>
          Это телеграмный аккаунт: email у него нет. Чтобы объединить его
          с аккаунтом по email, выйдите, войдите по email и привяжите Telegram
          оттуда — история email-аккаунта сохранится.
        </p>
      )}

      {!unavailable && linked && links?.canUnlinkTelegram && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={busy === 'unlink'}
          onClick={() => run('unlink', onUnlink, 'Telegram отвязан.')}
        >
          {busy === 'unlink'
            ? <><Loader2 size={16} className="spin" /> Отвязываем…</>
            : <><Link2Off size={16} /> Отвязать</>}
        </button>
      )}

      {notice && <p className="faint" style={{ fontSize: 'var(--t-small)' }}>{notice}</p>}
    </section>
  );
}
