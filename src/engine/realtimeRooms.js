// MatchWatch 3 — Resilient Realtime Room Sync Engine
import { auth, database } from "../firebase.js";
import { ref, set, get, onValue } from "firebase/database";
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { generateRoomCompromiseDeck } from "./recommendationEngine.js";
import { movies } from "../data/movies.js";

// Active in-memory room for local offline/mock or fallback sync
let activeRoomState = null;
const globalListeners = new Set();
const roomSpecificListeners = new Map(); // roomCode -> Set of callbacks
let activeRtdbUnsubscribe = null;

const ensureAuth = async (user = null) => {
  if (!auth) return;
  if (auth.currentUser) return auth.currentUser;

  const rawId = user?.id || user?.tgId || 'guest_' + Math.random().toString(36).slice(2, 8);
  const email = `tg_${rawId}@matchwatch.internal`;
  const pass = `mw_tg_secret_${rawId}_pass!`;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  } catch (_e1) {
    try {
      const newCred = await createUserWithEmailAndPassword(auth, email, pass);
      return newCred.user;
    } catch (_e2) {
      try {
        const anonCred = await signInAnonymously(auth);
        return anonCred.user;
      } catch (_e3) {
        // Fallback for offline/in-memory mode
      }
    }
  }
};

/**
 * Generates a 4-character uppercase alphanumeric room code
 */
export const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Sanitizes an array input that might be null, an object with numeric keys from RTDB, or sparse
 */
const sanitizeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'object') return Object.values(val).filter(Boolean);
  return [];
};

/**
 * Normalizes likes input into flat array of movie IDs (numbers)
 */
const normalizeLikes = (likes) => {
  if (!likes) return [];
  if (Array.isArray(likes)) {
    return likes
      .map((item) => (typeof item === 'object' && item?.id != null ? Number(item.id) : Number(item)))
      .filter((n) => !isNaN(n) && n > 0);
  }
  if (typeof likes === 'object') {
    return Object.entries(likes)
      .filter(([_, val]) => val === true || val === 'like' || val === 'liked' || (val && val.id != null))
      .map(([key, val]) => (val && typeof val === 'object' && val.id != null ? Number(val.id) : Number(key)))
      .filter((n) => !isNaN(n) && n > 0);
  }
  return [];
};

/**
 * Hydrates movie ID or sparse movie object to full MovieItem
 */
const sanitizeMovie = (item) => {
  if (!item) return null;
  if (typeof item === 'number' || typeof item === 'string') {
    const id = Number(item);
    return movies.find((m) => m.id === id) || null;
  }
  if (typeof item === 'object' && item.id != null) {
    const matched = movies.find((m) => m.id === item.id);
    return matched ? { ...matched, ...item } : item;
  }
  return item;
};

/**
 * Sanitizes full room data from RTDB or in-memory snapshot
 */
const sanitizeRoomData = (raw) => {
  if (!raw) return null;

  const rawMembers = sanitizeArray(raw.members);
  const rawDeck = sanitizeArray(raw.deck).map(sanitizeMovie).filter(Boolean);
  const rawMatches = sanitizeArray(raw.matches).map((m) => {
    if (!m) return null;
    return {
      ...m,
      matched: true,
      movieId: m.movieId || m.movie?.id,
      movie: sanitizeMovie(m.movie || m.movieId)
    };
  }).filter(Boolean);

  const members = rawMembers.map((m, idx) => ({
    id: m.id || (m.isHost ? "host-1" : `guest-${idx}`),
    name: m.name || (m.isHost ? "Вы (Создатель)" : "Киноман"),
    avatar: m.avatar || (m.isHost ? "👑" : "🍿"),
    isHost: Boolean(m.isHost),
    likes: normalizeLikes(m.likes),
    progress: typeof m.progress === 'number' ? m.progress : 0,
    online: m.online !== undefined ? Boolean(m.online) : true
  }));

  const host = raw.host || members.find((m) => m.isHost) || members[0] || null;

  return {
    code: (raw.code || raw.roomCode || "").toUpperCase(),
    preset: raw.preset || "compromise_25",
    createdAt: raw.createdAt || Date.now(),
    host,
    members,
    deck: rawDeck,
    matches: rawMatches,
    status: raw.status || "waiting",
    customFilters: raw.customFilters || {}
  };
};

/**
 * Notifies all active subscribers of room updates
 */
