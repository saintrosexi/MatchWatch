import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Bookmark, Dices, Flame, Library, SlidersHorizontal, UserRound, Users, IconContext, ICON, Star } from '../ui/icons.js';

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
import { CollectionView } from '../features/collection/CollectionView.jsx';
import { VaultView } from '../features/vault/VaultView.jsx';
import { MeView } from '../features/profile/MeView.jsx';
import { AuthScreen } from '../features/auth/AuthScreen.jsx';

/*
 * Отложенные куски.
 *
 * Всё это открывается по случаю: празднование мэтча, рулетка, редактор
 * профиля, метрики, чужой профиль, обучение. Держать их в первом
 * загружаемом файле значит платить их весом на каждом холодном старте
 * ради экранов, до которых человек может не дойти вовсе. Празднование
 * вдобавок тянет за собой библиотеку конфетти.
 */
/*
 * Каждый ленивый экран обёрнут в `retryChunk`: после выкладки новой
 * версии имена файлов меняются, и страница, открытая со старой сборки,
 * идёт за файлом, которого больше нет. Празднование мэтча так и не
 * показалось никому — вместо него люди видели «Что-то сломалось».
 */
const MatchCelebration = lazy(retryChunk(() => import('../features/rooms/MatchCelebration.jsx')
  .then((m) => ({ default: m.MatchCelebration })), 'MatchCelebration'));
const ProfileEditor = lazy(retryChunk(() => import('../features/profile/ProfileEditor.jsx')
  .then((m) => ({ default: m.ProfileEditor })), 'ProfileEditor'));
const PublicProfileView = lazy(retryChunk(() => import('../features/profile/PublicProfileView.jsx')
  .then((m) => ({ default: m.PublicProfileView })), 'PublicProfileView'));
const DashboardView = lazy(retryChunk(() => import('../features/profile/DashboardView.jsx')
  .then((m) => ({ default: m.DashboardView })), 'DashboardView'));
const RouletteModal = lazy(retryChunk(() => import('../features/roulette/RouletteModal.jsx')
  .then((m) => ({ default: m.RouletteModal })), 'RouletteModal'));
const Onboarding = lazy(retryChunk(() => import('../features/onboarding/Onboarding.jsx')
  .then((m) => ({ default: m.Onboarding })), 'Onboarding'));

import { retryChunk, clearChunkReload } from '../lib/lazyChunk.js';
import { Toasts } from '../ui/Toasts.jsx';
import { ErrorBoundary } from '../ui/ErrorBoundary.jsx';
import { LoadingState, StatusStrip } from '../ui/States.jsx';
import { Radar } from '../ui/Radar.jsx';

