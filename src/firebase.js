// MatchWatch v2 — Firebase Module
// Complete rewrite: auth, database, rooms, friends, invites, profiles

import { initializeApp } from "firebase/app";
import {
  getDatabase, ref, set, get, onValue, update, remove
} from "firebase/database";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile
} from "firebase/auth";
import { movies, moviesById } from "./data";
import { generateMatchWatchPairDeck } from "./recommendations";

const getEnv = (key) => {
  if (typeof process !== "undefined" && process.env) {
    if (process.env[key]) return process.env[key];
    const reactKey = "REACT_APP_" + key.replace("VITE_", "");
    if (process.env[reactKey]) return process.env[reactKey];
  }
  return "";
};

// ─── Firebase Config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            getEnv("VITE_FIREBASE_API_KEY")            || "AIzaSyCQHQAL7LiMUQ8PkLeg-qePibn0M3FuqPA",
  authDomain:        getEnv("VITE_FIREBASE_AUTH_DOMAIN")        || "match-watch-f9eec.firebaseapp.com",
  databaseURL:       getEnv("VITE_FIREBASE_DATABASE_URL")       || "https://match-watch-f9eec-default-rtdb.firebaseio.com",
  projectId:         getEnv("VITE_FIREBASE_PROJECT_ID")         || "match-watch-f9eec",
  storageBucket:     getEnv("VITE_FIREBASE_STORAGE_BUCKET")     || "match-watch-f9eec.firebasestorage.app",
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID") || "896259439383",
  appId:             getEnv("VITE_FIREBASE_APP_ID")             || "1:896259439383:web:e242ba183ba638a40a1552",
  measurementId:     getEnv("VITE_FIREBASE_MEASUREMENT_ID")     || "G-FS2CDSSF16"
};

let app, database, auth;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase is not fully configured yet. Please add your credentials.");
}

export { auth, database, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signOut, updateProfile };

