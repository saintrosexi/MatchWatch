import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { auth, database, registerWithTag, signInWithEmailAndPassword, signOut, updateUserTag } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";
import "./MovieModal.css";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  
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
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
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

  const getAnimeStudio = (movie) => {
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
    
    if (title.includes("атака титанов") || title.includes("shingeki")) {
      return "Wit Studio / MAPPA";
    }
    if (title.includes("клинок") || title.includes("демонов") || title.includes("kimetsu")) {
      return "ufotable";
    }
    if (title.includes("тетрадь смерти") || title.includes("death note") || title.includes("ванпанчмен") || title.includes("one punch") || title.includes("хантер") || title.includes("hunter") || title.includes("пираты черной лагуны") || title.includes("паразит")) {
      return "Madhouse";
    }
    if (title.includes("баскетбол куроко") || title.includes("волейбол") || title.includes("haikyu") || title.includes("психопаспорт") || title.includes("psycho-pass")) {
      return "Production I.G";
    }
    if (title.includes("наруто") || title.includes("naruto") || title.includes("блич") || title.includes("bleach") || title.includes("гуль") || title.includes("tokyo ghoul")) {
      return "Studio Pierrot";
    }
    if (title.includes("ван пис") || title.includes("one piece") || title.includes("драгонболл") || title.includes("сэйлор мун")) {
      return "Toei Animation";
    }
    if (title.includes("полнометаллический алхимик") || title.includes("fullmetal") || title.includes("моя геройская академия") || title.includes("hero academia") || title.includes("бездомный бог") || title.includes("noragami")) {
      return "Bones";
    }
    if (title.includes("код гиас") || title.includes("code geass") || title.includes("ковбой бибоп") || title.includes("cowboy bebop")) {
      return "Sunrise";
    }
    if (title.includes("человек-бензопила") || title.includes("chainsaw") || title.includes("магическая битва") || title.includes("jujutsu")) {
      return "MAPPA";
    }
    if (title.includes("форма голоса") || title.includes("silent voice") || title.includes("вайолет эвергарден") || title.includes("violet evergarden") || dir.includes("yamada") || dir.includes("ямада")) {
      return "Kyoto Animation";
    }
    if (title.includes("доктор стоун") || title.includes("dr. stone") || title.includes("детектор")) {
      return "TMS Entertainment";
    }
    if (title.includes("повелитель") || title.includes("overlord") || title.includes("реинкарнация безработного") || title.includes("mushoku")) {
      return "Studio Bind / Madhouse";
    }
    if (title.includes("мастера меча онлайн") || title.includes("sao") || title.includes("sword art online") || title.includes("хвост феи") || title.includes("fairy tail")) {
      return "A-1 Pictures";
    }
    
    if (dir.includes("miyazaki") || dir.includes("миядзаки")) {
      return "Studio Ghibli";
    }
    
    return "Другая студия";
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

  // Stats calculation
  const stats = useMemo(() => {
    if (!appData) return { 
      swiped: 0, likes: 0, matches: matchHistory.length, 
      topGenres: [], favoriteDecade: "—", recentLikes: [], 
      favMovies: [], favSeries: [], favAnime: [], ratings: {},
      likedMoviesCount: 0, likedSeriesCount: 0, likedAnimeCount: 0,
      favoriteDirector: "—", favoriteActor: "—", favoriteStudio: "—",
      waitingList: []
    };
    const decs = appData.decisions || {};
    const swiped = Object.keys(decs).length;
    
    const likedMoviesList = [];
    const waitingMoviesList = [];
    let likedMoviesCount = 0;
    let likedSeriesCount = 0;
    let likedAnimeCount = 0;

    const decadeCounts = {};
    const favIds = Object.keys(appData.favorites || {}).filter(id => appData.favorites[id]);
    const ratings = appData.ratings || {};

    const genreScores = {};
    const directorScores = {};
    const actorScores = {};
    const studioScores = {};

    const moviesMap = new Map();
    movies.forEach(m => moviesMap.set(m.id, m));

    Object.keys(decs).forEach(id => {
      if (decs[id] === "like") {
        const m = moviesMap.get(parseInt(id));
        if (m) {
          const released = !m.releaseDate || new Date(m.releaseDate) <= new Date("2026-05-19");
          if (released) {
            likedMoviesList.push(m);
            const t = m.type || "movie";
            if (t === "movie") likedMoviesCount++;
            if (t === "series") likedSeriesCount++;
            if (t === "anime") likedAnimeCount++;

            const isFav = favIds.includes(id);
            const weight = isFav ? 3 : 1; // +1 for like, +2 extra for favorite

            if (m.genres) {
              m.genres.split(", ").forEach(g => {
                genreScores[g] = (genreScores[g] || 0) + weight;
              });
            }
            if (m.year) {
              const decade = Math.floor(m.year / 10) * 10;
              decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
            }

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

            // Anime Studio
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
    
    const favoriteMoviesList = favIds.map(id => moviesMap.get(parseInt(id))).filter(Boolean);
    const favMovies = favoriteMoviesList.filter(m => (m.type || "movie") === "movie");
    const favSeries = favoriteMoviesList.filter(m => m.type === "series");
    const favAnime = favoriteMoviesList.filter(m => m.type === "anime");
    
    return { 
      swiped, likes, matches: matchHistory.length, topGenres, favoriteDecade, recentLikes, 
      favMovies, favSeries, favAnime, ratings,
      likedMoviesCount, likedSeriesCount, likedAnimeCount,
      favoriteDirector, favoriteActor, favoriteStudio,
      waitingList: waitingMoviesList
    };
  }, [appData, matchHistory]);

  const ratingsCount = Object.keys(stats.ratings || {}).length;

  const achievements = [
    { icon: "👶", title: "Новичок", desc: "Свайпнуть 10 тайтлов", unlocked: stats.swiped >= 10 },
    { icon: "👀", title: "Смотрящий", desc: "Свайпнуть 50 тайтлов", unlocked: stats.swiped >= 50 },
    { icon: "🍿", title: "Киноманьяк", desc: "Свайпнуть 100 тайтлов", unlocked: stats.swiped >= 100 },
    { icon: "🚀", title: "Кибер-свайпер", desc: "Свайпнуть 500 тайтлов", unlocked: stats.swiped >= 500 },
    { icon: "🏆", title: "Легенда свайпов", desc: "Свайпнуть 1000 тайтлов", unlocked: stats.swiped >= 1000 },
    
    { icon: "🤍", title: "Симпатия", desc: "Отметить 10 просмотренных", unlocked: stats.likes >= 10 },
    { icon: "❤️", title: "Доброе сердце", desc: "Отметить 50 просмотренных", unlocked: stats.likes >= 50 },
    { icon: "💖", title: "Всеядный", desc: "Отметить 100 просмотренных", unlocked: stats.likes >= 100 },
    { icon: "🔥", title: "Пылающий экран", desc: "Отметить 250 просмотренных", unlocked: stats.likes >= 250 },
    
    { icon: "🤝", title: "Коннект", desc: "Получить 1 совпадение", unlocked: stats.matches >= 1 },
    { icon: "🥂", title: "Идеальная пара", desc: "Получить 5 совпадений", unlocked: stats.matches >= 5 },
    { icon: "👯", title: "Свои люди", desc: "Получить 15 совпадений", unlocked: stats.matches >= 15 },
    { icon: "🎉", title: "Душа компании", desc: "Получить 30 совпадений", unlocked: stats.matches >= 30 },
    
    { icon: "🎬", title: "Кинолюб", desc: "Посмотреть 20 фильмов", unlocked: stats.likedMoviesCount >= 20 },
    { icon: "🎥", title: "Кинокритик", desc: "Посмотреть 100 фильмов", unlocked: stats.likedMoviesCount >= 100 },
    { icon: "📺", title: "Сериаломан", desc: "Посмотреть 10 сериалов", unlocked: stats.likedSeriesCount >= 10 },
    { icon: "🛋️", title: "Бинжвотчер", desc: "Посмотреть 30 сериалов", unlocked: stats.likedSeriesCount >= 30 },
    { icon: "🌸", title: "Отаку", desc: "Посмотреть 10 аниме", unlocked: stats.likedAnimeCount >= 10 },
    { icon: "⛩️", title: "Хокаге", desc: "Посмотреть 30 аниме", unlocked: stats.likedAnimeCount >= 30 },
    
    { icon: "⭐", title: "Первая оценка", desc: "Оценить 1 тайтл", unlocked: ratingsCount >= 1 },
    { icon: "🌟", title: "Оценщик", desc: "Оценить 10 тайтлов", unlocked: ratingsCount >= 10 },
    { icon: "💫", title: "Киноакадемик", desc: "Оценить 50 тайтлов", unlocked: ratingsCount >= 50 },
    
    { icon: "🔖", title: "Коллекционер", desc: "Добавить 5 в избранное", unlocked: stats.favMovies.length + stats.favSeries.length + stats.favAnime.length >= 5 },
    { icon: "📚", title: "Библиотекарь", desc: "Добавить 20 в избранное", unlocked: stats.favMovies.length + stats.favSeries.length + stats.favAnime.length >= 20 },
    { icon: "💎", title: "Сокровищница", desc: "Добавить 50 в избранное", unlocked: stats.favMovies.length + stats.favSeries.length + stats.favAnime.length >= 50 },

    { icon: "🌌", title: "Марафонец", desc: "Посмотреть 50 сериалов", unlocked: stats.likedSeriesCount >= 50 },
    { icon: "🦊", title: "Кавайный эксперт", desc: "Посмотреть 50 аниме", unlocked: stats.likedAnimeCount >= 50 },
    { icon: "🌀", title: "Сенсей", desc: "Посмотреть 100 аниме", unlocked: stats.likedAnimeCount >= 100 },
    { icon: "💯", title: "Перфекционист", desc: "Поставить оценку 10", unlocked: Object.values(stats.ratings).some(r => r === 10) },
    { icon: "👹", title: "Строгий критик", desc: "Поставить оценку 1", unlocked: Object.values(stats.ratings).some(r => r === 1) },
    { icon: "👑", title: "Великий судья", desc: "10 оценок по 10 баллов", unlocked: Object.values(stats.ratings).filter(r => r === 10).length >= 10 },
    { icon: "🏛️", title: "Хранитель музея", desc: "100 тайтлов в избранном", unlocked: (stats.favMovies.length + stats.favSeries.length + stats.favAnime.length) >= 100 }
  ];
  
  const handleResetProgress = async () => {
    if (window.confirm("Вы уверены? Это удалит все ваши лайки и свайпы (история совпадений останется).")) {
      await set(ref(database, `users/${user.uid}/appData/decisions`), null);
      alert("Прогресс сброшен!");
    }
  };
  
  const handleShareProfile = () => {
    const link = `${window.location.origin}/?add=${encodeURIComponent(user.displayName)}`;
    const text = `Я ищу с кем посмотреть кино! 🍿 Добавляй меня в друзья в MatchWatch по тегу ${user.displayName} или переходи по ссылке: ${link}`;
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
      <div className="profile-container">
        <h2 className="page-title">Загрузка профиля...</h2>
      </div>
    );
  }

  if (user) {
    if (!user.displayName || !user.displayName.includes("#")) {
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

    const namePart = user.displayName.split('#')[0];
    const tagPart = '#' + user.displayName.split('#')[1];

    return (
      <div className="profile-dashboard">
        <motion.div className="profile-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          
          {/* LEFT COLUMN */}
          <div className="profile-left" style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            <div className="profile-card-main" style={{ marginBottom: 0 }}>
              <div className="profile-avatar-large" style={{ overflow: "hidden" }}>
                {(profileData?.avatar && (profileData.avatar.startsWith("data:image/") || profileData.avatar.startsWith("http"))) ? (
                  <img src={profileData.avatar} alt="Avatar" />
                ) : (
                  profileData?.avatar || "😎"
                )}
              </div>
              <h2 className="profile-display-name">
                <span className="profile-name-bold">{namePart}</span>
                <span className="profile-tag-dim">{tagPart}</span>
              </h2>

              {/* Bio Block */}
              <div className="profile-bio-container" style={{ width: "100%", marginTop: "15px", marginBottom: "15px" }}>
                {profileData?.bio ? (
                  <p className="profile-bio" style={{
                    color: "rgba(255, 255, 255, 0.85)",
                    fontSize: "0.95rem",
                    lineHeight: "1.4",
                    background: "rgba(255, 255, 255, 0.05)",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    borderLeft: "3px solid #ff8a50",
                    textAlign: "left",
                    margin: 0,
                    wordBreak: "break-word"
                  }}>
                    {profileData.bio}
                  </p>
                ) : (
                  <p className="profile-bio-placeholder" style={{
                    color: "rgba(255, 255, 255, 0.4)",
                    fontSize: "0.85rem",
                    fontStyle: "italic",
                    margin: 0,
                    textAlign: "center"
                  }}>
                    Напишите что-нибудь о себе в настройках ⚙️
                  </p>
                )}
              </div>

              <button 
                className={`btn-share-profile ${copiedLink ? 'copied' : ''}`}
                onClick={handleShareProfile}
              >
                {copiedLink ? "✅ Скопировано!" : "🔗 Поделиться профилем"}
              </button>
            </div>

            <div className="profile-card-achievements">
              <h3>🏆 Достижения</h3>
              <div className="achievements-grid-2col">
                {achievements.map(ach => (
                  <div key={ach.title} className={`achievement-card ${ach.unlocked ? "unlocked" : "locked"}`}>
                    <div className="ach-icon">{ach.icon}</div>
                    <div className="ach-title">{ach.title}</div>
                    <div className="ach-desc">{ach.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="profile-right">
            <div className="profile-card-stats">
              <h3>📊 Статистика</h3>
              <div className="stats-grid-2col" style={{marginBottom: "20px"}}>
                <div className="stat-card">
                  <div className="stat-value">{stats.likedMoviesCount}</div>
                  <div className="stat-label">Просмотрено фильмов</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.likedSeriesCount}</div>
                  <div className="stat-label">Просмотрено сериалов</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.likedAnimeCount}</div>
                  <div className="stat-label">Просмотрено аниме</div>
                </div>
                <div className="stat-card" style={{ background: "linear-gradient(135deg, rgba(255, 138, 80, 0.1) 0%, rgba(233, 30, 99, 0.1) 100%)", border: "1px solid rgba(255, 138, 80, 0.3)" }}>
                  <div className="stat-value" style={{ color: "#ff8a50" }}>⏳ {stats.waitingList?.length || 0}</div>
                  <div className="stat-label">В списке ожидания</div>
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
                  <div className="stat-value" style={{ color: "#ffd700" }}>⭐ {stats.favMovies.length + stats.favSeries.length + stats.favAnime.length}</div>
                  <div className="stat-label">В избранном</div>
                </div>
              </div>
              
              <div className="stats-detailed-box" style={{marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px"}}>
                <div>
                  <h4 style={{margin: "0 0 8px 0", fontSize: "0.95rem", color: "rgba(255,255,255,0.7)"}}>❤️ Любимые жанры</h4>
                  <div className="stats-tags">
                    {stats.topGenres.length > 0 ? stats.topGenres.map(g => (
                      <span key={g} className="stats-tag" style={{background: "rgba(255, 138, 80, 0.15)", color: "#ff8a50", border: "1px solid rgba(255, 138, 80, 0.3)"}}>{g}</span>
                    )) : <span className="stats-tag dim">Нет данных</span>}
                  </div>
                </div>
                
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "5px"}}>
                  <div className="detail-stat-row" style={{background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)"}}>
                    <div style={{fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "4px"}}>Любимый режиссер</div>
                    <div style={{fontWeight: "bold", fontSize: "0.95rem", color: "#fff"}}>{stats.favoriteDirector}</div>
                  </div>
                  
                  <div className="detail-stat-row" style={{background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)"}}>
                    <div style={{fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "4px"}}>Любимый актер</div>
                    <div style={{fontWeight: "bold", fontSize: "0.95rem", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}} title={stats.favoriteActor}>{stats.favoriteActor}</div>
                  </div>
                </div>

                <div className="detail-stat-row" style={{background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)"}}>
                  <div style={{fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "4px"}}>Любимая аниме студия</div>
                  <div style={{fontWeight: "bold", fontSize: "0.95rem", color: "#ff8a50"}}>{stats.favoriteStudio}</div>
                </div>
              </div>
            </div>

            <div className="profile-card-stats profile-card-favorites" style={{marginTop: "20px"}}>
              <h3>⭐️ Избранное</h3>
              
              {stats.favMovies.length > 0 && (
                <div className="favorites-category-section">
                  <h4>Любимые фильмы</h4>
                  <div className="favorites-horizontal-scroll">
                    {stats.favMovies.map(m => (
                      <div 
                        key={m.id} 
                        className="favorite-item-card" 
                        title={m.titleRu || m.title}
                        onClick={() => setSelectedMovie(m)}
                        style={{cursor: "pointer"}}
                      >
                        <img src={m.poster} alt={m.title} />
                        {stats.ratings[m.id] && <div className="favorite-rating-badge">★ {stats.ratings[m.id]}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.favSeries.length > 0 && (
                <div className="favorites-category-section">
                  <h4>Любимые сериалы</h4>
                  <div className="favorites-horizontal-scroll">
                    {stats.favSeries.map(m => (
                      <div 
                        key={m.id} 
                        className="favorite-item-card" 
                        title={m.titleRu || m.title}
                        onClick={() => setSelectedMovie(m)}
                        style={{cursor: "pointer"}}
                      >
                        <img src={m.poster} alt={m.title} />
                        {stats.ratings[m.id] && <div className="favorite-rating-badge">★ {stats.ratings[m.id]}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.favAnime.length > 0 && (
                <div className="favorites-category-section">
                  <h4>Любимое аниме</h4>
                  <div className="favorites-horizontal-scroll">
                    {stats.favAnime.map(m => (
                      <div 
                        key={m.id} 
                        className="favorite-item-card" 
                        title={m.titleRu || m.title}
                        onClick={() => setSelectedMovie(m)}
                        style={{cursor: "pointer"}}
                      >
                        <img src={m.poster} alt={m.title} />
                        {stats.ratings[m.id] && <div className="favorite-rating-badge">★ {stats.ratings[m.id]}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.favMovies.length === 0 && stats.favSeries.length === 0 && stats.favAnime.length === 0 && (
                 <p className="setting-hint" style={{textAlign: "center", padding: "20px 0"}}>Вы пока не добавили ничего в избранное.</p>
              )}
            </div>

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

        </motion.div>

        {/* Mixed Favorites Grid Modal */}
        {showAllFavorites && (
          <div className="modal-overlay" style={{zIndex: 1000}}>
            <div className="modal-content" style={{maxWidth: "1100px", width: "95%"}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px"}}>
                <h2 style={{margin: 0, color: "#fff"}}>⭐ Все избранное</h2>
                <button className="modal-close" onClick={() => setShowAllFavorites(false)}>✕</button>
              </div>
              <div className="favorites-all-grid">
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
                {([...stats.favMovies, ...stats.favSeries, ...stats.favAnime]).length === 0 && (
                  <p style={{color: "rgba(255,255,255,0.5)", gridColumn: "1 / -1", textAlign: "center", padding: "40px"}}>Нет избранных элементов.</p>
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

  // Auth form rendering
  return (
    <div className="profile-container">
      <h2 className="page-title">👤 Аккаунт</h2>
      
      <motion.div className="auth-form-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h3>{isLoginMode ? "Вход" : "Регистрация"}</h3>
        
        {authError && <div className="auth-error">{authError}</div>}
        
        <form onSubmit={handleAuth} className="auth-form">
          {!isLoginMode && (
            <div className="form-group">
              <label>Имя</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Например: Иван" 
                required 
                className="form-input"
              />
              <small style={{color: 'rgba(255,255,255,0.5)', marginTop: '4px'}}>К имени будет добавлен уникальный тег</small>
            </div>
          )}
          {!isLoginMode && (
            <div className="form-group">
              <label>Желаемый тег (4 цифры, необязательно)</label>
              <input 
                type="text" 
                value={customTag} 
                onChange={(e) => setCustomTag(e.target.value)} 
                placeholder="1111" 
                className="form-input"
                maxLength={4}
              />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="example@mail.com" 
              required 
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label>Пароль</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Минимум 6 символов" 
              required 
              className="form-input"
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={authLoading} style={{ width: "100%", marginTop: "10px" }}>
            {authLoading ? "Загрузка..." : (isLoginMode ? "Войти" : "Зарегистрироваться")}
          </button>
        </form>
        
        <div className="auth-toggle">
          {isLoginMode ? "Нет аккаунта?" : "Уже есть аккаунт?"}
          <button 
            type="button" 
            className="btn-text" 
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setAuthError("");
            }}
          >
            {isLoginMode ? "Создать" : "Войти"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
