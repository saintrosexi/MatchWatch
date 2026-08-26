/**
 * Совместные комнаты реального времени на Supabase.
 *
 * Инварианты, которые здесь держатся жёстко:
 *
 *  1. Один формат кода на всё: создание, ручной ввод, ссылка и deep-link
 *     проходят через normalizeRoomCode. Поиск не может разойтись с записью.
 *     Тот же формат продублирован ограничением в самой таблице.
 *  2. Голос и проверка мэтча — один вызов record_swipe. Функция берёт
 *     блокировку на строку комнаты, поэтому два одновременных свайпа
 *     не могут «не увидеть» друг друга и потерять мэтч.
 *  3. Мэтч создаётся ровно один раз: ON CONFLICT DO NOTHING в SQL.
 *  4. Комната всегда отвечает: «не найдена», «истекла», «переполнена» —
 *     явные коды ошибок из Postgres, а не тихое зависание.
 *  5. У комнаты есть TTL: 4-значных кодов конечное число.
 */

import { supabase, supabaseReady, guarded, PG_ERROR } from '../lib/supabase.js';
import { normalizeRoomCode, JOIN_SOURCE, ROOM_CODE_LENGTH } from '../../shared/model/roomCode.js';
import { titleStub } from '../../shared/model/title.js';
import { RECOMMENDATION_CONFIG } from '../../shared/config/recommendation.js';
import { trackBusiness, trackError, trackMetric, setTelemetryRoom } from '../lib/telemetry.js';
import { BIZ, LEVEL, METRIC, MODULE } from '../../shared/telemetry/events.js';

export const ROOM_MAX_MEMBERS = 8;

export class RoomError extends Error {
  constructor(code, message, { roomCode, source } = {}) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
    this.roomCode = roomCode ?? null;
    this.source = source ?? null;
  }
}

const requireClient = () => {
  if (!supabaseReady()) {
    throw new RoomError('offline', 'Совместные комнаты недоступны: нет подключения к базе.');
  }
};

/** Переводит код ошибки Postgres в доменную ошибку с человеческим текстом. */
function toRoomError(error, { code, source } = {}) {
  if (error instanceof RoomError) return error;

  const map = {
    [PG_ERROR.INVALID_CODE]: ['invalid_code', `Код комнаты состоит из ${ROOM_CODE_LENGTH} цифр. Проверьте ввод.`],
    [PG_ERROR.NOT_FOUND]: ['not_found', `Комната ${code ?? ''} не найдена. Возможно, она уже закрылась.`],
    [PG_ERROR.EXPIRED]: ['expired', `Комната ${code ?? ''} истекла. Попросите создать новую.`],
    [PG_ERROR.ROOM_FULL]: ['full', `В комнате ${code ?? ''} уже максимум участников.`],
    [PG_ERROR.FORBIDDEN]: ['forbidden', 'Нет доступа к этой комнате.'],
    [PG_ERROR.CODE_EXHAUSTED]: ['code_exhausted', 'Сейчас слишком много активных комнат. Попробуйте через минуту.'],
  };

  const [domainCode, message] = map[error?.code] ?? ['unknown', error?.message ?? 'Не удалось выполнить действие в комнате'];
  return new RoomError(domainCode, message, { roomCode: code, source });
}

/* ────────────────────────────────────────────────────────────────
   Создание и вход
   ──────────────────────────────────────────────────────────────── */

export async function createRoom({ user, deck = [], filters = null, profile = null }) {
  requireClient();

  try {
    const code = await guarded(
      () => supabase.rpc('create_room', {
        p_deck: deck.map((entry) => titleStub(entry.title ?? entry)),
        p_filters: filters,
        p_taste: profile,
        p_display_name: user.displayName ?? null,
        p_photo_url: user.photoURL ?? null,
      }),
      { module: MODULE.ROOMS_CREATE, description: 'create room' },
    );

    setTelemetryRoom(code);
    trackMetric(METRIC.ROOM_CREATED, { room: code, context: { deckSize: deck.length } });
    return code;
  } catch (error) {
    if (error?.code === PG_ERROR.CODE_EXHAUSTED) {
      trackError('Не удалось подобрать свободный код комнаты', {
        module: MODULE.ROOMS_CREATE, level: LEVEL.CRITICAL, error,
      });
    }
    throw toRoomError(error);
  }
}

/**
 * @param {string} rawCode  ввод пользователя в любом виде
 * @param {'manual'|'link'|'telegram-deep-link'|'recent-list'} source
 */
