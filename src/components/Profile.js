import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auth, database, registerWithTag, signInWithEmailAndPassword, signInWithTelegram, createTelegramAuthToken, listenToTelegramAuthToken, signOut, updateUserTag } from "../firebase";
import { getTelegramUser, getBotUsername } from "../tma";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";
import { ChamaBanner, ChamaBackgroundArt } from "../chamaAssets";
import { generateSimpleTasteInference } from "../tasteInference";
import "../styles/MovieModal.css";

// Preset Avatar Emojis
const AVATAR_PRESETS = [
  "😎", "🍿", "🤖", "🎬", "👑", "🦊", 
  "✨", "🎧", "🚀", "⚡", "🖤", "🔥", 
  "🦄", "👾", "🎯", "🎨", "🐉", "🔮"
];

// Helper to determine Anime Studio
function getAnimeStudio(movie) {
  if (!movie || movie.type !== "anime") return null;
  const dir = (movie.director || "").toLowerCase();
  const title = (movie.titleRu || movie.title || "").toLowerCase();
  
  if (dir.includes("miyazaki") || dir.includes("миядзаки") || dir.includes("takahata") || dir.includes("такахата") || dir.includes("shinkai") || dir.includes("синкай") || title.includes("унесённые призраками") || title.includes("ходячий замок") || title.includes("навсикая") || title.includes("тоторо") || title.includes("мононоке") || title.includes("порко россо") || title.includes("шепот сердца") || title.includes("ведьмина служба") || title.includes("ариэтти") || title.includes("рыбка поньо")) {
    if (dir.includes("miyazaki") || dir.includes("миядзаки") || dir.includes("takahata") || dir.includes("такахата")) {
      return "Studio Ghibli";
    }
    if (dir.includes("shinkai") || dir.includes("синкай") || title.includes("твоё имя") || title.includes("дитя погоды") || title.includes("5 сантиметров")) {
      return "CoMix Wave Films";
    }
  }
  
  if (title.includes("атака титанов") || title.includes("shingeki")) return "Wit Studio / MAPPA";
  if (title.includes("клинок") || title.includes("демонов") || title.includes("kimetsu")) return "ufotable";
  if (title.includes("тетрадь смерти") || title.includes("death note") || title.includes("ванпанчмен") || title.includes("one punch") || title.includes("хантер") || title.includes("hunter") || title.includes("пираты черной лагуны") || title.includes("паразит")) return "Madhouse";
  if (title.includes("баскетбол куроко") || title.includes("волейбол") || title.includes("haikyu") || title.includes("психопаспорт") || title.includes("psycho-pass")) return "Production I.G";
  if (title.includes("наруто") || title.includes("naruto") || title.includes("блич") || title.includes("bleach") || title.includes("гуль") || title.includes("tokyo ghoul")) return "Studio Pierrot";
  if (title.includes("ван пис") || title.includes("one piece") || title.includes("драгонболл") || title.includes("сэйлор мун")) return "Toei Animation";
  if (title.includes("полнометаллический алхимик") || title.includes("fullmetal") || title.includes("моя геройская академия") || title.includes("hero academia") || title.includes("бездомный бог") || title.includes("noragami")) return "Bones";
  if (title.includes("код гиас") || title.includes("code geass") || title.includes("ковбой бибоп") || title.includes("cowboy bebop")) return "Sunrise";
  if (title.includes("человек-бензопила") || title.includes("chainsaw") || title.includes("магическая битва") || title.includes("jujutsu")) return "MAPPA";
  if (title.includes("форма голоса") || title.includes("silent voice") || title.includes("вайолет эвергарден") || title.includes("violet evergarden") || dir.includes("yamada") || dir.includes("ямада")) return "Kyoto Animation";
  if (title.includes("доктор стоун") || title.includes("dr. stone") || title.includes("детектор")) return "TMS Entertainment";
  if (title.includes("повелитель") || title.includes("overlord") || title.includes("реинкарнация безработного") || title.includes("mushoku")) return "Studio Bind / Madhouse";
  if (title.includes("мастера меча онлайн") || title.includes("sao") || title.includes("sword art online") || title.includes("хвост феи") || title.includes("fairy tail")) return "A-1 Pictures";
  
  if (dir.includes("miyazaki") || dir.includes("миядзаки")) return "Studio Ghibli";
  
  return "Другая студия";
}