import { ACTION, createEmptyProfile, hydrateProfile } from '../engine/tasteProfile.js';
import {
  loadUserState, subscribeUserState, recordReaction, toggleFavorite,
  undoDecision, markWatchedPersonal, rateTitle,
  applyLocalDecision, removeLocalDecision,
} from '../engine/userData.js';
import { buildRoomDeck, roomHistory } from '../engine/roomDeck.js';
import { getConfig, initRemoteConfig } from '../engine/recommendationConfig.js';
import { REWATCH } from '../../shared/config/moodPresets.js';
import { mergeRequestFilters } from '../../shared/ai/interpretation.js';
import { JOIN_SOURCE, roomExcludedTitles } from '../engine/rooms.js';

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
  /** «Я» — профиль и друзья под одной вкладкой. */
  ME: 'me',
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
  /** Какую половину раздела «Я» открыть — задаётся меню на большом экране. */
  const [meTab, setMeTab] = useState('profile');
  /** Каталог или актёры — на большом экране это два пункта меню. */
  const [collectionSection, setCollectionSection] = useState('catalog');
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
    /*
     * Приложение поднялось — значит перезагрузка после отвалившегося
     * чанка сработала. Снимаем отметку, иначе одна давняя неудача
     * навсегда запретила бы перезагрузку в этой вкладке.
     */
    clearChunkReload();

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
    /*
     * Колода больше не пересобирается сама при каждом входе участника:
     * пересборка стирала прогресс тех, кто уже свайпал. Её строят один
     * раз кнопкой в лобби, а дальше она только дописывается.
     */
    const key = `${room.code}:${memberCount}`;
    if (publishedFor.current === key) return;
    publishedFor.current = key;
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
    /** Опоры вкуса: конкретные любимые фильмы вместо усреднённой точки. */
    anchors: userState?.anchors ?? null,
    actorId: actorDeck?.id ?? null,
    roomDeck: deckMode === DECK_MODE.ROOM ? room.state?.deck : null,
    roomSwiped: deckMode === DECK_MODE.ROOM ? room.swipedTitleIds : null,
    /*
     * Колода не собирается, пока не приехала история решений: иначе
     * исключать нечего и всё отклонённое возвращается в ленту.
     */
    enabled: Boolean(userState) && (Boolean(user?.uid) || auth.isDegraded),
  });

  /*
   * Колода дописывается, пока в ней есть что смотреть.
   *
   * Публиковалась она один раз, и вдвоём её проходили за десяток свайпов —
   * «колода закончилась» приходило там, где раньше листали сотнями.
   * Заказ уходит заранее, за несколько карточек до конца, чтобы пауза
   * пришлась на чужой ход, а не на пустой экран.
   */
  const growingRef = useRef(false);
  /*
   * Пул каталога живёт между догрузками.
   *
   * Дорогой была не частота попыток, а то, что каждая начиналась с нуля:
   * новый пул, три сотни карточек, два десятка обогащений — и так на
   * каждые двадцать пять фильмов. Сохранённый пул листается дальше
   * с той страницы, где остановился, и очередная порция стоит один-два
   * запроса. Ограничивать число попыток поэтому не нужно: колода растёт,
   * пока в каталоге есть что показать, а каталог у TMDB — тысячи фильмов.
   */
  const growthPoolRef = useRef(null);

  // Своя комната и свои фильтры — свой пул: чужой отдал бы не те фильмы.
  useEffect(() => { growthPoolRef.current = null; }, [room.code, filters]);

  useEffect(() => {
    if (deckMode !== DECK_MODE.ROOM || !room.code || !room.state) return;
    if (growingRef.current) return;

    /*
     * Колода растёт, только когда порцию прошли ВСЕ.
     *
     * Упреждающая догрузка «за восемь карточек до конца» здесь не годится:
     * быстрый участник уехал бы вперёд на новую порцию, пока медленный
     * ещё в старой, и общая колода перестала бы быть общей. Тот, кто
     * закончил раньше, видит экран ожидания — это честная пауза, а не
     * пустой экран.
     */
    const { size, slowest } = room.progress;
    if (!size || slowest < size) return;

    growingRef.current = true;
    const published = (room.state.deck ?? []).map((t) => t.id ?? t.titleId).filter(Boolean);

    roomExcludedTitles(room.code)
      .catch(() => [])
      .then((excluded) => buildRoomDeck({
        consensus: room.consensus ?? taste,
        anchors: userState?.anchors ?? null,
        filters,
        history: roomHistory(room.state, user?.uid),
        excludeIds: [...published, ...excluded],
        pool: growthPoolRef.current,
        moodRequests: room.moodRequests,
      }))
      .then(({ deck: next, pool }) => {
        growthPoolRef.current = pool;
        // Длина, которую видели мы: если она изменилась, порцию уже дописал другой.
        return next.length ? room.growDeck(next, published.length) : null;
      })
      .catch(() => { /* следующая карточка попробует снова */ })
      .finally(() => { growingRef.current = false; });
    /*
     * `progress.slowest` в зависимостях обязателен.
     *
     * Раньше эффект ждал только изменения длины очереди — и этого хватало
     * ровно до первого случая, когда человек заканчивал пачку раньше
     * остальных. Очередь у него становилась нулевой, эффект срабатывал,
     * видел, что медленный ещё не дошёл, и выходил. Когда медленный
     * доходил, длина очереди уже была нулевой и НЕ МЕНЯЛАСЬ — эффект
     * не запускался больше никогда, и колода не росла. Со стороны это
     * выглядело как вечная загрузка.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckMode, room.code, deck.queue.length, room.progress.slowest, room.progress.size]);

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

    /*
     * Запись мэтча делает сама функция комнаты — и сразу всем участникам,
     * включая личное «буду смотреть». Дублировать её здесь значит писать
     * половину правды: у второго человека клиент этот код не выполняет.
     */
  }, [user?.uid, taste, deckMode, room]);

  /**
   * Отметка прямо из карточки фильма.
   *
   * В отличие от свайпа, это решение не идёт в комнату: карточку
   * открывают из каталога и от актёра, где никакого общего выбора нет.
   * Повторное нажатие снимает отметку — иначе поставленное по ошибке
   * сердце убрать неоткуда.
   */
  const handleToggleDecision = useCallback(async (title, action) => {
    const already = history[title.id] === action;
    if (already) {
      setUserState((prev) => removeLocalDecision(prev, title.id));
      const restored = await undoDecision({ uid: user?.uid, titleId: title.id, previousTaste: taste });
      setTaste(restored ?? taste);
      return;
    }

    setUserState((prev) => applyLocalDecision(prev, title, action));
    const nextTaste = await recordReaction({ uid: user?.uid, title, action, taste, surface: 'details' });
    setTaste(nextTaste);
  }, [history, user?.uid, taste]);

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
    toasts.push(`«${stub.title}» убран из понравившихся`);
  }, [user?.uid, taste, toasts]);

  const startActorDeck = useCallback((person) => {
    setActorDeck(person);
    setView(VIEW.DECK);
    haptic('medium');
    toasts.success(`Колода: ${person.name}`);
  }, [toasts]);

  /*
   * Комната создаётся пустой.
   *
   * Раньше колода собиралась в момент создания — по вкусу одного хоста,
   * ещё до того, как кто-то зашёл. Общей она при этом не была: второй
   * участник получал чужую подборку. Теперь сначала все собираются,
   * и только потом колода строится по компромиссу всех, кто внутри.
   */
  const createRoom = useCallback(
    () => room.create({ deck: [], filters }),
    [filters, room],
  );

  const [deckBuilding, setDeckBuilding] = useState(false);

  /** Собрать общую колоду по вкусам всех, кто сейчас в комнате. */
  const buildSharedDeck = useCallback(async () => {
    if (!room.code || deckBuilding) return;
    /*
     * Собирает только хост. Колода публикуется на всю комнату, и если
     * её пересоберёт второй участник, у первого прогресс обнулится
     * посреди сессии.
     */
    if (!room.isHost) return;

    setDeckBuilding(true);
    try {
      /*
       * Просмотренное и любимое всех участников выкидывается один раз,
       * здесь: показывать паре то, что кто-то из них уже видел, незачем,
       * а личная фильтрация при показе разъезжала общий порядок.
       */
      const rewatch = (room.moodRequests ?? []).some((r) => (r?.keys ?? r ?? []).includes(REWATCH));
      const excluded = await roomExcludedTitles(room.code, { keepFavorites: rewatch });

      /*
       * Жёсткие условия, названные словами, доезжают до каталога:
       * «не длиннее двух часов» — это запрос к выборке, а не оттенок
       * настроения, и решать его подкруткой весов было бы враньём.
       * Фильтры комнаты при этом главнее: их выставили осознанно
       * и заранее.
       */
      const asked = mergeRequestFilters(room.moodRequests ?? []);
      const { deck } = await buildRoomDeck({
        consensus: room.consensus ?? taste,
        anchors: userState?.anchors ?? null,
        filters: { ...asked, ...filters },
        history: roomHistory(room.state, user?.uid),
        excludeIds: excluded,
        moodRequests: room.moodRequests,
      });
      if (!deck.length) {
        toasts.error('Под эти фильтры ничего не нашлось. Ослабьте их и попробуйте снова.');
        return;
      }
      await room.setDeck(deck);
      toasts.success(`Колода готова: ${deck.length} фильмов`);
    } catch {
      toasts.error('Не удалось собрать общую колоду. Попробуйте ещё раз.');
    } finally {
      setDeckBuilding(false);
    }
  }, [room, deckBuilding, taste, filters, user?.uid, toasts]);

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
        <Suspense fallback={<LoadingState text="Загружаем…" />}>
          <Onboarding onDone={() => { setOnboarded(true); saveLocal(STORAGE_KEYS.ONBOARDED, true); }} />
        </Suspense>
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
    // Вместо иконки — аватар: собственное лицо узнаётся быстрее пиктограммы.
    { key: VIEW.ME, label: 'Я', icon: UserRound, avatar: sessionUser?.photoURL ?? null },
  ];

  /*
   * На большом экране меню длиннее дока, и прятать разделы за
   * переключателями незачем: каталог и актёры разъезжаются в отдельные
   * пункты, «Вместе» встаёт сразу под лентой.
   */
  const desktopNav = [
    { key: VIEW.DECK, label: 'Кино', icon: Flame },
    { key: VIEW.ROOMS, label: 'Вместе', icon: Users, badge: room.onlineCount > 1 ? room.onlineCount : 0 },
    {
      key: 'collection-catalog', label: 'Каталог', icon: Library,
      current: view === VIEW.COLLECTION && collectionSection === 'catalog',
      onSelect: () => { setCollectionSection('catalog'); navigate(VIEW.COLLECTION); },
    },
    {
      key: 'collection-stars', label: 'Актёры', icon: Star,
      current: view === VIEW.COLLECTION && collectionSection === 'stars',
      onSelect: () => { setCollectionSection('stars'); navigate(VIEW.COLLECTION); },
    },
    { key: VIEW.MINE, label: 'Моё', icon: Bookmark, badge: pendingInRoom || mineCount },
  ];

  // На большом экране профиль и друзья — два отдельных пункта меню.
  const secondaryNav = [
    {
      key: 'me-friends', label: 'Друзья', icon: Users,
      current: view === VIEW.ME && meTab === 'friends',
      onSelect: () => { setMeTab('friends'); navigate(VIEW.ME); },
    },
    {
      key: 'me-profile', label: 'Профиль', icon: UserRound,
      current: view === VIEW.ME && meTab === 'profile',
      onSelect: () => { setMeTab('profile'); navigate(VIEW.ME); },
    },
  ];

  const deckPanel = (
    <SwipeDeck
      deck={deck}
      compact={deckMode === DECK_MODE.ROOM}
      roomProgress={deckMode === DECK_MODE.ROOM ? room.progress : null}
      roomMembers={deckMode === DECK_MODE.ROOM ? room.members : null}
      nearMatches={deckMode === DECK_MODE.ROOM ? room.nearMatches : []}
      onRefreshNear={deckMode === DECK_MODE.ROOM ? room.refreshNearMatches : null}
      /*
       * Согласие — это обычный голос «за», а не отдельная сущность.
       * Мэтч после него срабатывает тем же путём, что и всегда: правило
       * «сошлись все» не обходится, просто человеку показали, что от него
       * зависит развязка.
       */
      onAgreeNear={deckMode === DECK_MODE.ROOM ? (async (item) => {
        const title = item.title?.title ? item.title : { id: item.titleId };
        const result = await room.swipe(title, ACTION.LIKE);
        await room.refreshNearMatches();
        if (!result?.matched) {
          toasts.success('Ваш голос учтён — ждём остальных');
        }
      }) : null}
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

  /*
   * Экраны из renderView тоже бывают отложенными — оборачиваем результат
   * целиком, а не каждый по отдельности: одновременно виден ровно один.
   */
  const content = renderView({
    view, room, sessionUser, userState, taste, prefs, toasts, history,
    setView, setPrefs, setActorDeck, setRoomSession, setDetailsEntry,
    focusPerson, createRoom, startActorDeck, handleToggleWatched,
    handleRemoveFavorite, handleUndoFromList, auth,
    setEditorOpen, publicProfile, setPublicProfile, meTab, collectionSection,
    desktopShell: platform.shell === 'desktop',
    buildSharedDeck, deckBuilding,
  });

  const statusStrip = renderStatus({
    online, room, roomSession, deckMode, auth, pendingWrites,
    onOpenRoom: () => navigate(VIEW.ROOMS),
  });

  const navigate = (key) => { haptic('select'); setActorDeck(null); setView(key); };
  const shellProps = { active: view, onNavigate: navigate, user: sessionUser, online };

  return (
    /*
     * Вес и размер по умолчанию задаются один раз. Экран, которому нужна
     * иная иконка, переопределяет их у себя, но ряд кнопок больше
     * не разъезжается оттого, что кто-то поставил размер на глаз.
     */
    <IconContext.Provider value={{ size: ICON.md, weight: 'regular' }}>
    <ErrorBoundary name="app-root">
      <div className="aurora" data-mood={room.celebration ? 'match' : room.code ? 'room' : undefined} />
      <div className="app-root">
        {platform.shell === 'desktop' ? (
          <DesktopStudio
            {...shellProps}
            nav={desktopNav}
            secondaryNav={secondaryNav}
            onOpenProfile={() => navigate(VIEW.ME)}
            title={view === VIEW.COLLECTION && collectionSection === 'stars'
              ? 'Актёры'
              : TITLES[view] ?? 'MatchWatch'}
            subtitle={SUBTITLES({ view, room, actorDeck })}
            onLogout={auth.logout}
            actions={view === VIEW.DECK && (
              <div className="row gap-2">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRouletteOpen(true)}>
                  <Dices size={16} /> Рулетка
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFiltersOpen(true)}>
                  <SlidersHorizontal size={16} /> Фильтры
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
              <div className="studio__content">
                <Suspense fallback={<LoadingState text="Загружаем…" />}>{content}</Suspense>
              </div>
            )}
          </DesktopStudio>
        ) : (
          <MobileShell
            {...shellProps}
            nav={nav}
            fixed={view === VIEW.DECK}
            statusStrip={statusStrip}
            right={view === VIEW.DECK && (
              <>
                <button type="button" className="hud__pill" onClick={() => setRouletteOpen(true)} aria-label="Кино-рулетка">
                  <Dices size={16} />
                </button>
                <button type="button" className="hud__pill" onClick={() => setFiltersOpen(true)} aria-label="Фильтры">
                  <SlidersHorizontal size={16} />
                </button>
              </>
            )}
          >
            {view === VIEW.DECK
              ? deckPanel
              : <Suspense fallback={<LoadingState text="Загружаем…" />}>{content}</Suspense>}
          </MobileShell>
        )}

        <Toasts toasts={toasts.toasts} onDismiss={toasts.dismiss} />

        {/* Один барьер на все отложенные оверлеи: они не показываются
            одновременно, и отдельный fallback для каждого только плодил бы
            мигающие заглушки. */}
        <Suspense fallback={null}>
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
          onToggleLike={(title) => handleToggleDecision(title, ACTION.FAVORITE)}
          isLiked={detailsEntry ? history[detailsEntry.title.id] === ACTION.FAVORITE : false}
          onToggleWish={(title) => handleToggleDecision(title, ACTION.LATER)}
          isWished={detailsEntry ? history[detailsEntry.title.id] === ACTION.LATER : false}
          isWatched={detailsEntry ? history[detailsEntry.title.id] === 'watched' : false}
          rating={detailsEntry ? (userState?.ratings?.[detailsEntry.title.id]?.rating ?? null) : null}
          onRate={handleRate}
          /*
           * Чего хотели сегодня — из своего же запроса, а не из чужих:
           * объяснение адресовано тому, кто открыл карточку.
           */
          wanted={room.myMood?.ai?.summary ?? null}
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
          taste={taste}
          onPick={(title) => setDetailsEntry({ id: title.id, title, matchedTags: [] })}
        />

        {room.celebration && (
          <MatchCelebration
            match={room.celebration}
            roomCode={room.code}
            partners={room.members.filter((m) => m.uid !== user?.uid)}
            onClose={room.dismissCelebration}
            onOpenWatchlist={() => { room.dismissCelebration(); setView(VIEW.MINE); }}
          />
        )}
        </Suspense>
      </div>
    </ErrorBoundary>
    </IconContext.Provider>
  );
}