export async function joinRoom(rawCode, { user, source = JOIN_SOURCE.MANUAL, profile = null }) {
  requireClient();

  const code = normalizeRoomCode(rawCode);
  if (!code) {
    trackBusiness(BIZ.ROOM_CODE_INVALID, {
      module: MODULE.ROOMS_JOIN,
      context: { source, rawLength: String(rawCode ?? '').length },
    });
    throw new RoomError('invalid_code', `Код комнаты состоит из ${ROOM_CODE_LENGTH} цифр. Проверьте ввод.`, { source });
  }

  try {
    const room = await guarded(
      () => supabase.rpc('join_room', {
        p_code: code,
        p_taste: profile,
        p_display_name: user.displayName ?? null,
        p_photo_url: user.photoURL ?? null,
      }),
      { module: MODULE.ROOMS_JOIN, roomCode: code, description: 'join room' },
    );

    setTelemetryRoom(code);
    trackMetric(METRIC.ROOM_JOINED, { room: code, context: { source } });
    return { code, meta: room };
  } catch (error) {
    // Ровно тот случай, ради которого заведено бизнес-логирование: видно,
    // каким способом пользователь заходил и почему не попал.
    const businessEvent = {
      [PG_ERROR.NOT_FOUND]: BIZ.ROOM_NOT_FOUND,
      [PG_ERROR.EXPIRED]: BIZ.ROOM_EXPIRED,
      [PG_ERROR.ROOM_FULL]: BIZ.ROOM_FULL,
    }[error?.code];

    if (businessEvent) {
      trackBusiness(businessEvent, {
        module: MODULE.ROOMS_JOIN, room: code, level: LEVEL.WARNING,
        context: { source, normalizedFrom: String(rawCode ?? '').slice(0, 12) },
      });
    }

    throw toRoomError(error, { code, source });
  }
}

/* ────────────────────────────────────────────────────────────────
   Состояние и присутствие
   ──────────────────────────────────────────────────────────────── */

/** Полное состояние комнаты одним чтением. */
export async function fetchRoomState(code) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  if (!normalized) throw new RoomError('invalid_code', 'Некорректный код комнаты');

  const [room, members, swipes, matches, watchlist] = await Promise.all([
    supabase.from('rooms').select('*').eq('code', normalized).maybeSingle(),
    supabase.from('room_members').select('*').eq('room_code', normalized),
    supabase.from('room_swipes').select('title_id,user_id,action').eq('room_code', normalized),
    supabase.from('room_matches').select('*').eq('room_code', normalized).order('created_at', { ascending: false }),
    supabase.from('room_watchlist').select('*').eq('room_code', normalized).order('added_at', { ascending: false }),
  ]);

  if (room.error) throw room.error;
  if (!room.data) {
    trackBusiness(BIZ.ROOM_NOT_FOUND, {
      module: MODULE.ROOMS_SYNC, room: normalized, context: { phase: 'fetch' },
    });
    throw new RoomError('not_found', 'Комната закрылась', { roomCode: normalized });
  }

  return shapeState(normalized, room.data, members.data, swipes.data, matches.data, watchlist.data);
}

function shapeState(code, room, members, swipes, matches, watchlist) {
  const swipeMap = {};
  for (const row of swipes ?? []) {
    (swipeMap[row.title_id] ??= {})[row.user_id] = row.action;
  }

  return {
    code,
    meta: {
      code: room.code,
      createdBy: room.created_by,
      createdAt: room.created_at,
      lastActivityAt: room.last_activity_at,
      expiresAt: room.expires_at,
      status: room.status,
      filters: room.filters,
    },
    deck: room.deck ?? [],
    members: Object.fromEntries((members ?? []).map((m) => [m.user_id, {
      uid: m.user_id,
      name: m.display_name ?? 'Зритель',
      photo: m.photo_url,
      host: m.is_host,
      online: m.online,
      joinedAt: m.joined_at,
      lastSeen: m.last_seen,
      /** Что человек хочет сегодня — видно всем в комнате. */
      mood: Array.isArray(m.mood_request) ? m.mood_request : [],
    }])),
    profiles: Object.fromEntries((members ?? []).filter((m) => m.taste).map((m) => [m.user_id, m.taste])),
    swipes: swipeMap,
    matches: Object.fromEntries((matches ?? []).map((m) => [m.title_id, {
      titleId: m.title_id, ...m.title, at: new Date(m.created_at).getTime(), participants: m.participants,
    }])),
    watchlist: Object.fromEntries((watchlist ?? []).map((w) => [w.title_id, {
      titleId: w.title_id, ...w.title,
      addedAt: new Date(w.added_at).getTime(),
      watched: w.watched,
      fromMatch: w.from_match,
    }])),
  };
}