// ─── Utility: Tag Key ─────────────────────────────────────────────
const sanitizeRtdbKey = (str) => (str || '').replace(/[.$[\]/#]/g, '_');
const getTagKey = (tag) => sanitizeRtdbKey(tag).replace('#', '-');

// ─── Telegram Auth ────────────────────────────────────────────────
export const signInWithTelegram = async (tgUser) => {
  const rawTgId = tgUser?.id || tgUser?.tgId;
  if (!auth || !database || !tgUser || !rawTgId) return null;

  const tgEmail = `tg_${rawTgId}@matchwatch.internal`;
  const tgPassword = `mw_tg_secret_${rawTgId}_pass!`;

  try {
    let currentUser = null;
    try {
      const userCred = await signInWithEmailAndPassword(auth, tgEmail, tgPassword);
      currentUser = userCred.user;
    } catch (_signInErr) {
      const newCred = await createUserWithEmailAndPassword(auth, tgEmail, tgPassword);
      currentUser = newCred.user;
    }

    const baseTag = tgUser.username ? `@${tgUser.username}` : (tgUser.name || "User");
    const rawCleanTag = baseTag.startsWith('@') ? baseTag : `${baseTag}#${String(rawTgId).slice(-4)}`;
    const cleanTag = sanitizeRtdbKey(rawCleanTag);

    try {
      await updateProfile(currentUser, {
        displayName: cleanTag,
        photoURL: tgUser.photoUrl || null
      });
    } catch (_e) { /* non-critical */ }

    try {
      await set(ref(database, `userTags/${getTagKey(cleanTag)}`), currentUser.uid);
    } catch (_e) { /* non-critical */ }

    try {
      await update(ref(database, `users/${currentUser.uid}/profile`), {
        tag: cleanTag,
        tgId: rawTgId,
        username: tgUser.username || "",
        firstName: tgUser.firstName || "",
        lastName: tgUser.lastName || "",
        photoUrl: tgUser.photoUrl || null,
        name: tgUser.name,
        avatar: tgUser.photoUrl ? '📷' : '✈️',
        authProvider: 'telegram',
        updatedAt: Date.now()
      });
    } catch (_e) { /* non-critical */ }

    return currentUser;
  } catch (e) {
    console.error("Telegram Firebase login error:", e);
    throw e;
  }
};

// ─── Telegram Auth Tokens (Web Flow) ──────────────────────────────
export const createTelegramAuthToken = async () => {
  const code = 'login_' + Math.random().toString(36).substring(2, 9);
  if (database) {
    try {
      await set(ref(database, `authTokens/${code}`), { status: 'pending', createdAt: Date.now() });
    } catch (_e) { /* non-critical */ }
  }
  return code;
};

export const listenToTelegramAuthToken = (code, onSuccess) => {
  if (!code) return () => {};
  let intervalId = null;
  let active = true;

  const handleApprovedToken = async (val) => {
    if (val && val.status === 'approved' && active) {
      active = false;
      if (intervalId) clearInterval(intervalId);
      try {
        const user = await signInWithTelegram(val);
        if (user && onSuccess) onSuccess(user);
      } catch (_e) { /* handled upstream */ }
    }
  };

  let unsubscribe = () => {};
  if (database) {
    try {
      const tokenRef = ref(database, `authTokens/${code}`);
      unsubscribe = onValue(tokenRef, (snapshot) => {
        handleApprovedToken(snapshot.val());
      });
    } catch (_e) { /* non-critical */ }
  }

  // Polling fallback
  const checkRest = async () => {
    if (!active) return;
    try {
      const res = await fetch(`${firebaseConfig.databaseURL}/authTokens/${code}.json`);
      if (res.ok) handleApprovedToken(await res.json());
    } catch (_e) { /* retry */ }
  };

  checkRest();
  intervalId = setInterval(checkRest, 1200);

  return () => {
    active = false;
    if (intervalId) clearInterval(intervalId);
    try { unsubscribe(); } catch (_e) { /* ok */ }
  };
};

// ─── Username & User Tags ──────────────────────────────────────────
export const sanitizeUsername = (raw) => {
  return (raw || '').toLowerCase().replace(/[^a-z0-9_]/g, '').substring(0, 20);
};

export const checkUsernameAvailability = async (username) => {
  if (!database) return false;
  const clean = sanitizeUsername(username);
  if (clean.length < 3) throw new Error("Username должен содержать от 3 символов (a-z, 0-9, _)");
  const snap = await get(ref(database, `usernames/${clean}`));
  return !snap.exists();
};

export const updateUsernameAndName = async (user, displayName, rawUsername) => {
  if (!user) throw new Error("Пользователь не авторизован");
  const cleanUsername = sanitizeUsername(rawUsername);
  if (cleanUsername.length < 3) throw new Error("Имя пользователя (username) должно содержать минимум 3 символа на английском (a-z0-9_)");
  
  const cleanDisplayName = (displayName || "").trim();
  if (!cleanDisplayName) throw new Error("Укажите ваше имя");

  // Local sync to prevent UI lockup
  try {
    localStorage.setItem("mw_local_name", cleanDisplayName);
    localStorage.setItem("mw_local_username", cleanUsername);
  } catch (_e) { /* ok */ }

  if (database) {
    try {
      // 1. Try to index username in userTags & usernames
      await set(ref(database, `userTags/${cleanUsername}`), user.uid);
      await set(ref(database, `usernames/${cleanUsername}`), user.uid);
    } catch (permErr) {
      console.warn("Index node permission bypass:", permErr);
    }

    try {
      // 2. Main profile update inside user's own path /users/${user.uid}/profile
      await update(ref(database, `users/${user.uid}/profile`), {
        name: cleanDisplayName,
        username: cleanUsername,
        tag: `@${cleanUsername}`,
        updatedAt: Date.now()
      });
    } catch (profileErr) {
      console.warn("Profile update warning:", profileErr);
    }
  }

  // 3. Auth Profile update
  try {
    await updateProfile(user, { displayName: `${cleanDisplayName} (@${cleanUsername})` });
  } catch (_authErr) { /* non-critical */ }

  return { name: cleanDisplayName, username: cleanUsername };
};

export const getPublicProfileByUsername = async (identifier) => {
  if (!identifier || !database) return null;
  const cleanId = sanitizeUsername(identifier.replace('@', ''));
  
  let targetUid = null;

  // 1. Check usernames index node
  try {
    const usernameSnap = await get(ref(database, `usernames/${cleanId}`));
    if (usernameSnap.exists()) {
      targetUid = usernameSnap.val();
    }
  } catch (_e) { /* permission bypass */ }

  // 2. Check legacy userTags index node
  if (!targetUid) {
    try {
      const tagSnap = await get(ref(database, `userTags/${getTagKey(identifier)}`));
      if (tagSnap.exists()) {
        targetUid = tagSnap.val();
      }
    } catch (_e) { /* permission bypass */ }
  }

  // 3. Scan Realtime Database /users node to find actual target user ID
  if (!targetUid) {
    try {
      const usersSnap = await get(ref(database, 'users'));
      if (usersSnap.exists()) {
        const usersData = usersSnap.val();
        for (const [uid, uData] of Object.entries(usersData)) {
          const uProf = uData?.profile || {};
          const uUsername = (uProf.username || '').toLowerCase();
          const uTag = (uProf.tag || '').toLowerCase();
          const uName = (uProf.name || '').toLowerCase();

          if (uUsername === cleanId || uTag === `@${cleanId}` || uTag === identifier.toLowerCase() || uName.toLowerCase() === cleanId) {
            targetUid = uid;
            break;
          }
        }
      }
    } catch (usersErr) {
      console.warn("Direct users scan warning:", usersErr);
    }
  }

  if (!targetUid) return null;

  try {
    const profileSnap = await get(ref(database, `users/${targetUid}/profile`));
    const appDataSnap = await get(ref(database, `users/${targetUid}/appData`));

    const prof = profileSnap.val();
    if (!prof) return null;

    return {
      uid: targetUid,
      profile: prof,
      appData: appDataSnap.val() || {}
    };
  } catch (err) {
    console.error("Error loading user profile:", err);
    return null;
  }
};
export const registerWithTag = async (email, password, baseName, customUsername = null) => {
  const cleanUsername = sanitizeUsername(customUsername || baseName);
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCred.user;

  await updateUsernameAndName(user, baseName, cleanUsername);
  return userCred;
};

export const generateUniqueTag = async (baseName) => {
  return `@${sanitizeUsername(baseName)}`;
};

export const migrateLegacyUser = async (user, baseName, username) => {
  return await updateUsernameAndName(user, baseName, username);
};

export const updateUserTag = async (user, baseName, username) => {
  return await updateUsernameAndName(user, baseName, username);
};

export const sendFriendRequest = async (currentUid, currentTag, targetIdentifier) => {
  if (!database || !currentUid) throw new Error("Пользователь не авторизован");
  const cleanId = sanitizeUsername(targetIdentifier.replace('@', ''));

  let targetUid = null;

  try {
    // 1. Try username lookup first
    const usernameSnap = await get(ref(database, `usernames/${cleanId}`));
    if (usernameSnap.exists()) {
      targetUid = usernameSnap.val();
    }
  } catch (_e) { /* index bypass */ }

  if (!targetUid) {
    try {
      // 2. Try legacy userTags lookup
      const tagSnap = await get(ref(database, `userTags/${getTagKey(targetIdentifier)}`));
      if (tagSnap.exists()) {
        targetUid = tagSnap.val();
      }
    } catch (_e) { /* index bypass */ }
  }

  // 3. Fallback: Search inside /users node directly if indexes missing
  if (!targetUid) {
    try {
      const usersSnap = await get(ref(database, 'users'));
      if (usersSnap.exists()) {
        const usersData = usersSnap.val();
        for (const [uid, uData] of Object.entries(usersData)) {
          const uProf = uData?.profile || {};
          const uUsername = (uProf.username || '').toLowerCase();
          const uTag = (uProf.tag || '').toLowerCase();
          const uName = (uProf.name || '').toLowerCase();

          if (uUsername === cleanId || uTag === `@${cleanId}` || uTag === targetIdentifier.toLowerCase()) {
            targetUid = uid;
            break;
          }
        }
      }
    } catch (_e) { /* direct query fallback */ }
  }

  if (!targetUid) throw new Error("Пользователь с таким именем не найден");
  if (targetUid === currentUid) throw new Error("Нельзя добавить самого себя");

  const friendSnap = await get(ref(database, `users/${currentUid}/friends/${targetUid}`));
  if (friendSnap.exists()) throw new Error("Вы уже друзья");

  await set(ref(database, `users/${targetUid}/friendRequests/${currentUid}`), currentTag || "Друг");
};

export const acceptFriendRequest = async (currentUid, currentTag, requesterUid, requesterTag) => {
  const updates = {};
  updates[`users/${currentUid}/friends/${requesterUid}`] = requesterTag;
  updates[`users/${requesterUid}/friends/${currentUid}`] = currentTag;
  updates[`users/${currentUid}/friendRequests/${requesterUid}`] = null;
  await update(ref(database), updates);
};

export const rejectFriendRequest = async (currentUid, requesterUid) => {
  await remove(ref(database, `users/${currentUid}/friendRequests/${requesterUid}`));
};

export const removeFriend = async (currentUid, targetUid) => {
  const updates = {};
  updates[`users/${currentUid}/friends/${targetUid}`] = null;
  updates[`users/${targetUid}/friends/${currentUid}`] = null;
  await update(ref(database), updates);
};

// ─── Invites ──────────────────────────────────────────────────────
export const inviteToMatchWatch = async (targetUid, roomCode, currentTag) => {
  await set(ref(database, `users/${targetUid}/invites/${roomCode}`), {
    from: currentTag,
    timestamp: Date.now()
  });
};

export const removeInvite = async (currentUid, roomCode) => {
  await remove(ref(database, `users/${currentUid}/invites/${roomCode}`));
};

// ─── Genre Filtering Helpers ──────────────────────────────────────
const normalizeStopGenres = (sg) => {
  if (!sg) return [];
  let arr = [];
  if (Array.isArray(sg)) arr = sg;
  else if (typeof sg === 'object') arr = Object.values(sg);
  else if (typeof sg === 'string') arr = [sg];
  return arr.filter(item => typeof item === 'string' && item.trim() !== "");
};

// ─── Anonymous Auth Helper for Database Writes ───────────────────
export const ensureAuthenticated = async () => {
  if (!auth) return null;
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn("Anonymous auth fallback:", err);
    }
  }
  return auth.currentUser;
};

