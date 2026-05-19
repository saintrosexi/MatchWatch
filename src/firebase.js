import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, update, remove } from "firebase/database";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { movies } from "./data";

// ВАЖНО: Заполните эти данные ключами из вашего проекта Firebase Console
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCQHQAL7LiMUQ8PkLeg-qePibn0M3FuqPA",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "match-watch-f9eec.firebaseapp.com",
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://match-watch-f9eec-default-rtdb.firebaseio.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "match-watch-f9eec",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "match-watch-f9eec.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "896259439383",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:896259439383:web:e242ba183ba638a40a1552",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-FS2CDSSF16"
};

let app, database, auth;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase is not fully configured yet. Please add your credentials.");
}

export { auth, database, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile };

const getTagKey = (tag) => tag.replace('#', '-');

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
    if (!snap.exists()) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) throw new Error("Не удалось сгенерировать уникальный тег. Попробуйте другое имя.");
  return tag;
};

export const registerWithTag = async (email, password, baseName, customCode = null) => {
  const tag = await generateUniqueTag(baseName, customCode);
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCred.user;
  
  await updateProfile(user, { displayName: tag });
  
  await set(ref(database, `userTags/${getTagKey(tag)}`), user.uid);
  await set(ref(database, `users/${user.uid}/profile`), {
    tag: tag,
    email: email,
    avatar: '😎',
    createdAt: Date.now()
  });
  
  return userCred;
};

export const migrateLegacyUser = async (user, baseName, customCode = null) => {
  const tag = await generateUniqueTag(baseName, customCode);
  await updateProfile(user, { displayName: tag });
  await set(ref(database, `userTags/${getTagKey(tag)}`), user.uid);
  await update(ref(database, `users/${user.uid}/profile`), {
    tag: tag
  });
  return tag;
};

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
  
  // Create new tag mapping
  await set(ref(database, `userTags/${getTagKey(newTag)}`), user.uid);
  
  // Update auth profile
  await updateProfile(user, { displayName: newTag });
  
  // Update profile data
  await update(ref(database, `users/${user.uid}/profile`), {
    tag: newTag
  });
  
  // Get all friends and update their friend lists
  const friendsSnap = await get(ref(database, `users/${user.uid}/friends`));
  if (friendsSnap.exists()) {
    const updates = {};
    const friends = friendsSnap.val();
    Object.keys(friends).forEach(friendUid => {
      updates[`users/${friendUid}/friends/${user.uid}`] = newTag;
    });
    await update(ref(database), updates);
  }
  
  // Delete old tag mapping
  await remove(ref(database, `userTags/${getTagKey(oldTag)}`));
  
  return newTag;
};

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

export const inviteToMatchWatch = async (targetUid, roomCode, currentTag) => {
  await set(ref(database, `users/${targetUid}/invites/${roomCode}`), {
    from: currentTag,
    timestamp: Date.now()
  });
};

export const removeInvite = async (currentUid, roomCode) => {
  await remove(ref(database, `users/${currentUid}/invites/${roomCode}`));
};

const normalizeStopGenres = (sg) => {
  if (!sg) return [];
  let arr = [];
  if (Array.isArray(sg)) {
    arr = sg;
  } else if (typeof sg === 'object') {
    arr = Object.values(sg);
  } else if (typeof sg === 'string') {
    arr = [sg];
  }
  return arr.filter(item => typeof item === 'string' && item.trim() !== "");
};