// 5D Sensation Vibe Radar Pure SVG Component
export function SensationRadarComponent({ likedMovies = [], favorites = {} }) {
  const [activeTooltip, setActiveTooltip] = useState(null);

  const radarData = useMemo(() => {
    if (!likedMovies || likedMovies.length === 0) {
      return {
        vector: { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 },
        archetype: "🌌 Исследователь кинематографа",
        description: "Отметьте больше фильмов, чтобы нейросеть выстроила ваш 5D вектор вкуса!"
      };
    }

    let sum = { energy: 0, darkness: 0, intellect: 0, emotion: 0, dynamism: 0 };
    let totalWeight = 0;

    likedMovies.forEach(m => {
      const vec = m.sensationVector || { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 };
      const isFav = !!favorites[m.id];
      const weight = isFav ? 2.5 : 1.0;
      sum.energy += (vec.energy || 5) * weight;
      sum.darkness += (vec.darkness || 5) * weight;
      sum.intellect += (vec.intellect || 5) * weight;
      sum.emotion += (vec.emotion || 5) * weight;
      sum.dynamism += (vec.dynamism || 5) * weight;
      totalWeight += weight;
    });

    if (totalWeight === 0) {
      return {
        vector: { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 },
        archetype: "🎬 Начинающий Киноман",
        description: "Свайпайте карточки для точного расчёта вашей 5D диаграммы!"
      };
    }

    const vector = {
      energy: +(sum.energy / totalWeight).toFixed(1),
      darkness: +(sum.darkness / totalWeight).toFixed(1),
      intellect: +(sum.intellect / totalWeight).toFixed(1),
      emotion: +(sum.emotion / totalWeight).toFixed(1),
      dynamism: +(sum.dynamism / totalWeight).toFixed(1),
    };

    const axes = [
      { key: "intellect", val: vector.intellect, title: "🧠 Интеллектуальный Мыслитель", desc: "Вы ищете в кино глубокие смыслы, философские подтексты и нелинейный сюжет." },
      { key: "emotion", val: vector.emotion, title: "💔 Эмпатичный Эстет", desc: "Главное для вас — глубокий эмоциональный отклик, человеческие драмы и катарсис." },
      { key: "darkness", val: vector.darkness, title: "🌙 Поклонник Нуара & Мрачности", desc: "Вас привлекают готическая атмосфера, психологическое напряжение и сложная мораль." },
      { key: "energy", val: vector.energy, title: "🔥 Искатель Ярких Впечатлений", desc: "Вы цените высокую драйвовую химию, драйв, экспрессию и энергичное повествование." },
      { key: "dynamism", val: vector.dynamism, title: "🏎️ Адреналиновый Фанатик", desc: "Напряжённый ритм, бешеный темп и стремительный экшен — ваша стихия." }
    ];

    axes.sort((a, b) => b.val - a.val);
    const top = axes[0];

    return {
      vector,
      archetype: top.title,
      description: top.desc
    };
  }, [likedMovies, favorites]);

  const { vector, archetype, description } = radarData;

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = 85;

  const axesConfig = [
    { key: "energy", label: "🔥 Энергия", color: "#ff8a50", desc: "Уровень экшна, динамики и напряжения в сюжете." },
    { key: "darkness", label: "🌙 Мрачность", color: "#a855f7", desc: "Глубина триллера, саспенс, нуарная атмосфера." },
    { key: "intellect", label: "🧠 Интеллект", color: "#3b82f6", desc: "Сложность сюжета, детективная составляющая, философская основа." },
    { key: "emotion", label: "💔 Эмоции", color: "#ec4899", desc: "Сила переживаний, романтика, трогательность истории." },
    { key: "dynamism", label: "🏎️ Динамика", color: "#eab308", desc: "Скорость смены событий, интенсивность монтажа." }
  ];

  const points = axesConfig.map((axis, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const val = (vector[axis.key] || 5) / 10;
    const px = cx + r * val * Math.cos(angle);
    const py = cy + r * val * Math.sin(angle);
    const labelX = cx + (r + 24) * Math.cos(angle);
    const labelY = cy + (r + 24) * Math.sin(angle);
    return { ...axis, px, py, labelX, labelY, val: vector[axis.key] };
  });

  const polygonPath = points.map(p => `${p.px},${p.py}`).join(" ");
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="radar-card-container relative">
      <div className="radar-header">
        <h3 className="radar-title">🌀 5D Сенсорный Профиль</h3>
        <div className="radar-archetype-badge">{archetype}</div>
      </div>
      <p className="radar-description">{description}</p>

      <div className="radar-svg-wrapper">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff5e62" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ff9966" stopOpacity="0.2" />
            </linearGradient>
            <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid Pentagons */}
          {gridLevels.map((lvl, idx) => {
            const gridPts = axesConfig.map((_, i) => {
              const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
              const gx = cx + r * lvl * Math.cos(angle);
              const gy = cy + r * lvl * Math.sin(angle);
              return `${gx},${gy}`;
            }).join(" ");
            return (
              <polygon
                key={idx}
                points={gridPts}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
              />
            );
          })}

          {/* Spoke Lines */}
          {axesConfig.map((_, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
            const ax = cx + r * Math.cos(angle);
            const ay = cy + r * Math.sin(angle);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={ax}
                y2={ay}
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            );
          })}

          {/* Data Pentagon */}
          <polygon
            points={polygonPath}
            fill="url(#radarGrad)"
            stroke="#ff9966"
            strokeWidth="2.5"
            filter="url(#radarGlow)"
          />

          {/* Vertices & Values (Interactive) */}
          {points.map((pt, i) => (
            <g key={i} style={{ cursor: "pointer" }} onClick={() => setActiveTooltip(pt)}>
              <circle cx={pt.px} cy={pt.py} r="6" fill={pt.color} stroke="#ffffff" strokeWidth="2" />
              <text
                x={pt.labelX}
                y={pt.labelY}
                fill="rgba(255, 255, 255, 0.95)"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {pt.label.split(" ")[0]} {pt.val}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Interactive Tooltip Card */}
      <AnimatePresence>
        {activeTooltip && (
          <motion.div 
            className="radar-axis-tooltip-card"
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            onClick={() => setActiveTooltip(null)}
            style={{
              marginTop: "10px",
              padding: "12px 16px",
              borderRadius: "14px",
              background: "rgba(18, 24, 38, 0.95)",
              border: `1px solid ${activeTooltip.color}`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 15px ${activeTooltip.color}33`,
              cursor: "pointer"
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: activeTooltip.color, marginBottom: "4px" }}>
              {activeTooltip.label} ({activeTooltip.val} / 10)
            </div>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.8)", lineHeight: "1.35" }}>
              {activeTooltip.desc}
            </div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "6px" }}>
              Нажмите, чтобы закрыть ✕
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vector Progress Bars */}
      <div className="radar-bars-grid" style={{ marginTop: "16px" }}>
        {points.map(pt => (
          <div key={pt.key} className="radar-bar-row" style={{ cursor: "pointer" }} onClick={() => setActiveTooltip(pt)}>
            <div className="radar-bar-header">
              <span className="radar-bar-label">{pt.label}</span>
              <span className="radar-bar-val" style={{ color: pt.color }}>{pt.val} / 10</span>
            </div>
            <div className="radar-bar-track">
              <div
                className="radar-bar-fill"
                style={{ width: `${pt.val * 10}%`, background: pt.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Profile({ user: propUser = null, currentUserDecisions = {}, favorites: propFavorites = {}, ratings: propRatings = {} }) {
  const [user, setUser] = useState(propUser);
  const [loading, setLoading] = useState(false);
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [pendingTgCode, setPendingTgCode] = useState(null);
  
  const [profileData, setProfileData] = useState(null);
  const [appData, setAppData] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  
  const [copiedLink, setCopiedLink] = useState(false);
  const [migrateTagInput, setMigrateTagInput] = useState("");
  const [migrateError, setMigrateError] = useState("");

  const [editName, setEditName] = useState("");
  const [editTag, setEditTag] = useState("");
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Avatar Picker Modal State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState("");

  // Inline Bio Editor State
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSuccess, setBioSuccess] = useState(false);

  // Favorites & Achievements Category Tabs
  const [activeFavoritesTab, setActiveFavoritesTab] = useState("all");
  const [activeAchievementTab, setActiveAchievementTab] = useState("all");

  // AI Taste Summary State
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showAllFavorites, setShowAllFavorites] = useState(false);

  const startEditingProfile = () => {
    if (user && user.displayName) {
      const parts = user.displayName.split('#');
      setEditName(parts[0]);
      setEditTag(parts[1] || "");
    }
    setIsEditingProfile(true);
    setEditError("");
    setEditSuccess("");
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();
    setEditError("");
    setEditSuccess("");
    try {
      await updateUserTag(user, editName, editTag || null);
      setEditSuccess("Профиль успешно обновлен!");
      setTimeout(() => setIsEditingProfile(false), 2000);
    } catch (err) {
      setEditError(err.message);
    }
  };

  useEffect(() => {
    if (!auth || !database) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = ref(database, `users/${currentUser.uid}`);
        onValue(userRef, (snap) => {
          const data = snap.val() || {};
          setProfileData(data.profile || {});
          setAppData(data.appData || {});
          setMatchHistory(data.matchHistory || []);
          if (data.profile?.aiTasteSummary) {
            setAiSummary(data.profile.aiTasteSummary);
          }
        });
      }
      setLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await registerWithTag(email, password, name, customTag || null);
      }
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setAuthError("Эта почта уже зарегистрирована");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setAuthError("Неверная почта или пароль");
      } else if (err.code === "auth/weak-password") {
        setAuthError("Пароль должен быть не менее 6 символов");
      } else if (err.message) {
        setAuthError(err.message);
      } else {
        setAuthError("Произошла ошибка. Попробуйте позже.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Ошибка выхода", err);
    }
  };

  // Instant Firebase / Local Persistence for Avatar
  const handleSelectAvatar = async (avatarVal) => {
    const activeUser = user || propUser;
    if (!activeUser) return;
    try {
      if (database && activeUser.uid) {
        await set(ref(database, `users/${activeUser.uid}/profile/avatar`), avatarVal);
      }
      setProfileData(prev => ({ ...(prev || {}), avatar: avatarVal }));
      setIsAvatarModalOpen(false);
      setAvatarUrlInput("");
    } catch (err) {
      console.error("Error saving avatar:", err);
      setProfileData(prev => ({ ...(prev || {}), avatar: avatarVal }));
      setIsAvatarModalOpen(false);
    }
  };

  // Instant Firebase / Local Persistence for Bio
  const handleSaveBio = async () => {
    const activeUser = user || propUser;
    if (!activeUser) return;
    setBioSaving(true);
    try {
      const cleanBio = bioInput.trim();
      if (database && activeUser.uid) {
        await set(ref(database, `users/${activeUser.uid}/profile/bio`), cleanBio);
      }
      setProfileData(prev => ({ ...(prev || {}), bio: cleanBio }));
      setBioSuccess(true);
      setTimeout(() => {
        setBioSuccess(false);
        setIsEditingBio(false);
      }, 800);
    } catch (err) {
      console.error("Error saving bio:", err);
    } finally {
      setBioSaving(false);
    }
  };

  const toggleLike = (movie) => {
    if (!user) return;
    const current = ((appData || {}).decisions || {})[movie.id];
    const newDecisions = { ...((appData || {}).decisions || {}) };
    const newFavorites = { ...((appData || {}).favorites || {}) };
    if (current === "like") {
      delete newDecisions[movie.id];
      delete newFavorites[movie.id];
    } else {
      newDecisions[movie.id] = "like";
    }
    set(ref(database, `users/${user.uid}/appData/decisions`), newDecisions);
    set(ref(database, `users/${user.uid}/appData/favorites`), newFavorites);
  };

  const toggleFavorite = (movie) => {
    if (!user) return;
    const newFavorites = { ...((appData || {}).favorites || {}) };
    const newDecisions = { ...((appData || {}).decisions || {}) };
    if (newFavorites[movie.id]) {
      delete newFavorites[movie.id];
    } else {
      newFavorites[movie.id] = true;
      if (newDecisions[movie.id] !== "like") {
        newDecisions[movie.id] = "like";
      }
    }
    set(ref(database, `users/${user.uid}/appData/favorites`), newFavorites);
    set(ref(database, `users/${user.uid}/appData/decisions`), newDecisions);
  };

  const handleSetRating = (movie, rating) => {
    if (!user) return;
    const newRatings = { ...((appData || {}).ratings || {}) };
    if (rating === null || newRatings[movie.id] === rating) {
      delete newRatings[movie.id];
    } else {
      newRatings[movie.id] = rating;
    }
    set(ref(database, `users/${user.uid}/appData/ratings`), newRatings);
  };

  // Comprehensive Stats Calculation & Total Watch Time
  const stats = useMemo(() => {
    const decs = { ...currentUserDecisions, ...((appData || {}).decisions || {}) };
    const favs = { ...propFavorites, ...((appData || {}).favorites || {}) };
    const ratings = { ...propRatings, ...((appData || {}).ratings || {}) };

    const swiped = Object.keys(decs).length;

    const moviesMap = new Map();
    movies.forEach(m => moviesMap.set(m.id, m));

    // Combine ALL swiped likes AND ALL favorited movies into single unified set
    const likedAndFavMovieIds = new Set();
    Object.entries(decs).forEach(([id, val]) => {
      if (val === "like" || val === "liked" || val === true) {
        likedAndFavMovieIds.add(Number(id));
      }
    });
    Object.entries(favs).forEach(([id, val]) => {
      if (val === true || val === "like") {
        likedAndFavMovieIds.add(Number(id));
      }
    });

    const likedMoviesList = [];
    const waitingMoviesList = [];
    let likedMoviesCount = 0;
    let likedSeriesCount = 0;
    let likedAnimeCount = 0;
    let totalMinutes = 0;

    const decadeCounts = {};
    const favIds = Array.from(likedAndFavMovieIds).filter(id => favs[id]);

    const genreScores = {};
    const directorScores = {};
    const actorScores = {};
    const studioScores = {};

    likedAndFavMovieIds.forEach(id => {
      const m = moviesMap.get(id);
      if (m) {
        const released = !m.releaseDate || new Date(m.releaseDate) <= new Date("2026-05-19");
        if (released) {
          likedMoviesList.push(m);
          const t = m.type || "movie";
          if (t === "movie") likedMoviesCount++;
          if (t === "series") likedSeriesCount++;
          if (t === "anime") likedAnimeCount++;

          // Total Watch Time Parsing
          if (m.duration) {
            const match = String(m.duration).match(/(\d+)/);
            if (match) {
              totalMinutes += parseInt(match[1], 10);
            } else {
              totalMinutes += (t === "series" || t === "anime") ? 450 : 110;
            }
          } else {
            totalMinutes += (t === "series" || t === "anime") ? 450 : 110;
          }

          const isFav = !!favs[id];
          const weight = isFav ? 3 : 1;

          if (m.genres) {
            m.genres.split(", ").forEach(g => {
              genreScores[g] = (genreScores[g] || 0) + weight;
            });
          }
          if (m.year) {
            const decade = Math.floor(m.year / 10) * 10;
            decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
          }

          if (t === "movie" && m.director && m.director !== "N/A" && m.director !== "—") {
            m.director.split(", ").forEach(d => {
              directorScores[d] = (directorScores[d] || 0) + weight;
            });
          }

          if (m.actors && m.actors !== "N/A" && m.actors !== "—") {
            m.actors.split(", ").forEach(a => {
              actorScores[a] = (actorScores[a] || 0) + weight;
            });
          }

          if (t === "anime") {
            const studio = getAnimeStudio(m);
            if (studio && studio !== "Другая студия") {
              studioScores[studio] = (studioScores[studio] || 0) + weight;
            }
          }
        } else {
          waitingMoviesList.push(m);
        }
      }
    });

    const likes = likedMoviesList.length;

    const topGenres = Object.entries(genreScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);

    let favoriteDecade = "—";
    if (Object.keys(decadeCounts).length > 0) {
      const topDecade = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1])[0][0];
      favoriteDecade = `${topDecade}-е`;
    }

    let favoriteDirector = "—";
    if (Object.keys(directorScores).length > 0) {
      favoriteDirector = Object.entries(directorScores).sort((a, b) => b[1] - a[1])[0][0];
    }

    let favoriteActor = "—";
    if (Object.keys(actorScores).length > 0) {
      favoriteActor = Object.entries(actorScores).sort((a, b) => b[1] - a[1])[0][0];
    }

    let favoriteStudio = "—";
    if (Object.keys(studioScores).length > 0) {
      favoriteStudio = Object.entries(studioScores).sort((a, b) => b[1] - a[1])[0][0];
    }

    const shuffledLikes = [...likedMoviesList].sort(() => 0.5 - Math.random());
    const recentLikes = shuffledLikes.slice(0, 6);
    
    const favoriteMoviesList = Array.from(favIds).map(id => moviesMap.get(Number(id))).filter(Boolean);
    const favMovies = favoriteMoviesList.filter(m => (m.type || "movie") === "movie");
    const favSeries = favoriteMoviesList.filter(m => m.type === "series");
    const favAnime = favoriteMoviesList.filter(m => m.type === "anime");

    // Format Watch Time (X дн. Y ч. or X ч. Y мин.)
    let formattedWatchTime = "0 ч.";
    if (totalMinutes > 0) {
      const days = Math.floor(totalMinutes / (24 * 60));
      const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
      const mins = totalMinutes % 60;
      if (days > 0) {
        formattedWatchTime = `${days} дн. ${hours} ч.`;
      } else if (hours > 0) {
        formattedWatchTime = `${hours} ч. ${mins > 0 ? `${mins} мин.` : ""}`;
      } else {
        formattedWatchTime = `${mins} мин.`;
      }
    }
    
    return { 
      swiped, likes, matches: matchHistory.length, topGenres, favoriteDecade, recentLikes, 
      favMovies, favSeries, favAnime, ratings,
      likedMoviesCount, likedSeriesCount, likedAnimeCount,
      favoriteDirector, favoriteActor, favoriteStudio, likedMoviesList,
      waitingList: waitingMoviesList, totalMinutes, formattedWatchTime
    };
  }, [appData, currentUserDecisions, propFavorites, propRatings, matchHistory]);

  const ratingsCount = Object.keys(stats.ratings || {}).length;
  const totalFavs = stats.favMovies.length + stats.favSeries.length + stats.favAnime.length;

  // Rich Categorized Achievements Catalog
  const achievements = useMemo(() => [
    // Category: swipes
    { id: 1, category: "swipes", icon: "👶", title: "Новичок", desc: "Свайпнуть 10 тайтлов", curr: stats.swiped, max: 10, unlocked: stats.swiped >= 10 },
    { id: 2, category: "swipes", icon: "👀", title: "Смотрящий", desc: "Свайпнуть 50 тайтлов", curr: stats.swiped, max: 50, unlocked: stats.swiped >= 50 },
    { id: 3, category: "swipes", icon: "🍿", title: "Киноманьяк", desc: "Свайпнуть 100 тайтлов", curr: stats.swiped, max: 100, unlocked: stats.swiped >= 100 },
    { id: 4, category: "swipes", icon: "🚀", title: "Кибер-свайпер", desc: "Свайпнуть 500 тайтлов", curr: stats.swiped, max: 500, unlocked: stats.swiped >= 500 },
    { id: 5, category: "swipes", icon: "🏆", title: "Легенда свайпов", desc: "Свайпнуть 1000 тайтлов", curr: stats.swiped, max: 1000, unlocked: stats.swiped >= 1000 },

    // Category: categories
    { id: 6, category: "categories", icon: "🎬", title: "Кинолюб", desc: "Посмотреть 20 фильмов", curr: stats.likedMoviesCount, max: 20, unlocked: stats.likedMoviesCount >= 20 },
    { id: 7, category: "categories", icon: "🎥", title: "Кинокритик", desc: "Посмотреть 100 фильмов", curr: stats.likedMoviesCount, max: 100, unlocked: stats.likedMoviesCount >= 100 },
    { id: 8, category: "categories", icon: "📺", title: "Сериаломан", desc: "Посмотреть 10 сериалов", curr: stats.likedSeriesCount, max: 10, unlocked: stats.likedSeriesCount >= 10 },
    { id: 9, category: "categories", icon: "🛋️", title: "Бинжвотчер", desc: "Посмотреть 30 сериалов", curr: stats.likedSeriesCount, max: 30, unlocked: stats.likedSeriesCount >= 30 },
    { id: 10, category: "categories", icon: "🌌", title: "Марафонец", desc: "Посмотреть 50 сериалов", curr: stats.likedSeriesCount, max: 50, unlocked: stats.likedSeriesCount >= 50 },
    { id: 11, category: "categories", icon: "🌸", title: "Отаку", desc: "Посмотреть 10 аниме", curr: stats.likedAnimeCount, max: 10, unlocked: stats.likedAnimeCount >= 10 },
    { id: 12, category: "categories", icon: "⛩️", title: "Хокаге", desc: "Посмотреть 30 аниме", curr: stats.likedAnimeCount, max: 30, unlocked: stats.likedAnimeCount >= 30 },
    { id: 13, category: "categories", icon: "🦊", title: "Кавайный эксперт", desc: "Посмотреть 50 аниме", curr: stats.likedAnimeCount, max: 50, unlocked: stats.likedAnimeCount >= 50 },

    // Category: social
    { id: 14, category: "social", icon: "🤝", title: "Коннект", desc: "Получить 1 совпадение", curr: stats.matches, max: 1, unlocked: stats.matches >= 1 },
    { id: 15, category: "social", icon: "🥂", title: "Идеальная пара", desc: "Получить 5 совпадений", curr: stats.matches, max: 5, unlocked: stats.matches >= 5 },
    { id: 16, category: "social", icon: "👯", title: "Свои люди", desc: "Получить 15 совпадений", curr: stats.matches, max: 15, unlocked: stats.matches >= 15 },
    { id: 17, category: "social", icon: "🎉", title: "Душа компании", desc: "Получить 30 совпадений", curr: stats.matches, max: 30, unlocked: stats.matches >= 30 },

    // Category: ratings
    { id: 18, category: "ratings", icon: "⭐", title: "Первая оценка", desc: "Оценить 1 тайтл", curr: ratingsCount, max: 1, unlocked: ratingsCount >= 1 },
    { id: 19, category: "ratings", icon: "🌟", title: "Оценщик", desc: "Оценить 10 тайтлов", curr: ratingsCount, max: 10, unlocked: ratingsCount >= 10 },
    { id: 20, category: "ratings", icon: "💫", title: "Киноакадемик", desc: "Оценить 50 тайтлов", curr: ratingsCount, max: 50, unlocked: ratingsCount >= 50 },
    { id: 21, category: "ratings", icon: "💯", title: "Перфекционист", desc: "Поставить 10 баллов", curr: Object.values(stats.ratings).filter(r => r === 10).length, max: 1, unlocked: Object.values(stats.ratings).some(r => r === 10) },
    { id: 22, category: "ratings", icon: "👹", title: "Строгий критик", desc: "Поставить 1 балл", curr: Object.values(stats.ratings).filter(r => r === 1).length, max: 1, unlocked: Object.values(stats.ratings).some(r => r === 1) },
    { id: 23, category: "ratings", icon: "👑", title: "Великий судья", desc: "10 оценок по 10 баллов", curr: Object.values(stats.ratings).filter(r => r === 10).length, max: 10, unlocked: Object.values(stats.ratings).filter(r => r === 10).length >= 10 },
    { id: 24, category: "ratings", icon: "🔖", title: "Коллекционер", desc: "Добавить 5 в избранное", curr: totalFavs, max: 5, unlocked: totalFavs >= 5 },
    { id: 25, category: "ratings", icon: "📚", title: "Библиотекарь", desc: "Добавить 20 в избранное", curr: totalFavs, max: 20, unlocked: totalFavs >= 20 },
    { id: 26, category: "ratings", icon: "💎", title: "Сокровищница", desc: "Добавить 50 в избранное", curr: totalFavs, max: 50, unlocked: totalFavs >= 50 },
    { id: 27, category: "ratings", icon: "🏛️", title: "Хранитель музея", desc: "100 в избранном", curr: totalFavs, max: 100, unlocked: totalFavs >= 100 }
  ], [stats, ratingsCount, totalFavs]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const filteredAchievements = useMemo(() => {
    if (activeAchievementTab === "all") return achievements;
    return achievements.filter(a => a.category === activeAchievementTab);
  }, [achievements, activeAchievementTab]);

  // AI Taste Summary Client Fallback ("Жорик")
  const generateLocalAiSummary = (likedList) => {
    if (!likedList || likedList.length === 0) return "Отметьте просмотренные фильмы для составления ИИ-портрета!";
    const topRated = likedList.filter(m => (stats.ratings[m.id] || 0) >= 8);
    const mainGenre = stats.topGenres[0] || "драма";
    const dir = stats.favoriteDirector !== "—" ? stats.favoriteDirector : "мировых классиков";

    return `✨ **Кинопортрет от эксперта Жорика**\n\nВы — человек с четко сформулированным визионерским киновкусом. В ваших предпочтениях доминируют ${mainGenre} и картины с выраженным эмоциональным откликом. Вы отдаете предпочтение глубоким историям режиссуры уровня ${dir}.\n\nСреди ваших любимых находок выделяются ${topRated.slice(0, 2).map(m => `«${m.titleRu || m.title}»`).join(" и ") || "знаковые произведения вашего списка"}. Ваш 5D сенсорный вектор отражает сбалансированное стремление к интеллектуальной глубине и эмоциональному катарсису.\n\nПродолжайте открывать новые горизонты в MatchWatch — ваш кинематографический кругозор впечатляет!`;
  };

  const handleGenerateAiSummary = async () => {
    if (!user) return setAiError("Авторизуйтесь для генерации ИИ-портрета.");
    if (stats.likedMoviesList.length === 0) return setAiError("У вас пока нет просмотренных фильмов для анализа.");

    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/taste-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ likedMovies: stats.likedMoviesList })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.summary) {
          setAiSummary(data.summary);
          await set(ref(database, `users/${user.uid}/profile/aiTasteSummary`), data.summary);
          setAiLoading(false);
          return;
        }
      }
      const localSummary = generateLocalAiSummary(stats.likedMoviesList);
      setAiSummary(localSummary);
      await set(ref(database, `users/${user.uid}/profile/aiTasteSummary`), localSummary);
    } catch (err) {
      console.warn("Using client fallback generator:", err);
      const localSummary = generateLocalAiSummary(stats.likedMoviesList);
      setAiSummary(localSummary);
      await set(ref(database, `users/${user.uid}/profile/aiTasteSummary`), localSummary);
    } finally {
      setAiLoading(false);
    }
  };

  const handleShareProfile = () => {
    const link = `${window.location.origin}/?add=${encodeURIComponent(user.displayName)}`;
    const text = `Я ищу с кем посмотреть кино! 🍿 Добавляй меня в друзья в MatchWatch по тегу ${user.displayName}: ${link}`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };
  
  const handleMigrate = async (e) => {
    e.preventDefault();
    setMigrateError("");
    try {
      const { migrateLegacyUser } = await import("../firebase");
      await migrateLegacyUser(user, name, migrateTagInput || null);
    } catch (err) {
      setMigrateError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="profile-dashboard">
        <h2 className="page-title">Загрузка профиля...</h2>
      </div>
    );
  }

  const displayUser = user || propUser;

  if (displayUser && !displayUser.displayName) {
    return (
      <div className="profile-container">
        <motion.div className="auth-form-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h3>Обновление профиля</h3>
          <p style={{color: "rgba(255,255,255,0.7)", marginBottom: "20px", fontSize: "0.9rem", textAlign: "center"}}>
            Мы добавили систему друзей! Чтобы всё работало, придумайте себе Имя и уникальный Тег (4 цифры).
          </p>
          {migrateError && <div className="auth-error">{migrateError}</div>}
          <form onSubmit={handleMigrate} className="auth-form">
            <div className="form-group">
              <label>Ваше Имя</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Например: Иван" required className="form-input" />
            </div>
            <div className="form-group">
              <label>Тег (4 цифры, необязательно)</label>
              <input type="text" value={migrateTagInput} onChange={e => setMigrateTagInput(e.target.value)} placeholder="1111" className="form-input" maxLength={4} />
            </div>
            <button type="submit" className="btn-primary" style={{width: "100%", marginTop: "10px"}}>Сохранить</button>
          </form>
          <button className="btn-secondary" onClick={handleLogout} style={{width: "100%", marginTop: "10px"}}>Выйти</button>
        </motion.div>
      </div>
    );
  }

  const rawName = displayUser?.displayName || "Киноман#0000";
  const hasHashTag = rawName.includes('#');
  const namePart = hasHashTag ? rawName.split('#')[0] : rawName;
  const tagPart = hasHashTag ? ('#' + rawName.split('#')[1]) : '#0000';

    return (
      <div className="profile-dashboard relative overflow-hidden">
        <ChamaBackgroundArt type="SUNGLASSES" opacity={0.06} />
        <motion.div className="profile-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          
          {/* LEFT COLUMN: Hero Card, 5D Radar & AI Taste Generator */}
          <div className="profile-left" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Glass User Hero Card */}
            <div className="profile-card-main profile-hero-glass">
              <div 
                className="profile-avatar-large profile-avatar-interactive"
                onClick={() => setIsAvatarModalOpen(true)}
                title="Нажмите, чтобы изменить аватар"
              >
                {((profileData?.avatar && (profileData.avatar.startsWith("data:image/") || profileData.avatar.startsWith("http"))) || (profileData?.photoUrl && profileData.photoUrl.startsWith("http"))) ? (
                  <img 
                    src={(profileData?.avatar && profileData.avatar.startsWith("http")) ? profileData.avatar : (profileData?.photoUrl || profileData?.avatar)} 
                    alt="Avatar" 
                    referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  profileData?.avatar || "😎"
                )}
                <div className="avatar-edit-badge">✏️</div>
              </div>

              <h2 className="profile-display-name">
                <span className="profile-name-bold">{namePart}</span>
                <span className="profile-tag-dim">{tagPart}</span>
                <button className="btn-icon-edit" onClick={startEditingProfile} title="Редактировать имя и тег">✏️</button>
              </h2>

              {/* Editable Name & Tag Inline Modal / Section */}
              {isEditingProfile && (
                <form onSubmit={handleEditProfile} className="profile-edit-inline-form" style={{ width: "100%", margin: "12px 0" }}>
                  {editError && <div className="auth-error" style={{ fontSize: "0.85rem", marginBottom: "8px" }}>{editError}</div>}
                  {editSuccess && <div className="auth-success" style={{ color: "#32d74b", fontSize: "0.85rem", marginBottom: "8px", textAlign: "center" }}>{editSuccess}</div>}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="text"
                      className="form-input-glass"
                      placeholder="Имя"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      required
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      className="form-input-glass"
                      placeholder="Тег (4 цифры)"
                      value={editTag}
                      onChange={e => setEditTag(e.target.value)}
                      maxLength={4}
                      style={{ width: "110px" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button type="button" className="btn-glass-secondary btn-sm" onClick={() => setIsEditingProfile(false)}>Отмена</button>
                    <button type="submit" className="btn-glass-primary btn-sm">Сохранить</button>
                  </div>
                </form>
              )}

              {/* Inline Glass Bio Editor */}
              <div className="profile-bio-container" style={{ width: "100%", marginTop: "12px", marginBottom: "16px" }}>
                {isEditingBio ? (
                  <div className="bio-edit-wrapper">
                    <textarea
                      className="form-input-glass bio-textarea-glass"
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value)}
                      placeholder="Расскажите о своих кинопредпочтениях..."
                      maxLength={160}
                      rows={3}
                    />
                    <div className="bio-edit-footer">
                      <span className="char-counter">{bioInput.length} / 160</span>
                      <div className="bio-edit-actions">
                        <button className="btn-glass-secondary btn-sm" onClick={() => setIsEditingBio(false)}>Отмена</button>
                        <button className="btn-glass-primary btn-sm" onClick={handleSaveBio} disabled={bioSaving}>
                          {bioSuccess ? "✅ Сохранено" : bioSaving ? "Сохранение..." : "Сохранить"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="bio-display-wrapper" 
                    onClick={() => { setBioInput(profileData?.bio || ""); setIsEditingBio(true); }}
                    title="Нажмите, чтобы изменить био"
                  >
                    <p className={`profile-bio ${!profileData?.bio ? 'placeholder' : ''}`}>
                      {profileData?.bio || "Нажмите, чтобы добавить о себе пару слов 🍿"}
                    </p>
                    <span className="bio-edit-hint">✏️</span>
                  </div>
                )}
              </div>

              <button 
                className={`btn-share-profile ${copiedLink ? 'copied' : ''}`}
                onClick={handleShareProfile}
              >
                {copiedLink ? "✅ Скопировано!" : "🔗 Поделиться профилем"}
              </button>
            </div>

            {/* 5D Sensation Vibe Radar Chart */}
            <SensationRadarComponent likedMovies={stats.likedMoviesList} favorites={appData?.favorites || {}} />

            {/* Simple Taste Inference Output */}
            <div className="profile-card-stats simple-summary-glass-container" style={{ padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 style={{ fontSize: "0.95rem", margin: "0 0 8px 0", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                💡 Вывод по вашему вкусу:
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", lineHeight: "1.5" }}>
                {generateSimpleTasteInference({ likedMovies: stats.likedMoviesList, favorites: appData?.favorites || {} })}
              </p>
            </div>

          </div>

          {/* RIGHT COLUMN: Statistics & Top Favorites Grid */}
          <div className="profile-right" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Key Stats Grid with Total Watch Time */}
            <div className="profile-card-stats">
              <h3>📊 Статистика</h3>
              <div className="stats-grid-2col" style={{ marginBottom: "20px" }}>
                <div className="stat-card">
                  <div className="stat-value">{stats.likedMoviesCount}</div>
                  <div className="stat-label">🎬 Фильмов</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.likedSeriesCount}</div>
                  <div className="stat-label">📺 Сериалов</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.likedAnimeCount}</div>
                  <div className="stat-label">🌸 Аниме</div>
                </div>
                <div className="stat-card highlight-stat-card">
                  <div className="stat-value text-gradient-purple">⏱️ {stats.formattedWatchTime}</div>
                  <div className="stat-label">Время просмотра</div>
                </div>
                <div 
                  className="stat-card clickable-stat-card" 
                  style={{ 
                    background: "linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(233, 30, 99, 0.1) 100%)", 
                    border: "1px solid rgba(255, 215, 0, 0.3)",
                    cursor: "pointer" 
                  }}
                  onClick={() => document.querySelector(".profile-card-favorites")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <div className="stat-value" style={{ color: "#ffd700" }}>⭐ {totalFavs}</div>
                  <div className="stat-label">В избранном</div>
                </div>
                <div className="stat-card" style={{ background: "rgba(255, 138, 80, 0.1)", border: "1px solid rgba(255, 138, 80, 0.3)" }}>
                  <div className="stat-value" style={{ color: "#ff8a50" }}>⏳ {stats.waitingList?.length || 0}</div>
                  <div className="stat-label">В ожидании</div>
                </div>
              </div>
              
              <div className="stats-detailed-box" style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "rgba(255,255,255,0.7)" }}>❤️ Любимые жанры</h4>
                  <div className="stats-tags">
                    {stats.topGenres.length > 0 ? stats.topGenres.map(g => (
                      <span key={g} className="stats-tag" style={{ background: "rgba(255, 138, 80, 0.15)", color: "#ff8a50", border: "1px solid rgba(255, 138, 80, 0.3)" }}>{g}</span>
                    )) : <span className="stats-tag dim">Нет данных</span>}
                  </div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "5px" }}>
                  <div className="detail-stat-row" style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "4px" }}>Любимый режиссер</div>
                    <div style={{ fontWeight: "bold", fontSize: "0.95rem", color: "#fff" }}>{stats.favoriteDirector}</div>
                  </div>
                  
                  <div className="detail-stat-row" style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "4px" }}>Любимый актер</div>
                    <div 
                      style={{
                        fontWeight: "bold", 
                        fontSize: "0.95rem", 
                        color: stats.favoriteActor !== "—" ? "#ff8a50" : "#fff", 
                        whiteSpace: "nowrap", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis",
                        cursor: stats.favoriteActor !== "—" ? "pointer" : "default",
                        textDecoration: stats.favoriteActor !== "—" ? "underline dashed rgba(255, 138, 80, 0.4)" : "none"
                      }} 
                      title={stats.favoriteActor}
                      onClick={() => {
                        if (stats.favoriteActor !== "—") {
                          window.dispatchEvent(new CustomEvent("show-actor-details", { detail: stats.favoriteActor }));
                        }
                      }}
                    >
                      {stats.favoriteActor}
                    </div>
                  </div>
                </div>

                <div className="detail-stat-row" style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "4px" }}>Любимая аниме студия</div>
                  <div style={{ fontWeight: "bold", fontSize: "0.95rem", color: "#ff8a50" }}>{stats.favoriteStudio}</div>
                </div>
              </div>
            </div>

            {/* Top Favorites Grid with Category Filter Tabs */}
            <div className="profile-card-stats profile-card-favorites">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0 }}>⭐️ Избранные Тайтлы</h3>
                {totalFavs > 6 && (
                  <button className="btn-text-gold" onClick={() => setShowAllFavorites(true)}>
                    Смотреть все ({totalFavs}) →
                  </button>
                )}
              </div>

              {/* Favorites Category Filter Tabs */}
              <div className="category-picker-mini" style={{ marginBottom: "16px" }}>
                <button className={`tab-btn ${activeFavoritesTab === 'all' ? 'active' : ''}`} onClick={() => setActiveFavoritesTab('all')}>Все</button>
                <button className={`tab-btn ${activeFavoritesTab === 'movie' ? 'active' : ''}`} onClick={() => setActiveFavoritesTab('movie')}>Фильмы</button>
                <button className={`tab-btn ${activeFavoritesTab === 'series' ? 'active' : ''}`} onClick={() => setActiveFavoritesTab('series')}>Сериалы</button>
                <button className={`tab-btn ${activeFavoritesTab === 'anime' ? 'active' : ''}`} onClick={() => setActiveFavoritesTab('anime')}>Аниме</button>
              </div>

              <div className="favorites-grid-responsive">
                {[...stats.favMovies, ...stats.favSeries, ...stats.favAnime]
                  .filter(m => activeFavoritesTab === 'all' || (m.type || 'movie') === activeFavoritesTab)
                  .map(m => (
                    <div key={m.id} className="favorite-card-glass" onClick={() => setSelectedMovie(m)}>
                      <img src={m.poster} alt={m.title} />
                      <div className="favorite-card-info">
                        <div className="fav-title">{m.titleRu || m.title}</div>
                        {stats.ratings[m.id] && <div className="fav-rating">★ {stats.ratings[m.id]}</div>}
                      </div>
                    </div>
                  ))}

                {totalFavs === 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <ChamaBanner
                      type="EMPTY_POPCORN"
                      title="Список избранного пуст"
                      text="Вы пока не добавили ничего в избранное. Нажмите ⭐️ на карточке фильма во время свайпов!"
                      size="large"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Waiting List section */}
            {stats.waitingList && stats.waitingList.length > 0 && (
              <div className="profile-card-stats profile-card-favorites" style={{ marginTop: "20px" }}>
                <h3>⏳ Список ожидания</h3>
                <div className="favorites-category-section">
                  <h4>Ожидаемые премьеры</h4>
                  <div className="favorites-horizontal-scroll" style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "10px" }}>
                    {stats.waitingList.map(m => {
                      const days = Math.ceil((new Date(m.releaseDate) - new Date("2026-05-19")) / (1000 * 60 * 60 * 24));
                      const text = days === 1 ? "Завтра!" : days === 2 ? "Послезавтра!" : days <= 30 ? `${days} дн.` : `${Math.floor(days / 30)} мес.`;
                      return (
                        <div 
                          key={m.id} 
                          className="favorite-item-card" 
                          title={`${m.titleRu || m.title} (Релиз: ${m.releaseDate})`}
                          onClick={() => setSelectedMovie(m)}
                          style={{ cursor: "pointer", position: "relative" }}
                        >
                          <img src={m.poster} alt={m.title} />
                          <div 
                            style={{
                              position: "absolute",
                              bottom: "5px",
                              left: "5px",
                              right: "5px",
                              background: "linear-gradient(135deg, rgba(255, 138, 80, 0.95) 0%, rgba(233, 30, 99, 0.95) 100%)",
                              color: "#fff",
                              padding: "2px 4px",
                              borderRadius: "4px",
                              fontSize: "0.6rem",
                              fontWeight: "bold",
                              textAlign: "center",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.4)"
                            }}
                          >
                            {text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Categorized Achievements Badges System Overhaul */}
          <div className="profile-card-achievements" style={{ gridColumn: "1 / -1", marginTop: "12px" }}>
            <div className="achievements-header">
              <h3>🏆 Достижения ({unlockedCount} / {achievements.length})</h3>
              <div className="achievements-progress-pill">
                {Math.round((unlockedCount / achievements.length) * 100)}% заполнено
              </div>
            </div>

            {/* Achievement Category Tabs */}
            <div className="category-picker-mini" style={{ marginBottom: "20px" }}>
              <button className={`tab-btn ${activeAchievementTab === 'all' ? 'active' : ''}`} onClick={() => setActiveAchievementTab('all')}>Все</button>
              <button className={`tab-btn ${activeAchievementTab === 'swipes' ? 'active' : ''}`} onClick={() => setActiveAchievementTab('swipes')}>🍿 Свайпы</button>
              <button className={`tab-btn ${activeAchievementTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveAchievementTab('categories')}>🎬 Категории</button>
              <button className={`tab-btn ${activeAchievementTab === 'social' ? 'active' : ''}`} onClick={() => setActiveAchievementTab('social')}>🤝 Социальные</button>
              <button className={`tab-btn ${activeAchievementTab === 'ratings' ? 'active' : ''}`} onClick={() => setActiveAchievementTab('ratings')}>⭐ Оценки</button>
            </div>

            <div className="achievements-grid-responsive">
              {filteredAchievements.map(ach => {
                const pct = Math.min(100, Math.round((ach.curr / ach.max) * 100));
                return (
                  <div key={ach.id} className={`achievement-card-glass ${ach.unlocked ? "unlocked" : "locked"}`}>
                    <div className="ach-icon-container">
                      <span className="ach-icon">{ach.icon}</span>
                      {ach.unlocked ? (
                        <span className="ach-check">✓</span>
                      ) : (
                        <span className="ach-lock">🔒</span>
                      )}
                    </div>
                    <div className="ach-body">
                      <div className="ach-title">{ach.title}</div>
                      <div className="ach-desc">{ach.desc}</div>
                      {!ach.unlocked && (
                        <div className="ach-progress-wrapper">
                          <div className="ach-progress-bar">
                            <div className="ach-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="ach-progress-text">{ach.curr} / {ach.max}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </motion.div>

        {/* Avatar Picker Glass Modal */}
        {isAvatarModalOpen && (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content glass-modal" style={{ maxWidth: "480px", width: "90%" }}>
              <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, color: "#fff" }}>🎨 Выберите аватар</h3>
                <button className="close-btn modal-close-btn" onClick={() => setIsAvatarModalOpen(false)}>✕</button>
              </div>
              
              <div className="avatar-picker-body">
                <label className="picker-label" style={{ fontSize: "0.85rem", color: "var(--text-sub)", marginBottom: "10px", display: "block" }}>
                  Готовые эмодзи-аватары
                </label>
                <div className="avatar-presets-grid">
                  {AVATAR_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      className={`avatar-preset-btn ${profileData?.avatar === emoji ? 'active' : ''}`}
                      onClick={() => handleSelectAvatar(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="picker-divider" style={{ textAlign: "center", margin: "16px 0", color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
                  или загрузите фото с устройства
                </div>

                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label className="btn-glass-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", width: "100%", padding: "10px", borderRadius: "10px" }}>
                    📁 Выбрать фото с устройства
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert("Файл слишком большой. Пожалуйста, выберите фото до 5 МБ.");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (uploadEvent) => {
                            const base64Data = uploadEvent.target.result;
                            handleSelectAvatar(base64Data);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="picker-divider" style={{ textAlign: "center", margin: "12px 0", color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
                  или укажите прямую URL ссылку
                </div>

                <div className="form-group" style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="url"
                    className="form-input-glass"
                    placeholder="https://example.com/avatar.png"
                    value={avatarUrlInput}
                    onChange={(e) => setAvatarUrlInput(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn-glass-primary"
                    onClick={() => {
                      if (avatarUrlInput.trim()) {
                        handleSelectAvatar(avatarUrlInput.trim());
                      }
                    }}
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expanded Favorites Modal */}
        {showAllFavorites && (
          <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div className="modal-content glass-modal" style={{ maxWidth: "1100px", width: "95%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, color: "#fff" }}>⭐ Все избранное ({totalFavs})</h2>
                <button className="close-btn modal-close-btn" onClick={() => setShowAllFavorites(false)}>✕</button>
              </div>
              <div className="favorites-all-grid" style={{ paddingBottom: "24px" }}>
                {[...stats.favMovies, ...stats.favSeries, ...stats.favAnime].map(m => (
                  <div 
                    key={m.id} 
                    className="favorite-grid-card" 
                    onClick={() => {
                      setSelectedMovie(m);
                    }}
                  >
                    <img src={m.poster} alt={m.title} />
                    <div className="favorite-grid-title">
                      {m.titleRu || m.title}
                    </div>
                    {stats.ratings[m.id] && (
                      <div className="favorite-rating-badge">
                        ★ {stats.ratings[m.id]}
                      </div>
                    )}
                  </div>
                ))}
                {totalFavs === 0 && (
                  <p style={{ color: "rgba(255,255,255,0.5)", gridColumn: "1 / -1", textAlign: "center", padding: "40px" }}>Нет избранных элементов.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Detailed Movie Modal */}
        {selectedMovie && (
          <DetailedMovieModal 
            movie={selectedMovie} 
            onClose={() => setSelectedMovie(null)}
            isLiked={((appData || {}).decisions || {})[selectedMovie.id] === "like"}
            onToggleLike={toggleLike}
            isFavorite={!!((appData || {}).favorites || {})[selectedMovie.id]}
            onToggleFavorite={toggleFavorite}
            rating={((appData || {}).ratings || {})[selectedMovie.id]}
            onSetRating={handleSetRating}
          />
        )}
      </div>
    );
}