const notifyListeners = () => {
  const snapshot = activeRoomState ? { ...activeRoomState } : null;

  globalListeners.forEach((cb) => {
    try { cb(snapshot); } catch (e) { console.error("Global room listener error:", e); }
  });

  if (activeRoomState?.code && roomSpecificListeners.has(activeRoomState.code)) {
    const specificSet = roomSpecificListeners.get(activeRoomState.code);
    specificSet.forEach((cb) => {
      try { cb(snapshot); } catch (e) { console.error("Room specific listener error:", e); }
    });
  }
};

/**
 * Returns current authenticated user or local guest fallback
 */
export const getCurrentUser = () => {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mw3_guest_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) return parsed;
      }
    }
  } catch (e) {}

  return {
    id: 'guest_user',
    name: 'Киноман',
    username: 'cinephile',
    avatar: '🍿',
    likes: []
  };
};

/**
 * Returns active room state
 */
export const getActiveRoom = () => {
  return activeRoomState ? { ...activeRoomState } : null;
};

/**
 * Subscribes to room updates (supports both global and room-specific subscriptions)
 */
export const subscribeToRoom = (roomCodeOrCallback, maybeCallback) => {
  let roomCode = null;
  let callback = null;

  if (typeof roomCodeOrCallback === 'function') {
    callback = roomCodeOrCallback;
  } else if (typeof roomCodeOrCallback === 'string' && typeof maybeCallback === 'function') {
    roomCode = roomCodeOrCallback.toUpperCase().trim();
    callback = maybeCallback;
  }

  if (!callback) return () => {};

  if (roomCode) {
    if (!roomSpecificListeners.has(roomCode)) {
      roomSpecificListeners.set(roomCode, new Set());
    }
    roomSpecificListeners.get(roomCode).add(callback);

    // Initial invoke
    if (activeRoomState && activeRoomState.code === roomCode) {
      callback({ ...activeRoomState });
    } else {
      callback(null);
    }

    let rtdbUnsub = null;
    if (database) {
      try {
        const roomRef = ref(database, `matchRooms/${roomCode}`);
        rtdbUnsub = onValue(roomRef, (snap) => {
          if (snap.exists()) {
            const sanitized = sanitizeRoomData(snap.val());
            callback(sanitized);
          }
        }, (err) => {
          console.warn("RTDB subscribe warning:", err);
        });
      } catch (e) {
        console.warn("RTDB subscribe exception:", e);
      }
    }

    return () => {
      if (roomSpecificListeners.has(roomCode)) {
        roomSpecificListeners.get(roomCode).delete(callback);
        if (roomSpecificListeners.get(roomCode).size === 0) {
          roomSpecificListeners.delete(roomCode);
        }
      }
      if (rtdbUnsub) {
        try { rtdbUnsub(); } catch (e) {}
      }
    };
  } else {
    globalListeners.add(callback);
    callback(activeRoomState ? { ...activeRoomState } : null);
    return () => globalListeners.delete(callback);
  }
};

/**
 * Creates a new room (supports object and positional parameters)
 */
export const createRoom = async (optionsOrUser = {}, maybePreset, maybeCustomFilters) => {
  let hostUser = null;
  let preset = "compromise_25";
  let customFilters = {};

  if (optionsOrUser && (optionsOrUser.hostUser || optionsOrUser.user)) {
    hostUser = optionsOrUser.hostUser || optionsOrUser.user;
    preset = optionsOrUser.preset || maybePreset || "compromise_25";
    customFilters = optionsOrUser.customFilters || maybeCustomFilters || {};
  } else if (optionsOrUser && (optionsOrUser.id || optionsOrUser.name)) {
    hostUser = optionsOrUser;
    preset = maybePreset || "compromise_25";
    customFilters = maybeCustomFilters || {};
  } else {
    hostUser = getCurrentUser();
    preset = maybePreset || "compromise_25";
    customFilters = maybeCustomFilters || {};
  }

  const roomCode = generateRoomCode();
  const hostLikes = normalizeLikes(hostUser.likes);
  const deck = generateRoomCompromiseDeck(hostLikes, [], customFilters);

  const initialRoom = {
    code: roomCode,
    preset,
    createdAt: Date.now(),
    host: {
      id: hostUser.id || "host-1",
      name: hostUser.name || "Вы (Создатель)",
      avatar: hostUser.avatar || "👑",
      likes: hostLikes
    },
    members: [
      {
        id: hostUser.id || "host-1",
        name: hostUser.name || "Вы (Создатель)",
        avatar: hostUser.avatar || "👑",
        isHost: true,
        likes: hostLikes,
        progress: 0,
        online: true
      }
    ],
    deck,
    matches: [],
    status: "waiting",
    customFilters
  };

  activeRoomState = initialRoom;
  notifyListeners();

  if (database) {
    try {
      await ensureAuth();
      const roomRef = ref(database, `matchRooms/${roomCode}`);
      await set(roomRef, initialRoom);

      if (activeRtdbUnsubscribe) {
        try { activeRtdbUnsubscribe(); } catch (e) {}
      }

      activeRtdbUnsubscribe = onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
          const updated = sanitizeRoomData(snapshot.val());
          activeRoomState = updated;
          notifyListeners();
        }
      });
    } catch (e) {
      console.warn("Firebase createRoom sync warning (using in-memory):", e);
    }
  }

  return { ...activeRoomState };
};