const isMovieGenreStopped = (genresStr, stopGenres) => {
  if (!genresStr || !stopGenres) return false;
  const normalizedStop = normalizeStopGenres(stopGenres).map(g => g.toLowerCase().trim());
  if (normalizedStop.length === 0) return false;
  
  const mGenres = genresStr.split(",").map(g => g.trim().toLowerCase());
  
  const expandedStop = new Set();
  normalizedStop.forEach(sg => {
    expandedStop.add(sg);
    if (sg.includes("ужас") || sg.includes("хоррор") || sg.includes("ужастик")) {
      expandedStop.add("ужасы");
      expandedStop.add("ужастики");
      expandedStop.add("хоррор");
      expandedStop.add("horror");
      expandedStop.add("мистика");
    }
    if (sg.includes("комеди")) {
      expandedStop.add("комедия");
      expandedStop.add("комедии");
      expandedStop.add("comedy");
    }
    if (sg.includes("драм")) {
      expandedStop.add("драма");
      expandedStop.add("драмы");
      expandedStop.add("drama");
    }
    if (sg.includes("боевик") || sg.includes("экшен") || sg.includes("action")) {
      expandedStop.add("боевик");
      expandedStop.add("боевики");
      expandedStop.add("экшен");
      expandedStop.add("action");
    }
    if (sg.includes("триллер") || sg.includes("thriller")) {
      expandedStop.add("триллер");
      expandedStop.add("триллеры");
      expandedStop.add("thriller");
    }
    if (sg.includes("фантастик") || sg.includes("sci-fi")) {
      expandedStop.add("фантастика");
      expandedStop.add("фэнтези");
      expandedStop.add("fantasy");
      expandedStop.add("sci-fi");
    }
    if (sg.includes("документал") || sg.includes("doc")) {
      expandedStop.add("документальный");
      expandedStop.add("документалка");
      expandedStop.add("documentary");
    }
  });
  
  return mGenres.some(mg => {
    return Array.from(expandedStop).some(esg => 
      mg.includes(esg) || esg.includes(mg)
    );
  });
};

const getFavoriteActorAndDirector = (decisions = {}, favorites = {}) => {
  const actorScores = {};
  const directorScores = {};
  
  const favIds = Object.keys(favorites).filter(id => favorites[id]);

  Object.keys(decisions).forEach(id => {
    if (decisions[id] === "like") {
      const m = movies.find(movie => movie.id === parseInt(id));
      if (m) {
        const isFav = favIds.includes(id);
        const weight = isFav ? 3 : 1;
        const t = m.type || "movie";

        // Director (ignore series/anime and N/A/—)
        if (t === "movie" && m.director && m.director !== "N/A" && m.director !== "—") {
          m.director.split(", ").forEach(d => {
            directorScores[d] = (directorScores[d] || 0) + weight;
          });
        }

        // Actors (ignore N/A/—)
        if (m.actors && m.actors !== "N/A" && m.actors !== "—") {
          m.actors.split(", ").forEach(a => {
            actorScores[a] = (actorScores[a] || 0) + weight;
          });
        }
      }
    }
  });

  let favoriteDirector = "—";
  if (Object.keys(directorScores).length > 0) {
    favoriteDirector = Object.entries(directorScores).sort((a, b) => b[1] - a[1])[0][0];
  }

  let favoriteActor = "—";
  if (Object.keys(actorScores).length > 0) {
    favoriteActor = Object.entries(actorScores).sort((a, b) => b[1] - a[1])[0][0];
  }

  return { favoriteActor, favoriteDirector };
};

export const createMatchRoom = async (hostName, customDeck = null, hostDecisions = {}, hostFavorites = {}, hostStopGenres = []) => {
  if (!database) return null;
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Если передана кастомная колода, используем её, иначе - стандартную 1...849
  const deck = customDeck || Array.from({length: 849}, (_, i) => i + 1);
  const shuffledDeck = [...deck];
  for (let i = shuffledDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
  }

  const roomRef = ref(database, `matchRooms/${roomCode}`);
  await set(roomRef, {
    hostName,
    status: "waiting",
    deck: shuffledDeck,
    hostDecisions,
    hostFavorites,
    hostStopGenres,
    createdAt: Date.now()
  });
  return roomCode;
};

