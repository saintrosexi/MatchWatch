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

// ─── User Tags ────────────────────────────────────────────────────
export const generateUniqueTag = async (baseName, customCode = null) => {
  if (!database) throw new Error("Database not initialized");
  const cleanName = baseName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').substring(0, 15);
  if (!cleanName) throw new Error("Имя должно содержать буквы или цифры");

  if (customCode) {
    const cleanCode = customCode.replace(/[^0-9]/g, '').substring(0, 4);
    if (cleanCode.length !== 4) throw new Error("Код должен состоять из 4 цифр");
    const tag = `${cleanName}#${cleanCode}`;
    const snap = await get(ref(database, `userTags/${getTagKey(tag)}`));
    if (snap.exists()) throw new Error("Этот тег уже занят. Попробуйте другой код.");
    return tag;
  }

  let tag = "";
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const code = Math.floor(1000 + Math.random() * 9000);
    tag = `${cleanName}#${code}`;
    const snap = await get(ref(database, `userTags/${getTagKey(tag)}`));
    if (!snap.exists()) isUnique = true;
    attempts++;
  }

  if (!isUnique) throw new Error("Не удалось сгенерировать уникальный тег.");
  return tag;
};

export const registerWithTag = async (email, password, baseName, customCode = null) => {
  const tag = await generateUniqueTag(baseName, customCode);
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCred.user;

  await updateProfile(user, { displayName: tag });
  await set(ref(database, `userTags/${getTagKey(tag)}`), user.uid);
  await set(ref(database, `users/${user.uid}/profile`), {
    tag,
    email,
    avatar: '😎',
    createdAt: Date.now()
  });

  return userCred;
};

export const migrateLegacyUser = async (user, baseName, customCode = null) => {
  const tag = await generateUniqueTag(baseName, customCode);
  await updateProfile(user, { displayName: tag });
  await set(ref(database, `userTags/${getTagKey(tag)}`), user.uid);
  await update(ref(database, `users/${user.uid}/profile`), { tag });
  return tag;
};

// ─── Public Profile ───────────────────────────────────────────────
export const getPublicProfile = async (tag) => {
  const targetRef = ref(database, `userTags/${getTagKey(tag)}`);
  const snap = await get(targetRef);
  if (!snap.exists()) return null;
  const targetUid = snap.val();

  const profileSnap = await get(ref(database, `users/${targetUid}/profile`));
  const appDataSnap = await get(ref(database, `users/${targetUid}/appData`));

  return {
    uid: targetUid,
    profile: profileSnap.val() || {},
    appData: appDataSnap.val() || {}
  };
};

export const updateUserTag = async (user, newName, newCustomCode = null) => {
  const oldTag = user.displayName;
  const newTag = await generateUniqueTag(newName, newCustomCode);

  await set(ref(database, `userTags/${getTagKey(newTag)}`), user.uid);
  await updateProfile(user, { displayName: newTag });
  await update(ref(database, `users/${user.uid}/profile`), { tag: newTag });

  // Update friend lists
  const friendsSnap = await get(ref(database, `users/${user.uid}/friends`));
  if (friendsSnap.exists()) {
    const updates = {};
    Object.keys(friendsSnap.val()).forEach(friendUid => {
      updates[`users/${friendUid}/friends/${user.uid}`] = newTag;
    });
    await update(ref(database), updates);
  }

  // Remove old tag
  await remove(ref(database, `userTags/${getTagKey(oldTag)}`));
  return newTag;
};