/**
 * Joins an existing room (supports object and positional parameters)
 */
export const joinRoom = async (optionsOrCode, maybeUser) => {
  let roomCode = "";
  let guestUser = null;

  if (typeof optionsOrCode === 'object' && optionsOrCode !== null) {
    roomCode = optionsOrCode.roomCode || optionsOrCode.code || "";
    guestUser = optionsOrCode.user || optionsOrCode.guestUser || maybeUser || getCurrentUser();
  } else {
    roomCode = String(optionsOrCode || "");
    guestUser = maybeUser || getCurrentUser();
  }

  const code = roomCode.toUpperCase().trim();
  const guestLikes = normalizeLikes(guestUser.likes);

  if (database && code) {
    try {
      await ensureAuth();
      const roomRef = ref(database, `matchRooms/${code}`);
      const snap = await get(roomRef);

      if (snap.exists()) {
        const roomData = sanitizeRoomData(snap.val());
        const existingMemberIndex = roomData.members.findIndex((m) => m.id === guestUser.id);

        if (existingMemberIndex >= 0) {
          roomData.members[existingMemberIndex].online = true;
          roomData.members[existingMemberIndex].likes = guestLikes;
        } else {
          roomData.members.push({
            id: guestUser.id || `guest-${Date.now()}`,
            name: guestUser.name || "Кино-партнер",
            avatar: guestUser.avatar || "🍿",
            isHost: false,
            likes: guestLikes,
            progress: 0,
            online: true
          });
        }

        roomData.status = "active";

        const hostMember = roomData.members.find((m) => m.isHost) || roomData.members[0];
        const hostLikes = hostMember?.likes || [];
        roomData.deck = generateRoomCompromiseDeck(hostLikes, guestLikes, roomData.customFilters);

        await set(roomRef, roomData);
        activeRoomState = roomData;
        notifyListeners();

        if (activeRtdbUnsubscribe) {
          try { activeRtdbUnsubscribe(); } catch (e) {}
        }
        activeRtdbUnsubscribe = onValue(roomRef, (snapshot) => {
          if (snapshot.exists()) {
            const updated = sanitizeRoomData(snapshot.val());
            activeRoomState = updated;
            notifyListeners();
          }
        });

        return { ...activeRoomState };
      }
    } catch (e) {
      console.warn("Firebase joinRoom sync warning (using in-memory fallback):", e);
    }
  }

  // In-memory fallback
  if (activeRoomState && activeRoomState.code === code) {
    const existing = activeRoomState.members.find((m) => m.id === guestUser.id);
    if (!existing) {
      activeRoomState.members.push({
        id: guestUser.id || `guest-${Date.now()}`,
        name: guestUser.name || "Кино-партнер",
        avatar: guestUser.avatar || "🍿",
        isHost: false,
        likes: guestLikes,
        progress: 0,
        online: true
      });
      activeRoomState.status = "active";

      const hostLikes = activeRoomState.members[0]?.likes || [];
      activeRoomState.deck = generateRoomCompromiseDeck(hostLikes, guestLikes, activeRoomState.customFilters);
    }
    notifyListeners();
    return { ...activeRoomState };
  }

  // Paired test room simulation fallback
  const dummyHostLikes = [1, 2, 5, 8, 12];
  const deck = generateRoomCompromiseDeck(dummyHostLikes, guestLikes);

  activeRoomState = {
    code,
    preset: "compromise_25",
    createdAt: Date.now(),
    host: { id: "host-sim", name: "Александр (Друг)", avatar: "🎬", likes: dummyHostLikes },
    members: [
      { id: "host-sim", name: "Александр (Друг)", avatar: "🎬", isHost: true, likes: dummyHostLikes, progress: 3, online: true },
      { id: guestUser.id || "guest-1", name: guestUser.name || "Вы", avatar: guestUser.avatar || "🍿", isHost: false, likes: guestLikes, progress: 0, online: true }
    ],
    deck,
    matches: [],
    status: "active",
    customFilters: {}
  };

  notifyListeners();
  return { ...activeRoomState };
};

