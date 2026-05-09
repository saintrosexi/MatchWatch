import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, update } from "firebase/database";

// ВАЖНО: Заполните эти данные ключами из вашего проекта Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCQHQAL7LiMUQ8PkLeg-qePibn0M3FuqPA",
  authDomain: "match-watch-f9eec.firebaseapp.com",
  databaseURL: "https://match-watch-f9eec-default-rtdb.firebaseio.com",
  projectId: "match-watch-f9eec",
  storageBucket: "match-watch-f9eec.firebasestorage.app",
  messagingSenderId: "896259439383",
  appId: "1:896259439383:web:e242ba183ba638a40a1552",
  measurementId: "G-FS2CDSSF16"
};

let app, database;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
} catch (e) {
  console.warn("Firebase is not fully configured yet. Please add your credentials.");
}

export const createMatchRoom = async (hostName) => {
  if (!database) return null;
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Создаем перемешанный порядок фильмов (индексы от 0 до 9)
  const deck = Array.from({length: 10}, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  await set(ref(database, `matchRooms/${roomCode}`), {
    code: roomCode,
    hostName,
    status: 'waiting',
    hostLikes: {},
    guestLikes: {},
    deck,
    match: null
  });
  return roomCode;
};

export const joinMatchRoom = async (roomCode, guestName) => {
  if (!database) return false;
  const roomRef = ref(database, `matchRooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (snapshot.exists()) {
    await update(roomRef, {
      guestName,
      status: 'active'
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
      if (room[`${otherRole}Likes`] && room[`${otherRole}Likes`][movieId] === true) {
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