// ─── Friends ──────────────────────────────────────────────────────
export const sendFriendRequest = async (currentUid, currentTag, targetTag) => {
  const targetRef = ref(database, `userTags/${getTagKey(targetTag)}`);
  const snap = await get(targetRef);
  if (!snap.exists()) throw new Error("Пользователь не найден");

  const targetUid = snap.val();
  if (targetUid === currentUid) throw new Error("Нельзя добавить самого себя");

  const friendSnap = await get(ref(database, `users/${currentUid}/friends/${targetUid}`));
  if (friendSnap.exists()) throw new Error("Вы уже друзья");

  await set(ref(database, `users/${targetUid}/friendRequests/${currentUid}`), currentTag);
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
export const createMatchRoom = async (hostName, customDeck = null, hostDecisions = {}, hostFavorites = {}, hostStopGenres = []) => {
  if (!database) return null;
  await ensureAuthenticated();
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const deckToUse = (customDeck && Array.isArray(customDeck) && customDeck.length > 0)
    ? customDeck
    : movies.map(m => m.id);

  const roomPayload = {
    hostUid: auth?.currentUser?.uid || null,
    hostName,
    status: "waiting",
    deck: deckToUse,
    createdAt: Date.now()
  };

  if (customDeck && Array.isArray(customDeck) && customDeck.length > 0) {
    roomPayload.candidateIds = customDeck;
  }

  if (hostDecisions && Object.keys(hostDecisions).length > 0) roomPayload.hostDecisions = hostDecisions;
  if (hostFavorites && Object.keys(hostFavorites).length > 0) roomPayload.hostFavorites = hostFavorites;

  const normalized = normalizeStopGenres(hostStopGenres);
  if (normalized.length > 0) roomPayload.hostStopGenres = normalized;

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

// ─── Liked Movies Helper for Compromise Recommendations ──────────
const extractLikedMovies = (...inputs) => {
  const movieIds = new Set();

  inputs.forEach(input => {
    if (!input) return;
    if (Array.isArray(input)) {
      input.forEach(item => {
        if (typeof item === 'number' || typeof item === 'string') {
          const num = Number(item);
          if (!isNaN(num) && num > 0) movieIds.add(num);
        } else if (item && typeof item === 'object') {
          if (item.id != null) {
            const num = Number(item.id);
            if (!isNaN(num) && num > 0) movieIds.add(num);
          } else {
            Object.entries(item).forEach(([k, v]) => {
              if (v === 'like' || v === 'liked' || v === true) {
                const num = Number(k);
                if (!isNaN(num) && num > 0) movieIds.add(num);
              }
            });
          }
        }
      });
    } else if (typeof input === 'object') {
      Object.entries(input).forEach(([key, val]) => {
        if (val === 'like' || val === 'liked' || val === true) {
          const num = Number(key);
          if (!isNaN(num) && num > 0) movieIds.add(num);
        } else if (val && typeof val === 'object' && val.id != null) {
          const num = Number(val.id);
          if (!isNaN(num) && num > 0) movieIds.add(num);
        }
      });
    }
  });

  const likedMovies = [];
  movieIds.forEach(id => {
    const movie = moviesById[id] || movies.find(m => m.id === id);
    if (movie) {
      likedMovies.push(movie);
    }
  });

  return likedMovies;
};

export const joinMatchRoom = async (roomCode, guestName, guestDecisions = {}, guestFavorites = {}, guestStopGenres = []) => {
  if (!database) return false;
  await ensureAuthenticated();
  const roomRef = ref(database, `matchRooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return false;

  const roomData = snapshot.val();
  const guestPayload = { 
    guestUid: auth?.currentUser?.uid || null,
    guestName, 
    status: 'active' 
  };

  if (guestDecisions && Object.keys(guestDecisions).length > 0) guestPayload.guestDecisions = guestDecisions;
  if (guestFavorites && Object.keys(guestFavorites).length > 0) guestPayload.guestFavorites = guestFavorites;

  const normalized = normalizeStopGenres(guestStopGenres);
  if (normalized.length > 0) guestPayload.guestStopGenres = normalized;

  // Extract Host and Guest liked movies to compute compromise taste vector
  const hostLikedMovies = extractLikedMovies(roomData.hostDecisions, roomData.hostFavorites, roomData.hostLikes);
  const guestLikedMovies = extractLikedMovies(guestDecisions, guestFavorites, roomData.guestLikes);

  let candidatePool = movies;
  if (roomData.candidateIds) {
    let rawDeck = Array.isArray(roomData.candidateIds) ? roomData.candidateIds : Object.values(roomData.candidateIds);
    const candidateObjs = rawDeck.map(id => moviesById[id] || movies.find(m => m.id === Number(id))).filter(Boolean);
    if (candidateObjs.length > 0) {
      candidatePool = candidateObjs;
    }
  } else if (roomData.deck) {
    let rawDeck = [];
    if (Array.isArray(roomData.deck)) {
      rawDeck = roomData.deck;
    } else if (typeof roomData.deck === 'object') {
      rawDeck = Object.values(roomData.deck);
    }
    const candidateObjs = rawDeck.map(id => moviesById[id] || movies.find(m => m.id === Number(id))).filter(Boolean);
    if (candidateObjs.length > 0) {
      candidatePool = candidateObjs;
    }
  }

  // Generate 25-movie compromise deck using midpoint taste vector
  const compromiseDeckIds = generateMatchWatchPairDeck(candidatePool, hostLikedMovies, guestLikedMovies);
  guestPayload.deck = compromiseDeckIds;

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
