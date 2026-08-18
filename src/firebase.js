// MatchWatch 3 — Firebase Client Initialization
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const getEnv = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}

  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}

  return undefined;
};

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

export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId
  );
};

let app = null;
let database = null;
let auth = null;

try {
  if (isFirebaseConfigured()) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    database = getDatabase(app);
    auth = getAuth(app);
  }
} catch (err) {
  console.warn("Firebase initialization warning (falling back to offline/memory mode):", err.message || err);
}

export { app, database, auth };