const TITLES = {
  [VIEW.DECK]: 'Лента',
  [VIEW.COLLECTION]: 'Каталог',
  [VIEW.ROOMS]: 'Смотрим вместе',
  [VIEW.MINE]: 'Моё',
  [VIEW.ME]: 'Я',
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
    setEditorOpen, publicProfile, setPublicProfile, meTab, collectionSection, desktopShell,
    buildSharedDeck, deckBuilding,
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
          onOpenMember={(member) => { setPublicProfile(member); setView(VIEW.PUBLIC_PROFILE); }}
          onBuildDeck={buildSharedDeck}
          deckBuilding={deckBuilding}
        />
      );

    case VIEW.COLLECTION:
      return (
        <CollectionView
          key={collectionSection}
          initialSection={collectionSection}
          showTabs={!desktopShell}
          catalog={{ onOpenTitle: openDetails, history }}
          stars={{ onStartActorDeck: startActorDeck, onOpenTitle: openDetails, initialPersonId: focusPerson }}
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

    case VIEW.PUBLIC_PROFILE:
      return (
        <PublicProfileView
          username={typeof publicProfile === 'string' ? publicProfile : null}
          userId={typeof publicProfile === 'object' ? publicProfile?.uid : null}
          toasts={toasts}
          onBack={() => setView(publicProfile?.uid ? VIEW.ROOMS : VIEW.ME)}
        />
      );

    case VIEW.ME:
      return (
        <MeView
          key={meTab}
          initialTab={meTab}
          showTabs={!desktopShell}
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
          onOpenPublicProfile={(username) => { setPublicProfile(username); setView(VIEW.PUBLIC_PROFILE); }}
          auth={auth}
          toasts={toasts}
        />
      );

    case VIEW.DASHBOARD:
      return <DashboardView onBack={() => setView(VIEW.ME)} />;

    default:
      // Лента рисуется шеллом напрямую — сюда попадать не должны.
      return null;
  }
}