/**
 * Records a swipe event synchronously for the caller while updating RTDB in background
 */
export const recordRoomSwipe = (optionsOrMovieId, maybeLiked, maybeUserId, maybeRoomCode) => {
  let movieId = null;
  let liked = true;
  let userId = null;
  let roomCode = null;

  if (typeof optionsOrMovieId === 'object' && optionsOrMovieId !== null) {
    movieId = optionsOrMovieId.movieId || optionsOrMovieId.id;
    liked = optionsOrMovieId.liked !== undefined
      ? Boolean(optionsOrMovieId.liked)
      : (optionsOrMovieId.decision === 'like' || optionsOrMovieId.decision === 'superlike');
    userId = optionsOrMovieId.userId || optionsOrMovieId.user?.id;
    roomCode = optionsOrMovieId.roomCode || optionsOrMovieId.code;
  } else {
    movieId = optionsOrMovieId;
    liked = maybeLiked !== undefined ? Boolean(maybeLiked) : true;
    userId = maybeUserId;
    roomCode = maybeRoomCode;
  }

  if (!movieId || !activeRoomState) return null;

  const numMovieId = Number(movieId);

  const member = (userId ? activeRoomState.members.find((m) => m.id === userId) : null) || activeRoomState.members[0];
  if (member) {
    member.progress = (member.progress || 0) + 1;
    if (liked) {
      if (!Array.isArray(member.likes)) member.likes = [];
      if (!member.likes.includes(numMovieId)) {
        member.likes.push(numMovieId);
      }
    }
  }

  let newMatch = null;
  if (liked && activeRoomState.members.length >= 2) {
    const allMembersLiked = activeRoomState.members.every((m) =>
      Array.isArray(m.likes) && m.likes.includes(numMovieId)
    );
    const alreadyMatched = activeRoomState.matches.some((m) => m.movieId === numMovieId);

    if (allMembersLiked && !alreadyMatched) {
      const movieObj = activeRoomState.deck.find((m) => m.id === numMovieId) ||
                       movies.find((m) => m.id === numMovieId) ||
                       { id: numMovieId, title: `Movie #${numMovieId}` };

      newMatch = {
        matched: true,
        movieId: numMovieId,
        movie: movieObj,
        timestamp: Date.now(),
        users: activeRoomState.members.map((m) => m.name)
      };
      activeRoomState.matches.push(newMatch);
    }
  }

  notifyListeners();

  if (database && activeRoomState.code) {
    const currentCode = activeRoomState.code;
    const roomRef = ref(database, `matchRooms/${currentCode}`);
    set(roomRef, activeRoomState).catch((err) => {
      console.warn("RTDB swipe update error:", err);
    });
  }

  return newMatch;
};

/**
 * Leaves the active room
 */
export const leaveRoom = async (roomCodeOrOptions, maybeUserId) => {
  let roomCode = null;
  let userId = null;

  if (typeof roomCodeOrOptions === 'object' && roomCodeOrOptions !== null) {
    roomCode = roomCodeOrOptions.roomCode || roomCodeOrOptions.code || (activeRoomState ? activeRoomState.code : null);
    userId = roomCodeOrOptions.userId || roomCodeOrOptions.user?.id || maybeUserId;
  } else {
    roomCode = roomCodeOrOptions || (activeRoomState ? activeRoomState.code : null);
    userId = maybeUserId;
  }

  if (activeRtdbUnsubscribe) {
    try { activeRtdbUnsubscribe(); } catch (e) {}
    activeRtdbUnsubscribe = null;
  }

  if (database && roomCode && userId) {
    try {
      const roomRef = ref(database, `matchRooms/${roomCode}`);
      const snap = await get(roomRef);
      if (snap.exists()) {
        const roomData = sanitizeRoomData(snap.val());
        roomData.members = roomData.members.filter((m) => m.id !== userId);
        if (roomData.members.length === 0) {
          roomData.status = "completed";
        }
        await set(roomRef, roomData);
      }
    } catch (e) {
      console.warn("RTDB leaveRoom warning:", e);
    }
  }

  activeRoomState = null;
  notifyListeners();
};