// ─── Match Rooms ──────────────────────────────────────────────────
export const createMatchRoom = async (hostName, filters = {}, hostDecisions = {}, hostFavorites = {}) => {
  if (!database) return null;
  await ensureAuthenticated();
  
  // 6-digit numeric room code (e.g., 482910)
  const roomCode = Math.floor(100000 + Math.random() * 900000).toString();

  const roomPayload = {
    hostUid: auth?.currentUser?.uid || null,
    hostName,
    hostReady: false,
    guestReady: false,
    status: "lobby", // lobby -> active -> finished
    filters: filters || {},
    createdAt: Date.now(),
    hostLikes: {},
    guestLikes: {},
    hostDislikes: {},
    guestDislikes: {},
    matches: {}
  };

  if (hostDecisions && Object.keys(hostDecisions).length > 0) roomPayload.hostDecisions = hostDecisions;
  if (hostFavorites && Object.keys(hostFavorites).length > 0) roomPayload.hostFavorites = hostFavorites;

  try {
    await set(ref(database, `matchRooms/${roomCode}`), roomPayload);
  } catch (err) {
    console.warn("RTDB write to matchRooms failed (PERMISSION_DENIED):", err);
    try {
      await signInAnonymously(auth);
      roomPayload.hostUid = auth?.currentUser?.uid || null;
      await set(ref(database, `matchRooms/${roomCode}`), roomPayload);
    } catch (retryErr) {
      console.error("Retry room creation failed:", retryErr);
    }
  }
  return roomCode;
};