/**
 * Подписка на комнату.
 *
 * На любое изменение перечитываем состояние целиком: комната маленькая
 * (до восьми участников и сорока карточек), а инкрементальное слияние
 * пяти таблиц — источник трудноуловимых расхождений.
 *
 * Присутствие идёт через Realtime Presence, а не через колонку в базе:
 * канал сам уберёт участника при обрыве связи, чего колонка не умеет —
 * упавший клиент навсегда остался бы «в сети».
 */
export function subscribeRoom(code, { uid, onState, onError, onPresence }) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  if (!normalized) {
    onError?.(new RoomError('invalid_code', 'Некорректный код комнаты'));
    return () => {};
  }

  let disposed = false;
  let timer = null;

  const refresh = () => {
    clearTimeout(timer);
    // Свайпы прилетают пачками — склеиваем их в одно перечитывание.
    timer = setTimeout(() => {
      if (disposed) return;
      fetchRoomState(normalized)
        .then((state) => { if (!disposed) onState(state); })
        .catch((error) => { if (!disposed) onError?.(toRoomError(error, { code: normalized })); });
    }, 120);
  };

  const channel = supabase.channel(`room:${normalized}`, {
    config: { presence: { key: uid } },
  });

  for (const table of ['rooms', 'room_members', 'room_swipes', 'room_matches', 'room_watchlist']) {
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table,
      filter: table === 'rooms' ? `code=eq.${normalized}` : `room_code=eq.${normalized}`,
    }, refresh);
  }

  channel.on('presence', { event: 'sync' }, () => {
    onPresence?.(Object.keys(channel.presenceState()));
  });

  channel.subscribe((status, error) => {
    if (status === 'SUBSCRIBED') {
      channel.track({ uid, at: Date.now() });
      refresh();
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      trackError('Подписка на комнату оборвалась', {
        module: MODULE.ROOMS_SYNC,
        error: error ?? new Error(status),
        context: { roomCode: normalized, status },
      });
      onError?.(new RoomError('sync_failed', 'Связь с комнатой прервалась. Пробуем восстановить…', {
        roomCode: normalized,
      }));
    }
  });

  // Отметка «в сети» в базе — для истории и для GC; живое присутствие
  // считает канал.
  const heartbeat = setInterval(() => {
    supabase.rpc('touch_presence', { p_code: normalized, p_online: true }).then(() => {});
  }, 45_000);
  supabase.rpc('touch_presence', { p_code: normalized, p_online: true }).then(() => {});

  return () => {
    disposed = true;
    clearTimeout(timer);
    clearInterval(heartbeat);
    supabase.rpc('touch_presence', { p_code: normalized, p_online: false }).then(() => {});
    supabase.removeChannel(channel);
  };
}

/* ────────────────────────────────────────────────────────────────
   Свайпы и мэтчи
   ──────────────────────────────────────────────────────────────── */

/**
 * Записывает голос и проверяет обоюдный лайк одним вызовом.
 *
 * Вся логика в SQL намеренно: два участника нередко свайпают одну карточку
 * в одну миллисекунду, и любая проверка «сначала прочитать, потом решить»
 * на клиенте теряет один из голосов вместе с мэтчем.
 */
export async function recordSwipe(code, { title, action }) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  if (!normalized) throw new RoomError('invalid_code', 'Некорректный код комнаты');

  try {
    const result = await guarded(
      () => supabase.rpc('record_swipe', {
        p_code: normalized,
        p_title_id: title.id,
        p_action: action,
        p_title: titleStub(title),
      }),
      { module: MODULE.ROOMS_SWIPE, roomCode: normalized, description: 'record swipe' },
    );

    trackMetric(METRIC.SWIPE, { room: normalized, context: { action, surface: 'room' } });

    if (result?.matched) {
      trackMetric(METRIC.MATCH, { room: normalized, context: { titleId: title.id } });
      return {
        matched: true,
        match: { titleId: title.id, ...(result.match?.title ?? titleStub(title)), at: Date.now() },
      };
    }

    return { matched: false };
  } catch (error) {
    trackBusiness(BIZ.SWIPE_TRANSACTION_ABORTED, {
      module: MODULE.ROOMS_SWIPE, room: normalized,
      context: { titleId: title.id, action, pgCode: error?.code },
    });
    throw toRoomError(error, { code: normalized });
  }
}

/* ────────────────────────────────────────────────────────────────
   Список к просмотру и колода
   ──────────────────────────────────────────────────────────────── */