export const joinMatchRoom = async (roomCode, guestName, guestDecisions = {}, guestFavorites = {}, guestStopGenres = []) => {
  if (!database) return false;
  const roomRef = ref(database, `matchRooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (snapshot.exists()) {
    const room = snapshot.val();
    const hostDecisions = room.hostDecisions || {};
    const hostFavorites = room.hostFavorites || {};
    const hostStopGenres = room.hostStopGenres || [];
    
    // Получаем список кандидатов из существующей (и уже отфильтрованной по категории) колоды
    const candidateIds = room.deck || [];
    
    // Рассчитываем любимых актеров и режиссеров для обоих пользователей
    const hostFavs = getFavoriteActorAndDirector(hostDecisions, hostFavorites);
    const guestFavs = getFavoriteActorAndDirector(guestDecisions, guestFavorites);
    
    const hostFavActor = hostFavs.favoriteActor;
    const hostFavDirector = hostFavs.favoriteDirector;
    const guestFavActor = guestFavs.favoriteActor;
    const guestFavDirector = guestFavs.favoriteDirector;
    
    const scoredDeck = [];
    
    // Карта фильмов по ID для быстрой фильтрации
    const moviesMap = new Map();
    movies.forEach(m => moviesMap.set(m.id, m));
    
    candidateIds.forEach(id => {
      const m = moviesMap.get(parseInt(id));
      if (!m) return;
      
      // Исключаем невышедшие фильмы: дата релиза после "2026-05-19"
      if (m.releaseDate && new Date(m.releaseDate) > new Date("2026-05-19")) {
        return;
      }
      
      // Исключаем совпадения по лайкам (фильмы, которые оба уже лайкнули в профиле)
      const hostLiked = hostDecisions[id] === "like";
      const guestLiked = guestDecisions[id] === "like";
      if (hostLiked && guestLiked) {
        return;
      }
      
      let score = 0;
      
      // 1. Фильмы, которые лайкнул только один пользователь
      const likedByOnlyOne = (hostLiked && !guestLiked) || (guestLiked && !hostLiked);
      if (likedByOnlyOne) {
        score += 100;
      }
      
      // 2. В ролях любимый актер одного из пользователей
      let hasFavActor = false;
      if (m.actors && m.actors !== "N/A" && m.actors !== "—") {
        const actorsList = m.actors.split(", ").map(a => a.trim().toLowerCase());
        if (
          (hostFavActor && hostFavActor !== "—" && actorsList.includes(hostFavActor.toLowerCase())) ||
          (guestFavActor && guestFavActor !== "—" && actorsList.includes(guestFavActor.toLowerCase()))
        ) {
          hasFavActor = true;
        }
      }
      if (hasFavActor) {
        score += 30;
      }
      
      // 3. Режиссер — любимый режиссер одного из пользователей
      let hasFavDirector = false;
      if (m.director && m.director !== "N/A" && m.director !== "—") {
        const directorsList = m.director.split(", ").map(d => d.trim().toLowerCase());
        if (
          (hostFavDirector && hostFavDirector !== "—" && directorsList.includes(hostFavDirector.toLowerCase())) ||
          (guestFavDirector && guestFavDirector !== "—" && directorsList.includes(guestFavDirector.toLowerCase()))
        ) {
          hasFavDirector = true;
        }
      }
      if (hasFavDirector) {
        score += 30;
      }
      
      // 4. Фильмы в избранном у одного из пользователей
      const hostFav = hostFavorites[id] === true;
      const guestFav = guestFavorites[id] === true;
      if (hostFav || guestFav) {
        score += 50;
      }
      
      // 5. Фильмы в стоп-листе (жанры) у любого из пользователей — уходят в самый низ
      const isStopped = isMovieGenreStopped(m.genres, hostStopGenres) || isMovieGenreStopped(m.genres, guestStopGenres);
      if (isStopped) {
        score -= 1000;
      }
      
      // Добавляем случайный разброс для одинаковых приоритетов
      score += Math.random();
      
      scoredDeck.push({ id: m.id, score });
    });
    
    // Сортируем колоду по убыванию очков приоритета
    scoredDeck.sort((a, b) => b.score - a.score);
    
    const finalDeck = scoredDeck.map(item => item.id);
    
    await update(roomRef, {
      guestName,
      status: 'active',
      guestDecisions,
      guestFavorites,
      guestStopGenres,
      deck: finalDeck
    });
    return true;
  }
  return false;
};

export const swipeMovie = async (roomCode, role, movieId, decision) => {
  if (!database) return;
  const roomRef = ref(database, `matchRooms/${roomCode}`);
  const updates = {};
  updates[`${role}Likes/${movieId}`] = (decision === 'like');
  await update(roomRef, updates);
  
  // Проверяем на совпадение (match)
  if (decision === 'like') {
    const snapshot = await get(roomRef);
    if (snapshot.exists()) {
      const room = snapshot.val();
      const otherRole = role === 'host' ? 'guest' : 'host';
      const otherLikes = room[`${otherRole}Likes`] || {};
      const otherDecisions = room[`${otherRole}Decisions`] || {};
      
      const otherLiked = otherLikes[movieId] === true || otherDecisions[movieId] === "like";
      if (otherLiked) {
        await update(roomRef, { match: movieId });
      }
    }
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
  const roomRef = ref(database, `matchRooms/${roomCode}/${role}Likes/${movieId}`);
  await remove(roomRef);
};