// ─── Ready Status and Lobby Controls ─────────────────────────────────────
export const setParticipantReady = async (roomCode, role, isReady) => {
  if (!database || !roomCode) return;
  const updates = {};
  updates[`${role}Ready`] = isReady;
  await update(ref(database, `matchRooms/${roomCode}`), updates);
};

export const startMatchRoomSession = async (roomCode) => {
  if (!database || !roomCode) return false;
  const roomRef = ref(database, `matchRooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return false;

  const roomData = snapshot.val();
  const hostLikedMovies = extractLikedMovies(roomData.hostDecisions, roomData.hostFavorites, roomData.hostLikes);
  const guestLikedMovies = extractLikedMovies(roomData.guestDecisions, roomData.guestFavorites, roomData.guestLikes);

  // Generate initial pair deck of movies
  const deckMovies = generateMatchWatchPairDeck(
    movies,
    hostLikedMovies,
    guestLikedMovies,
    [],
    roomData.filters || {},
    0,
    25
  );

  const deckIds = deckMovies.map(m => m.id);

  await update(roomRef, {
    status: "active",
    deck: deckIds,
    startedAt: Date.now()
  });

  return true;
};

export const joinMatchRoom = async (roomCode, guestName, guestDecisions = {}, guestFavorites = {}) => {
  if (!database) return false;
  await ensureAuthenticated();
  const roomRef = ref(database, `matchRooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return false;

  const roomData = snapshot.val();
  const guestPayload = { 
    guestUid: auth?.currentUser?.uid || null,
    guestName, 
    guestReady: false
  };

  if (guestDecisions && Object.keys(guestDecisions).length > 0) guestPayload.guestDecisions = guestDecisions;
  if (guestFavorites && Object.keys(guestFavorites).length > 0) guestPayload.guestFavorites = guestFavorites;

  try {
    await update(roomRef, guestPayload);
  } catch (err) {
    console.warn("RTDB update in joinMatchRoom failed:", err);
    try {
      await signInAnonymously(auth);
      guestPayload.guestUid = auth?.currentUser?.uid || null;
      await update(roomRef, guestPayload);
    } catch (retryErr) {
      console.error("Retry joinMatchRoom update failed:", retryErr);
    }
  }
  return true;
};

export const swipeMovie = async (roomCode, role, movieId, decision) => {
  if (!database) return;
  const updates = {};
  if (decision === 'like') {
    updates[`${role}Likes/${movieId}`] = true;
  } else {
    updates[`${role}Dislikes/${movieId}`] = true;
  }
  try {
    await update(ref(database, `matchRooms/${roomCode}`), updates);
  } catch (err) {
    console.warn("swipeMovie update failed:", err);
  }
};

export const subscribeToRoom = (roomCode, callback) => {
  if (!database) return () => {};
  const roomRef = ref(database, `matchRooms/${roomCode}`);
  const unsubscribe = onValue(roomRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

export const removeSwipe = async (roomCode, role, movieId) => {
  if (!database) return;
  const updates = {};
  updates[`${role}Likes/${movieId}`] = null;
  updates[`${role}Dislikes/${movieId}`] = null;
  await update(ref(database, `matchRooms/${roomCode}`), updates);
};

export const extendMatchRoomDeck = async (roomCode, count = 25) => {
  if (!database || !roomCode) return false;
  const roomRef = ref(database, `matchRooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return false;

  const roomData = snapshot.val();
  const currentDeck = Array.isArray(roomData.deck)
    ? roomData.deck
    : (roomData.deck ? Object.values(roomData.deck) : []);

  const hostLikedMovies = extractLikedMovies(roomData.hostDecisions, roomData.hostFavorites, roomData.hostLikes);
  const guestLikedMovies = extractLikedMovies(roomData.guestDecisions, roomData.guestFavorites, roomData.guestLikes);

  let candidatePool = movies;
  if (roomData.candidateIds) {
    let rawCandidateIds = Array.isArray(roomData.candidateIds) ? roomData.candidateIds : Object.values(roomData.candidateIds);
    const candidateObjs = rawCandidateIds.map(id => moviesById[id] || movies.find(m => m.id === Number(id))).filter(Boolean);
    if (candidateObjs.length > 0) {
      candidatePool = candidateObjs;
    }
  }

  const nextDeckLength = currentDeck.length + count;
  const extendedDeckIds = generateMatchWatchPairDeck(candidatePool, hostLikedMovies, guestLikedMovies, nextDeckLength);

  await update(roomRef, { deck: extendedDeckIds });
  return true;
};
