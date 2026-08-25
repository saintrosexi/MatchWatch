import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark, Dices, Flame, Library, SlidersHorizontal, UserRound, Users,
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth.js';
import { usePlatform } from '../hooks/usePlatform.js';
import { useToasts } from '../hooks/useToasts.js';
import { useDeck, DECK_MODE } from '../hooks/useDeck.js';
import { useRoom } from '../hooks/useRoom.js';

import { MobileShell } from '../shells/mobile/MobileShell.jsx';
import { DesktopStudio } from '../shells/desktop/DesktopStudio.jsx';

import { SwipeDeck } from '../features/deck/SwipeDeck.jsx';
import { DetailsSheet } from '../features/deck/DetailsSheet.jsx';
import { FiltersSheet, DEFAULT_FILTERS } from '../features/deck/FiltersSheet.jsx';
import { RoomsView } from '../features/rooms/RoomsView.jsx';
import { MatchCelebration } from '../features/rooms/MatchCelebration.jsx';
import { CollectionView } from '../features/collection/CollectionView.jsx';
import { FriendsView } from '../features/friends/FriendsView.jsx';
import { ProfileEditor } from '../features/profile/ProfileEditor.jsx';
import { PublicProfileView } from '../features/profile/PublicProfileView.jsx';
import { VaultView } from '../features/vault/VaultView.jsx';
import { ProfileView } from '../features/profile/ProfileView.jsx';
import { DashboardView } from '../features/profile/DashboardView.jsx';
import { RouletteModal } from '../features/roulette/RouletteModal.jsx';
import { AuthScreen } from '../features/auth/AuthScreen.jsx';
import { Onboarding } from '../features/onboarding/Onboarding.jsx';

import { Toasts } from '../ui/Toasts.jsx';
import { ErrorBoundary } from '../ui/ErrorBoundary.jsx';
import { LoadingState } from '../ui/States.jsx';
import { Radar } from '../ui/Radar.jsx';

import { ACTION, createEmptyProfile, hydrateProfile } from '../engine/tasteProfile.js';
import {
  loadUserState, subscribeUserState, recordReaction, toggleFavorite,
  undoDecision, markWatchedPersonal, saveMatch, rateTitle,
  applyLocalDecision, removeLocalDecision,
} from '../engine/userData.js';
import { buildRoomDeck, roomHistory } from '../engine/roomDeck.js';
import { initRemoteConfig } from '../engine/recommendationConfig.js';
import { JOIN_SOURCE } from '../engine/rooms.js';

import { loadLocal, saveLocal, STORAGE_KEYS } from '../lib/storage.js';
import { subscribeNetwork } from '../lib/network.js';
import { startOutbox, subscribeOutbox, flushOutbox } from '../lib/outbox.js';
import { setHapticsEnabled, getStartRoomCode, enableClosingConfirmation, haptic } from '../lib/telegram.js';
import { setSoundEnabled } from '../lib/sound.js';
import { trackError, trackMetric, breadcrumb } from '../lib/telemetry.js';
import { LEVEL, METRIC, MODULE } from '../../shared/telemetry/events.js';
import { normalizeRoomCode } from '../../shared/model/roomCode.js';

const VIEW = {
  DECK: 'deck',
  /** Каталог и звёзды — способы найти новое. */
  COLLECTION: 'collection',
  ROOMS: 'rooms',
  /** Всё, про что решение уже принято, — самостоятельный раздел. */
  MINE: 'mine',
  FRIENDS: 'friends',
  PROFILE: 'profile',
  PUBLIC_PROFILE: 'public-profile',
  DASHBOARD: 'dashboard',
};

const DEFAULT_PREFS = { sound: true, haptics: true };