export async function addToWatchlist(code, title) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  await guarded(
    () => supabase.rpc('set_watchlist_item', {
      p_code: normalized, p_title_id: title.id, p_title: titleStub(title), p_watched: false,
    }),
    { module: MODULE.VAULT, roomCode: normalized, description: 'add to watchlist' },
  );
  trackMetric(METRIC.WATCHLIST_ADD, { room: normalized });
}

/** «Уже посмотрели» — убирает тайтл из будущих колод этой комнаты. */
export async function markWatched(code, titleId, watched = true) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  await guarded(
    () => supabase.rpc('set_watchlist_item', {
      p_code: normalized, p_title_id: titleId, p_title: { id: titleId }, p_watched: watched,
    }),
    { module: MODULE.VAULT, roomCode: normalized, description: 'mark watched' },
  );
  if (watched) trackMetric(METRIC.WATCHED_MARK, { room: normalized });
}

export async function removeFromWatchlist(code, titleId) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  await guarded(
    () => supabase.from('room_watchlist').delete().eq('room_code', normalized).eq('title_id', titleId),
    { module: MODULE.VAULT, roomCode: normalized, description: 'remove from watchlist' },
  );
}

/** Публикует общую колоду. Право проверяет SQL: пишет только хост. */
export async function publishDeck(code, deck) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  await guarded(
    () => supabase.rpc('publish_deck', {
      p_code: normalized,
      p_deck: deck.map((entry) => titleStub(entry.title ?? entry)),
    }),
    { module: MODULE.ROOMS_SYNC, roomCode: normalized, description: 'publish deck' },
  );
}

/**
 * Дописывает карточки в конец общей колоды.
 *
 * Публикацией это не назвать: колода не заменяется, а растёт, и делать
 * это может любой участник. Иначе колода замирает, стоит хосту свернуть
 * приложение, — а сворачивают его постоянно.
 */
export async function appendDeck(code, deck) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  if (!normalized || !deck?.length) return null;
  return guarded(
    () => supabase.rpc('append_room_deck', { p_code: normalized, p_deck: deck }),
    { module: MODULE.ROOMS_SYNC, roomCode: normalized, description: 'append deck' },
  );
}

export async function leaveRoom(code) {
  if (!supabaseReady()) return;
  const normalized = normalizeRoomCode(code);
  if (!normalized) return;
  await supabase.rpc('touch_presence', { p_code: normalized, p_online: false });
  setTelemetryRoom(null);
}

/**
 * Завершение комнаты хостом.
 *
 * Комната не удаляется, а закрывается: по её участникам собирается
 * «с кем смотрели», а мэтчи уже разошлись по личным спискам. Стирать
 * всё это ради опустевшей строки — плохой обмен. Право есть только
 * у создателя, и проверяет его сама функция, а не клиент.
 */
export async function closeRoom(code) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  const result = await guarded(
    () => supabase.rpc('close_room', { p_code: normalized }),
    { module: MODULE.ROOMS_SYNC, roomCode: normalized, description: 'close room' },
  );
  setTelemetryRoom(null);
  return result;
}

/**
 * Записывает своё настроение на сегодня.
 *
 * Меняет только свою строку: чужой запрос — не тот предмет, который
 * можно поправить за человека.
 */
export async function setRoomMood(code, keys) {
  requireClient();
  const normalized = normalizeRoomCode(code);
  if (!normalized) return null;

  return guarded(
    () => supabase.rpc('set_room_mood', { p_code: normalized, p_keys: keys ?? [] }),
    { module: MODULE.ROOMS_SYNC, roomCode: normalized, description: 'set room mood' },
  );
}

/**
 * Что не должно попасть в общую колоду: просмотренное и любимое всех,
 * кто в комнате. Считается на сервере — чужую историю клиент не видит
 * и видеть не должен.
 */
export async function roomExcludedTitles(code, { keepFavorites = false } = {}) {
  if (!supabaseReady()) return [];
  const normalized = normalizeRoomCode(code);
  if (!normalized) return [];

  const rows = await guarded(
    () => supabase.rpc('room_excluded_titles', { p_code: normalized, p_keep_favorites: keepFavorites }),
    { module: MODULE.ROOMS_SYNC, roomCode: normalized, description: 'room exclusions' },
  );
  return (rows ?? []).map((r) => r.title_id).filter(Boolean);
}

/** Размер синхронизированной колоды берётся из конфига, а не из константы в UI. */
export const roomDeckSize = () => RECOMMENDATION_CONFIG.room.deckSize;

export { JOIN_SOURCE, normalizeRoomCode };