/** Строка состояния: сеть, комната, режим колоды. Молчание — худший UX. */
function renderStatus({ online, room, roomSession, deckMode, auth, pendingWrites, onOpenRoom }) {
  /*
   * У каждой строки свой ключ: он же ключ React-элемента. Смена ключа
   * пересоздаёт компонент, а вместе с ним и состояние «закрыто» —
   * иначе однажды скрытое уведомление не показалось бы и тогда,
   * когда случилось что-то новое.
   */
  if (!online) {
    return (
      <StatusStrip key="offline" tone="error" dismissible={false}>
        Нет соединения. Отметки сохраняются и уедут в базу, когда сеть вернётся.
      </StatusStrip>
    );
  }

  // Сеть есть, но что-то ещё не доехало — честно показываем, а не молчим.
  if (pendingWrites > 0) {
    return (
      <StatusStrip key="pending" tone="warn" dismissible={false}>
        Досылаем {pendingWrites} {pendingWrites === 1 ? 'отметку' : 'отметок'} в базу…
      </StatusStrip>
    );
  }
  if (auth.isDegraded) {
    return <StatusStrip key="degraded" tone="warn">{auth.error?.text}</StatusStrip>;
  }
  if (room.error) {
    return <StatusStrip key={`room-error:${room.error.message}`} tone="error">{room.error.message}</StatusStrip>;
  }
  if (deckMode === 'room' && roomSession) {
    return (
      <StatusStrip
        key={`room:${room.code}`}
        tone="live"
        action={{ label: 'В комнату', onClick: onOpenRoom }}
      >
        Комната {room.code} · {room.onlineCount} в сети · общая колода
      </StatusStrip>
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