export default function App() {
  const platform = usePlatform();
  const auth = useAuth();
  const toasts = useToasts();

  const [view, setView] = useState(VIEW.DECK);
  const [online, setOnline] = useState(true);
  /** Сколько записей ждут отправки в базу. */
  const [pendingWrites, setPendingWrites] = useState(0);
  const [onboarded, setOnboarded] = useState(() => loadLocal(STORAGE_KEYS.ONBOARDED, false));
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...loadLocal(STORAGE_KEYS.PREFS, {}) }));
  const [filters, setFilters] = useState(() => loadLocal(STORAGE_KEYS.FILTERS, DEFAULT_FILTERS));

  const [userState, setUserState] = useState(null);
  const [taste, setTaste] = useState(createEmptyProfile);

  const [detailsEntry, setDetailsEntry] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [actorDeck, setActorDeck] = useState(null);
  const [lastDecision, setLastDecision] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [publicProfile, setPublicProfile] = useState(null);
  const [focusPerson, setFocusPerson] = useState(null);
  const [roomSession, setRoomSession] = useState(false);

  const user = auth.user;
  // Стабильная ссылка: иначе колбэки комнаты пересоздаются на каждый рендер.
  const roomUser = useMemo(
    () => user ?? { uid: 'anonymous', displayName: 'Гость', photoURL: null },
    [user],
  );
  const room = useRoom({ user: roomUser, taste });
  const deckPoolRef = useRef([]);
  const deckRef = useRef(null);
  const publishedFor = useRef(null);

  /* ── Сеть ────────────────────────────────────────────────────── */
  useEffect(() => subscribeNetwork((state) => setOnline(state.online)), []);

  /*
   * Очередь отложенной записи: гарантирует, что отметки доедут до базы
   * даже если сеть пропала в момент действия. Без неё они оставались бы
   * только на экране и исчезали после перезагрузки.
   */
  useEffect(() => {
    const stop = startOutbox();
    const unsubscribe = subscribeOutbox(setPendingWrites);
    return () => { stop(); unsubscribe(); };
  }, []);

  /* ── Предпочтения ────────────────────────────────────────────── */
  useEffect(() => {
    setSoundEnabled(prefs.sound);
    setHapticsEnabled(prefs.haptics);
    saveLocal(STORAGE_KEYS.PREFS, prefs);
  }, [prefs]);

  useEffect(() => { saveLocal(STORAGE_KEYS.FILTERS, filters); }, [filters]);

  /* ── Данные пользователя ─────────────────────────────────────── */
  useEffect(() => {
    if (!user?.uid) return undefined;
    let alive = true;

    loadUserState(user.uid)
      .then((state) => {
        if (!alive) return;
        setUserState(state);
        setTaste(hydrateProfile(state.taste));
      })
      .catch((error) => {
        // Колода ждёт загруженного состояния, поэтому пустой отказ здесь
        // означал бы вечный спиннер. Разворачиваемся в пустой профиль:
        // лента заработает, а история подтянется при следующей попытке.
        if (!alive) return;
        trackError('Не удалось загрузить состояние пользователя', {
          module: MODULE.TASTE, level: LEVEL.ERROR, error,
        });
        setUserState({
          profile: {}, access: { tier: 'free', stars: 0 },
          history: {}, wishlist: {}, watched: {}, favorites: {}, matches: {},
        });
        toasts.error('История решений не загрузилась — лента может показать уже просмотренное.');
      });

    // Подписка сообщает лишь факт изменения: состояние перечитываем целиком,
    // иначе пять таблиц пришлось бы сливать вручную и расхождения неизбежны.
    const unsubscribe = subscribeUserState(user.uid, () => {
      if (!alive) return;
      loadUserState(user.uid).then((state) => { if (alive) setUserState(state); });
    });

    const stopConfig = initRemoteConfig({ uid: user.uid });
    trackMetric(METRIC.APP_OPEN, { context: { shell: platform.shell, telegram: platform.telegram } });

    return () => { alive = false; unsubscribe?.(); stopConfig?.(); };
  }, [user?.uid, platform.shell, platform.telegram]);

  /* ── Deep-link в комнату: ?room=CODE или Telegram start_param ── */
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || !auth.isReady || !user?.uid) return;

    const fromTelegram = getStartRoomCode();
    const fromQuery = normalizeRoomCode(new URLSearchParams(window.location.search).get('room'));
    const code = auth.startRoom ?? fromTelegram ?? fromQuery;
    if (!code) return;

    deepLinkHandled.current = true;
    const source = auth.startRoom || fromTelegram ? JOIN_SOURCE.DEEP_LINK : JOIN_SOURCE.LINK;
    breadcrumb(`deep-link: комната ${code} (${source})`);

    room.join(code, source)
      .then(() => {
        setView(VIEW.ROOMS);
        auth.clearStartRoom();
        toasts.success(`Вы в комнате ${code}`);
      })
      .catch((error) => toasts.error(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isReady, auth.startRoom, user?.uid]);

  /* ── Хост публикует общую колоду, когда состав комнаты меняется ── */
  useEffect(() => {
    if (!room.code || !room.isHost || !room.consensus) return;
    const memberCount = room.members.length;
    const key = `${room.code}:${memberCount}`;
    if (publishedFor.current === key || memberCount < 2) return;
    publishedFor.current = key;

    breadcrumb(`комната ${room.code}: пересобираем колоду на ${memberCount} участников`);

    buildRoomDeck({
      consensus: room.consensus,
      filters,
      history: roomHistory(room.state, user.uid),
    })
      .then(({ deck }) => {
        if (deck.length) room.setDeck(deck);
      })
      .catch(() => toasts.error('Не удалось собрать общую колоду. Свайпайте — попробуем ещё раз.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.code, room.isHost, room.members.length, room.consensus]);

  /* ── Подтверждение выхода, пока идёт сессия в комнате ─────────── */
  useEffect(() => {
    enableClosingConfirmation(Boolean(room.code && roomSession));
    return () => enableClosingConfirmation(false);
  }, [room.code, roomSession]);

  /* ── Колода ──────────────────────────────────────────────────── */
  const deckMode = actorDeck
    ? DECK_MODE.ACTOR
    : room.code && roomSession ? DECK_MODE.ROOM : DECK_MODE.SOLO;

  const history = useMemo(() => {
    const base = { ...(userState?.history ?? {}) };
    if (deckMode === DECK_MODE.ROOM && room.state) {
      Object.assign(base, roomHistory(room.state, user?.uid));
    }
    return base;
  }, [userState?.history, deckMode, room.state, user?.uid]);

  const deck = useDeck({
    mode: deckMode,
    filters,
    taste,
    history,
    actorId: actorDeck?.id ?? null,
    roomDeck: deckMode === DECK_MODE.ROOM ? room.state?.deck : null,
    /*
     * Колода не собирается, пока не приехала история решений: иначе
     * исключать нечего и всё отклонённое возвращается в ленту.
     */
    enabled: Boolean(userState) && (Boolean(user?.uid) || auth.isDegraded),
  });

  useEffect(() => {
    if (deck.queue.length) deckPoolRef.current = deck.queue.map((e) => e.title);
    deckRef.current = deck;
  }, [deck, deck.queue]);

  // Смена колоды обнуляет историю отмены: возвращать нечего.
  useEffect(() => { setLastDecision(null); }, [deckMode, actorDeck]);

  /* ── Реакция на карточку ─────────────────────────────────────── */
  const handleDecision = useCallback(async (entry, action) => {
    const title = entry.title;

    // Снимок профиля до действия: отменить решение иначе нельзя —
    // applySignal необратим из-за старения и массы настроения.
    setLastDecision({ entry, action, previousTaste: taste });

    // Списки и профиль обновляем в том же кадре: ждать ответа базы,
    // чтобы отметка появилась на экране, — значит выглядеть сломанным.
    setUserState((prev) => applyLocalDecision(prev, title, action));

    const nextTaste = await recordReaction({
      uid: user?.uid, title, action, taste,
      surface: deckMode === DECK_MODE.ROOM ? 'room' : deckMode,
    });
    setTaste(nextTaste);

    if (deckMode !== DECK_MODE.ROOM) return;

    const roomAction = action === ACTION.DISLIKE ? 'pass' : 'like';
    const result = await room.swipe(title, roomAction);

    if (result?.matched && result.match) {
      saveMatch({
        uid: user.uid,
        title,
        roomCode: room.code,
        partners: room.members.filter((m) => m.uid !== user.uid).map((m) => m.name),
      });
    }
  }, [user?.uid, taste, deckMode, room]);

  const handleToggleWatched = useCallback(async (title) => {
    const watched = history[title.id] === 'watched';
    const nextTaste = await markWatchedPersonal({ uid: user?.uid, title, taste, watched: !watched });
    setTaste(nextTaste);
    if (room.code) await room.markWatched(title.id, !watched);
    toasts.success(watched ? 'Вернули в ленту' : 'Отметили как просмотренное');
  }, [history, user?.uid, taste, room, toasts]);

  /**
   * Отмена решения. Возвращает карточку в колоду и откатывает профиль
   * вкуса к снимку, снятому перед действием.
   */
  const handleUndo = useCallback(async () => {
    if (!lastDecision) return;
    const { entry, previousTaste } = lastDecision;
    setLastDecision(null);
    deckRef.current?.restore(entry);
    setUserState((prev) => removeLocalDecision(prev, entry.title.id));
    const restored = await undoDecision({
      uid: user?.uid, titleId: entry.title.id, previousTaste,
    });
    setTaste(restored ?? previousTaste);
    haptic('light');
    toasts.push(`Вернули «${entry.title.title}»`);
  }, [lastDecision, user?.uid, toasts]);

  /** То же самое из списков «Моё»: убрать решение и вернуть фильм в выбор. */
  const handleUndoFromList = useCallback(async (stub) => {
    const titleId = stub.id ?? stub.titleId;
    setUserState((prev) => removeLocalDecision(prev, titleId));
    await undoDecision({ uid: user?.uid, titleId, previousTaste: taste });
    toasts.push(`«${stub.title}» снова в выборе`);
  }, [user?.uid, taste, toasts]);

  /**
   * Оценка фильма. Заодно помечает его просмотренным: оценить можно
   * только то, что видел, и оставлять такое кино в ленте бессмысленно.
   */
  const handleRate = useCallback(async (title, value) => {
    if (!value) return;
    setUserState((prev) => applyLocalDecision(prev, title, ACTION.WATCHED, { rating: value }));
    const nextTaste = await rateTitle({ uid: user?.uid, title, rating: value, taste });
    setTaste(nextTaste);
    haptic('success');
    toasts.success(`Оценка ${value} — учтём в рекомендациях`);
  }, [user?.uid, taste, toasts]);

  const handleRemoveFavorite = useCallback(async (stub) => {
    const titleId = stub.id ?? stub.titleId;
    setUserState((prev) => removeLocalDecision(prev, titleId));
    const nextTaste = await toggleFavorite({
      uid: user?.uid, title: { ...stub, id: titleId }, isFavorite: true, taste,
    });
    setTaste(nextTaste);
    await undoDecision({ uid: user?.uid, titleId, previousTaste: taste });
    toasts.push(`«${stub.title}» убран из избранного`);
  }, [user?.uid, taste, toasts]);

  const startActorDeck = useCallback((person) => {
    setActorDeck(person);
    setView(VIEW.DECK);
    haptic('medium');
    toasts.success(`Колода: ${person.name}`);
  }, [toasts]);

  const createRoom = useCallback(async () => {
    const { deck: roomDeckEntries } = await buildRoomDeck({
      consensus: taste, filters, history: userState?.history ?? {},
    });
    return room.create({ deck: roomDeckEntries, filters });
  }, [taste, filters, userState?.history, room]);

  /*
   * Первый вход через Telegram завёл новый аккаунт. Если у человека уже был
   * профиль по email, он об этом сейчас не догадывается — история окажется
   * пустой, и виноватым будет выглядеть приложение.
   */
  useEffect(() => {
    if (!auth.justRegistered) return;
    toasts.push('Аккаунт создан через Telegram. Был профиль по email? Профиль → «Вход через Telegram».', { ttl: 8000 });
    auth.dismissJustRegistered();
  }, [auth.justRegistered]);

  /* ── Гейты рендера ───────────────────────────────────────────── */
  if (auth.status === 'booting') {
    return <div className="app-root"><LoadingState text="Открываем кинозал…" /></div>;
  }

  if (!user && !auth.isDegraded) {
    return <div className="app-root"><AuthScreen auth={auth} /></div>;
  }

  if (!onboarded) {
    return (
      <div className="app-root">
        <Onboarding onDone={() => { setOnboarded(true); saveLocal(STORAGE_KEYS.ONBOARDED, true); }} />
      </div>
    );
  }

  const sessionUser = user ?? roomUser;

  const pendingInRoom = room.watchlist.filter((i) => !i.watched).length;

  const mineCount = Object.keys(userState?.wishlist ?? {}).length;

  /**
   * Пять пунктов, и «Вместе» третий — то есть ровно по центру дока.
   * Слева способы найти кино, справа — своё и люди.
   * Профиль в доке не нужен: он всегда доступен по аватару справа сверху.
   */
  const nav = [
    { key: VIEW.DECK, label: 'Кино', icon: Flame },
    { key: VIEW.COLLECTION, label: 'Каталог', icon: Library },
    { key: VIEW.ROOMS, label: 'Вместе', icon: Users, badge: room.onlineCount > 1 ? room.onlineCount : 0 },
    { key: VIEW.MINE, label: 'Моё', icon: Bookmark, badge: pendingInRoom || mineCount },
    { key: VIEW.FRIENDS, label: 'Друзья', icon: UserRound },
  ];

  const deckPanel = (
    <SwipeDeck
      deck={deck}
      onDecision={handleDecision}
      onOpenDetails={setDetailsEntry}
      onOpenFilters={() => setFiltersOpen(true)}
      onRestart={actorDeck ? () => setActorDeck(null) : undefined}
      onUndo={handleUndo}
      canUndo={Boolean(lastDecision)}
      emptyArt="/mascot/empty.png"
      emptyTitle={actorDeck ? `Фильмы с ${actorDeck.name} закончились` : 'Колода закончилась'}
      emptyText={actorDeck
        ? 'Вернитесь в общую ленту или выберите другую звезду.'
        : 'Мы показали всё, что подходит под фильтры. Ослабьте их — и лента оживёт.'}
    />
  );

  const content = renderView({
    view, room, sessionUser, userState, taste, prefs, toasts, history,
    setView, setPrefs, setActorDeck, setRoomSession, setDetailsEntry,
    focusPerson, createRoom, startActorDeck, handleToggleWatched,
    handleRemoveFavorite, handleUndoFromList, auth,
    setEditorOpen, publicProfile, setPublicProfile,
  });

  const statusStrip = renderStatus({ online, room, roomSession, deckMode, auth, pendingWrites });

  const navigate = (key) => { haptic('select'); setActorDeck(null); setView(key); };
  const shellProps = { active: view, onNavigate: navigate, user: sessionUser, online };

  return (
    <ErrorBoundary name="app-root">
      <div className="aurora" data-mood={room.celebration ? 'match' : room.code ? 'room' : undefined} />
      <div className="app-root">
        {platform.shell === 'desktop' ? (
          <DesktopStudio
            {...shellProps}
            nav={nav}
            onOpenProfile={() => navigate(VIEW.PROFILE)}
            title={TITLES[view] ?? 'MatchWatch'}
            subtitle={SUBTITLES({ view, room, actorDeck })}
            onLogout={auth.logout}
            actions={view === VIEW.DECK && (
              <div className="row gap-2">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRouletteOpen(true)}>
                  <Dices size={15} /> Рулетка
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFiltersOpen(true)}>
                  <SlidersHorizontal size={15} /> Фильтры
                </button>
              </div>
            )}
          >
            {view === VIEW.DECK ? (
              <div className="cinema">
                <div className="cinema__deck">
                  {statusStrip}
                  {deckPanel}
                </div>
                <aside className="cinema__panel">
                  <DeckSidePanel deck={deck} room={room} taste={taste} />
                </aside>
              </div>
            ) : (
              <div className="studio__content">{content}</div>
            )}
          </DesktopStudio>
        ) : (
          <MobileShell
            {...shellProps}
            nav={nav}
            onOpenProfile={() => navigate(VIEW.PROFILE)}
            fixed={view === VIEW.DECK}
            statusStrip={statusStrip}
            right={view === VIEW.DECK && (
              <>
                <button type="button" className="hud__pill" onClick={() => setRouletteOpen(true)} aria-label="Кино-рулетка">
                  <Dices size={15} />
                </button>
                <button type="button" className="hud__pill" onClick={() => setFiltersOpen(true)} aria-label="Фильтры">
                  <SlidersHorizontal size={15} />
                </button>
              </>
            )}
          >
            {view === VIEW.DECK ? deckPanel : content}
          </MobileShell>
        )}

        <Toasts toasts={toasts.toasts} onDismiss={toasts.dismiss} />

        <ProfileEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          uid={user?.uid}
          profile={userState?.profile}
          toasts={toasts}
          onSaved={(saved) => setUserState((prev) => (prev ? { ...prev, profile: saved ?? prev.profile } : prev))}
        />

        <DetailsSheet
          open={Boolean(detailsEntry)}
          entry={detailsEntry}
          onClose={() => setDetailsEntry(null)}
          onOpenActor={(personId) => { setDetailsEntry(null); setFocusPerson(personId); setView(VIEW.COLLECTION); }}
          onToggleWatched={handleToggleWatched}
          isWatched={detailsEntry ? history[detailsEntry.title.id] === 'watched' : false}
          rating={detailsEntry ? (userState?.ratings?.[detailsEntry.title.id]?.rating ?? null) : null}
          onRate={handleRate}
        />

        <FiltersSheet
          open={filtersOpen}
          value={filters}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => { setFilters(next); setActorDeck(null); }}
        />

        <RouletteModal
          open={rouletteOpen}
          onClose={() => setRouletteOpen(false)}
          pool={deckPoolRef.current}
          history={history}
          onPick={(title) => setDetailsEntry({ id: title.id, title, matchedTags: [] })}
        />

        {room.celebration && (
          <MatchCelebration
            match={room.celebration}
            roomCode={room.code}
            onClose={room.dismissCelebration}
            onOpenWatchlist={() => { room.dismissCelebration(); setView(VIEW.MINE); }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

const TITLES = {
  [VIEW.DECK]: 'Лента',
  [VIEW.COLLECTION]: 'Каталог',
  [VIEW.ROOMS]: 'Смотрим вместе',
  [VIEW.MINE]: 'Моё',
  [VIEW.FRIENDS]: 'Друзья',
  [VIEW.PROFILE]: 'Профиль',
  [VIEW.PUBLIC_PROFILE]: 'Профиль',
  [VIEW.DASHBOARD]: 'Метрики',
};

const SUBTITLES = ({ view, room, actorDeck }) => {
  if (view === VIEW.DECK && actorDeck) return `Только фильмы: ${actorDeck.name}`;
  if (view === VIEW.DECK && room.code) return `Комната ${room.code} · ${room.onlineCount} в сети`;
  if (view === VIEW.DECK) return 'Свайпайте: вправо — нравится, влево — мимо';
  return null;
};

function renderView(ctx) {
  const {
    view, room, sessionUser, userState, taste, prefs, toasts, history,
    setView, setPrefs, setRoomSession, setDetailsEntry, setActorDeck,
    focusPerson, createRoom, startActorDeck, handleToggleWatched,
    handleRemoveFavorite, handleUndoFromList, auth,
    setEditorOpen, publicProfile, setPublicProfile,
  } = ctx;

  const openDetails = (stub) => setDetailsEntry({
    id: stub.id ?? stub.titleId, title: stub, matchedTags: [],
  });

  switch (view) {
    case VIEW.ROOMS:
      return (
        <RoomsView
          room={room}
          user={sessionUser}
          toasts={toasts}
          onCreate={createRoom}
          onEnterRoom={() => { setRoomSession(true); setActorDeck(null); setView(VIEW.DECK); }}
        />
      );

    case VIEW.COLLECTION:
      return (
        <CollectionView
          catalog={{ onOpenTitle: openDetails, history }}
          stars={{ onStartActorDeck: startActorDeck, initialPersonId: focusPerson }}
        />
      );

    case VIEW.MINE:
      return (
        <VaultView
          room={room.code ? room : null}
          favorites={userState?.favorites ?? {}}
          watched={userState?.watched ?? {}}
          wishlist={userState?.wishlist ?? {}}
          ratings={userState?.ratings ?? {}}
          matches={userState?.matches ?? {}}
          onOpenTitle={openDetails}
          onRemoveFavorite={handleRemoveFavorite}
          onUndoDecision={handleUndoFromList}
        />
      );

    case VIEW.FRIENDS:
      return (
        <FriendsView
          me={sessionUser}
          toasts={toasts}
          onOpenProfile={(username) => { setPublicProfile(username); setView(VIEW.PUBLIC_PROFILE); }}
        />
      );

    case VIEW.PUBLIC_PROFILE:
      return (
        <PublicProfileView
          username={publicProfile}
          toasts={toasts}
          onBack={() => setView(VIEW.FRIENDS)}
        />
      );

    case VIEW.PROFILE:
      return (
        <ProfileView
          user={sessionUser}
          profile={userState?.profile}
          taste={taste}
          access={userState?.access}
          matches={userState?.matches ?? {}}
          favorites={userState?.favorites ?? {}}
          ratings={userState?.ratings ?? {}}
          onOpenTitle={openDetails}
          prefs={prefs}
          onPrefsChange={(patch) => setPrefs((p) => ({ ...p, ...patch }))}
          onLogout={auth.logout}
          onOpenDashboard={() => setView(VIEW.DASHBOARD)}
          onEditProfile={() => setEditorOpen(true)}
          onOpenFriends={() => setView(VIEW.FRIENDS)}
          auth={auth}
          toasts={toasts}
        />
      );

    case VIEW.DASHBOARD:
      return <DashboardView onBack={() => setView(VIEW.PROFILE)} />;

    default:
      // Лента рисуется шеллом напрямую — сюда попадать не должны.
      return null;
  }
}

/** Строка состояния: сеть, комната, режим колоды. Молчание — худший UX. */
function renderStatus({ online, room, roomSession, deckMode, auth, pendingWrites }) {
  if (!online) {
    return (
      <p className="status-strip status-strip--error">
        Нет соединения. Отметки сохраняются и уедут в базу, когда сеть вернётся.
      </p>
    );
  }

  // Сеть есть, но что-то ещё не доехало — честно показываем, а не молчим.
  if (pendingWrites > 0) {
    return (
      <p className="status-strip status-strip--warn">
        Досылаем {pendingWrites} {pendingWrites === 1 ? 'отметку' : 'отметок'} в базу…
      </p>
    );
  }
  if (auth.isDegraded) {
    return <p className="status-strip status-strip--warn">{auth.error?.text}</p>;
  }
  if (room.error) {
    return <p className="status-strip status-strip--error">{room.error.message}</p>;
  }
  if (deckMode === 'room' && roomSession) {
    return (
      <p className="status-strip status-strip--live">
        Комната {room.code} · {room.onlineCount} в сети · общая колода
      </p>
    );
  }
  return null;
}

/** Правая колонка десктопа: контекст текущей карточки без модалок. */
function DeckSidePanel({ deck, room, taste }) {
  const entry = deck.current;
  if (!entry) return null;
  const title = entry.title;

  return (
    <>
      <section className="taste-panel">
        <span className="eyebrow">Сейчас на экране</span>
        <h2 className="section__title">{title.title}</h2>
        {title.overview && <p className="details__overview clamp-3">{title.overview}</p>}
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          {(title.genres ?? []).map((g) => <span className="chip" key={g}>{g}</span>)}
        </div>
      </section>

      <section className="taste-panel">
        <span className="eyebrow">
          {room.consensus ? 'Компромисс комнаты' : 'Ваше настроение'}
        </span>
        <Radar
          size={260}
          showValues={false}
          vectors={[
            { key: 'me', vector: taste.moods },
            ...(title.moods ? [{ key: 'title', vector: title.moods, variant: 'partner' }] : []),
            ...(room.consensus ? [{ key: 'room', vector: room.consensus.moods, variant: 'consensus' }] : []),
          ]}
        />
        <p className="faint" style={{ fontSize: 'var(--t-micro)' }}>
          Кораллом — ваш профиль, голубым — настроение фильма
          {room.consensus ? ', пунктиром — компромисс комнаты' : ''}.
        </p>
      </section>
    </>
  );
}
