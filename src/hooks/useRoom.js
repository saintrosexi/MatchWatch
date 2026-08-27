/**
 * Жизненный цикл комнаты на клиенте.
 *
 * Восстановление после сворачивания решается тем, что локального прогресса
 * попросту нет: какие карточки я уже свайпнул — записано в room_swipes
 * на сервере. Приложение вернулось из фона → подписка ожила → прогресс
 * на месте. Терять нечего, потому что нечего было хранить локально.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addToWatchlist, closeRoom, createRoom, joinRoom, kickRoomMember, leaveRoom, markWatched,
  appendDeck, publishDeck, recordSwipe, removeFromWatchlist, setRoomMood, subscribeRoom,
  transferRoomHost, roomNearMatches, RoomError, JOIN_SOURCE,
} from '../engine/rooms.js';
import { buildConsensusProfile } from '../engine/ranking.js';
import { getConfig } from '../engine/recommendationConfig.js';
import { rememberRoom } from '../engine/userData.js';
import { setTelemetryRoom, trackBusiness, trackMetric, breadcrumb } from '../lib/telemetry.js';
import { BIZ, LEVEL, METRIC, MODULE } from '../../shared/telemetry/events.js';
import { haptic } from '../lib/telegram.js';
import { sfx } from '../lib/sound.js';

export function useRoom({ user, taste, anchors }) {
  const [code, setCode] = useState(null);
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | joining | live | error
  const [error, setError] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [presentUids, setPresentUids] = useState([]);

  const seenMatches = useRef(new Set());
  const unsubscribeRef = useRef(null);
  const reconnectedRef = useRef(false);
  /** Номер попытки переподключения — он же ключ перезапуска подписки. */
  const [attempt, setAttempt] = useState(0);

  /*
   * Подписка на состояние комнаты и присутствие участников.
   *
   * `attempt` перезапускает эффект: сам по себе оборвавшийся канал
   * не оживает, и комната молча замирала — партнёр свайпает, а на экране
   * ничего не происходит. Пересоздаём подписку с нарастающей паузой.
   */
  useEffect(() => {
    if (!code || !user?.uid) return undefined;

    setStatus('joining');
    seenMatches.current = new Set();
    let retryTimer = null;

    unsubscribeRef.current = subscribeRoom(code, {
      uid: user.uid,
      onState: (next) => {
        setState(next);
        setStatus('live');
        setError(null);

        if (reconnectedRef.current) {
          reconnectedRef.current = false;
          trackBusiness(BIZ.RECONNECT_RECOVERED, {
            module: MODULE.ROOMS_SYNC, room: code, level: LEVEL.INFO,
            context: { members: Object.keys(next.members ?? {}).length },
          });
        }

        // Празднование показываем ровно один раз на мэтч, в том числе
        // тому участнику, чей свайп был вторым: событие приходит подпиской.
        for (const [titleId, match] of Object.entries(next.matches ?? {})) {
          if (seenMatches.current.has(titleId)) continue;
          seenMatches.current.add(titleId);
          // При первом входе не празднуем то, что случилось до нас.
          if (Date.now() - (match.at ?? 0) > 15_000) continue;
          setCelebration(match);
          haptic('success');
          sfx.match();
        }
      },
      onError: (err) => {
        setError(err);
        setStatus('error');

        // Пауза растёт, но упирается в потолок: комната — живой разговор,
        // и ждать минуту переподключения бессмысленно.
        if (retryTimer) return;
        const delay = Math.min(1000 * 2 ** attempt, 15_000);
        retryTimer = setTimeout(() => {
          reconnectedRef.current = true;
          setAttempt((n) => n + 1);
        }, delay);
      },
      onPresence: setPresentUids,
    });

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [code, user?.uid, attempt]);

  // Успешный кадр состояния снимает счётчик: следующий обрыв начнёт с нуля.
  useEffect(() => {
    if (status === 'live' && attempt !== 0) setAttempt(0);
  }, [status, attempt]);

  /* Возврат из фона: Telegram сворачивают постоянно. */
  useEffect(() => {
    if (!code) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        reconnectedRef.current = true;
        breadcrumb('room: вернулись из фона');
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [code]);

  const create = useCallback(async ({ deck = [], filters = null }) => {
    setError(null);
    setStatus('joining');
    try {
      const newCode = await createRoom({ user, deck, filters, profile: compactTaste(taste, anchors) });
      setCode(newCode);
      rememberRoom({ code: newCode, role: 'host' });
      sfx.join();
      haptic('medium');
      return newCode;
    } catch (e) {
      setError(toRoomError(e));
      setStatus('error');
      throw e;
    }
  }, [user, taste]);

  const join = useCallback(async (rawCode, source = JOIN_SOURCE.MANUAL) => {
    setError(null);
    setStatus('joining');
    try {
      const { code: joined } = await joinRoom(rawCode, { user, source, profile: compactTaste(taste, anchors) });
      setCode(joined);
      rememberRoom({ code: joined, role: 'member' });
      sfx.join();
      haptic('medium');
      return joined;
    } catch (e) {
      const roomError = toRoomError(e);
      setError(roomError);
      setStatus('error');
      sfx.error();
      haptic('error');
      throw roomError;
    }
  }, [user, taste]);

  const leave = useCallback(async () => {
    if (code) await leaveRoom(code);
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setCode(null);
    setState(null);
    setStatus('idle');
    setTelemetryRoom(null);
  }, [code]);

  const close = useCallback(async () => {
    if (!code) return;
    await closeRoom(code);
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setCode(null);
    setState(null);
    setStatus('idle');
  }, [code]);

  const swipe = useCallback(async (title, action) => {
    if (!code) return { matched: false };
    try {
      return await recordSwipe(code, { title, action });
    } catch (e) {
      setError(toRoomError(e));
      return { matched: false };
    }
  }, [code]);

  const setDeck = useCallback(
    (deck) => (code ? publishDeck(code, deck) : Promise.resolve()),
    [code],
  );

  /** Настроение на сегодня: своё меняем, чужие только читаем. */
  const setMood = useCallback(
    (keys, ai = null) => (code ? setRoomMood(code, keys, ai) : Promise.resolve(null)),
    [code],
  );

  /*
   * Почти-совпадения. Обновляются на паузе, а не подпиской: экран
   * ожидания открывают редко, и держать ради него живой запрос
   * ко всей комнате незачем.
   */
  const [nearMatches, setNearMatches] = useState([]);

  const refreshNearMatches = useCallback(async () => {
    if (!code) return;
    try {
      setNearMatches(await roomNearMatches(code));
    } catch {
      // Подсказка — не то, ради чего стоит показывать ошибку.
      setNearMatches([]);
    }
  }, [code]);

  /** Выгнать участника — умеет только хост. */
  const kick = useCallback(
    (uid) => (code ? kickRoomMember(code, uid) : Promise.resolve(null)),
    [code],
  );

  /** Передать хоста другому участнику. */
  const makeHost = useCallback(
    (uid) => (code ? transferRoomHost(code, uid) : Promise.resolve(null)),
    [code],
  );

  /** Дописать порцию в конец общей колоды — умеет любой участник. */
  const growDeck = useCallback(
    (deck, baseSize = null) => (code ? appendDeck(code, deck, baseSize) : Promise.resolve(null)),
    [code],
  );

  /** Компромиссный вектор комнаты — из профилей всех, кто внутри. */
  const consensus = useMemo(
    () => (state ? buildConsensusProfile(Object.values(state.profiles ?? {}), { config: getConfig() }) : null),
    [state],
  );

  /**
   * Присутствие: колонка `online` в базе плюс живой канал.
   * Канал точнее — он снимает участника при обрыве связи, а колонка
   * держится до следующего heartbeat.
   */
  const members = useMemo(() => Object.values(state?.members ?? {}).map((member) => ({
    ...member,
    online: presentUids.includes(member.uid) || member.online,
  })), [state?.members, presentUids]);

  const onlineCount = members.filter((m) => m.online).length;

  /**
   * Кто сколько прошёл из общей колоды.
   *
   * Считается из состояния комнаты, которое и так приходит подпиской:
   * отдельный счётчик в базе тут был бы лишней сущностью, способной
   * разойтись с настоящими голосами.
   */
  const progress = useMemo(() => {
    const deck = state?.deck ?? [];
    const deckIds = new Set(deck.map((t) => t.id ?? t.titleId).filter(Boolean));
    const swipes = state?.swipes ?? {};

    const byUser = {};
    for (const member of Object.values(state?.members ?? {})) byUser[member.uid] = 0;

    for (const [titleId, votes] of Object.entries(swipes)) {
      if (!deckIds.has(titleId)) continue;
      for (const uid of Object.keys(votes ?? {})) {
        if (uid in byUser) byUser[uid] += 1;
      }
    }

    const values = Object.values(byUser);
    return {
      size: deck.length,
      byUser,
      mine: byUser[user?.uid] ?? 0,
      /** Медленнее всех — по нему решается, пора ли растить колоду. */
      slowest: values.length ? Math.min(...values) : 0,
    };
  }, [state?.deck, state?.swipes, state?.members, user?.uid]);

  const mySwipes = useMemo(
    () => Object.entries(state?.swipes ?? {})
      .filter(([, votes]) => votes?.[user?.uid])
      .map(([titleId]) => titleId),
    [state?.swipes, user?.uid],
  );

  return {
    code, state, status, error, celebration, consensus,
    members, onlineCount, progress,
    growDeck, setMood, kick, makeHost,
    nearMatches, refreshNearMatches,
    /**
     * Любимые фильмы ВСЕХ участников, без повторов.
     *
     * Похожее на его любимое и похожее на её любимое попадают в подборку
     * оба — вместо одного компромисса посередине, не похожего ни на что
     * из того, что любит хоть кто-то.
     */
    lovedIds: [...new Set(members.flatMap((m) => m.lovedIds ?? []))],
    /** Запросы всех участников — из них складывается общая колода. */
    moodRequests: members.map((m) => m.mood ?? { keys: [], ai: null }),
    myMood: members.find((m) => m.uid === user?.uid)?.mood ?? { keys: [], ai: null },
    /*
     * Хост — по флагу в составе, а не по создателю: хоста можно передать,
     * и после передачи полномочия обязаны уехать вместе с ним. На старых
     * комнатах, где флаг не проставлен ни у кого, право остаётся у того,
     * кто её завёл.
     */
    isHost: members.some((m) => m.host)
      ? Boolean(members.find((m) => m.uid === user?.uid)?.host)
      : state?.meta?.createdBy === user?.uid,
    matches: Object.values(state?.matches ?? {}).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
    watchlist: Object.values(state?.watchlist ?? {}).sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)),
    /** Карточки, которые я уже отсвайпал, — прогресс переживает сворачивание. */
    swipedTitleIds: mySwipes,
    create, join, leave, close, swipe, setDeck,
    addToWatchlist: (title) => addToWatchlist(code, title),
    markWatched: (titleId, watched) => markWatched(code, titleId, watched),
    removeFromWatchlist: (titleId) => removeFromWatchlist(code, titleId),
    dismissCelebration: () => setCelebration(null),
    clearError: () => setError(null),
    trackInvite: () => trackMetric(METRIC.ROOM_INVITE_SENT, { room: code }),
  };
}

/**
 * В комнату уезжает только то, что нужно для компромисса, — не весь профиль.
 *
 * Кроме тем едут идентификаторы любимых фильмов. Без них подборка
 * строилась по опорам ОДНОГО человека — того, кто нажал «собрать
 * колоду»: собрал он — вечер по его вкусу, собрала она — по её,
 * и никогда по обоим. Со стороны это и выглядело как «попадается
 * непонятно что»: половине комнаты подборка была чужой.
 *
 * Едут именно идентификаторы, а не карточки: полные данные всё равно
 * добираются из каталога, а гонять их через базу — лишний вес в каждой
 * строке участника.
 */
function compactTaste(taste, anchors) {
  if (!taste && !anchors) return null;
  const top = Object.entries(taste?.tagWeights ?? {})
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 60);

  return {
    tagWeights: Object.fromEntries(top),
    signals: taste?.signals ?? 0,
    lovedIds: (anchors?.loved ?? []).slice(0, 20).map((a) => a.id),
  };
}

function toRoomError(error) {
  if (error instanceof RoomError) return error;
  return new RoomError('unknown', error?.message ?? 'Не удалось выполнить действие в комнате');
}

export { JOIN_SOURCE };
