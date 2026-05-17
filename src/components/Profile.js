import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { auth, database, registerWithTag, signInWithEmailAndPassword, signOut, updateUserTag } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { movies } from "../data";

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
    if (!auth) {
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

  // Stats calculation
  const stats = useMemo(() => {
    if (!appData) return { swiped: 0, likes: 0, matches: matchHistory.length, topGenres: [], favoriteDecade: "—", recentLikes: [], favMovies: [], favSeries: [], favAnime: [], ratings: {} };
    const decs = appData.decisions || {};
    const swiped = Object.keys(decs).length;
    const likes = Object.values(decs).filter(d => d === "like").length;
    
    const genreCounts = {};
    const decadeCounts = {};
    const likedMovies = [];

    Object.keys(decs).forEach(id => {
      if (decs[id] === "like") {
        const m = movies.find(x => x.id === parseInt(id));
        if (m) {
          likedMovies.push(m);
          if (m.genres) {
            m.genres.split(", ").forEach(g => {
              genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
          }
          if (m.year) {
            const decade = Math.floor(m.year / 10) * 10;
            decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
          }
        }
      }
    });

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);

    let favoriteDecade = "—";
    if (Object.keys(decadeCounts).length > 0) {
      const topDecade = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1])[0][0];
      favoriteDecade = `${topDecade}-е`;
    }

    const shuffledLikes = [...likedMovies].sort(() => 0.5 - Math.random());
    const recentLikes = shuffledLikes.slice(0, 6);
    
    // Favorites calculations
    const favIds = Object.keys(appData.favorites || {}).filter(id => appData.favorites[id]);
    const ratings = appData.ratings || {};
    const favoriteMoviesList = favIds.map(id => movies.find(m => m.id === parseInt(id))).filter(Boolean);
    const favMovies = favoriteMoviesList.filter(m => (m.type || "movie") === "movie");
    const favSeries = favoriteMoviesList.filter(m => m.type === "series");
    const favAnime = favoriteMoviesList.filter(m => m.type === "anime");
    
    return { swiped, likes, matches: matchHistory.length, topGenres, favoriteDecade, recentLikes, favMovies, favSeries, favAnime, ratings };
  }, [appData, matchHistory]);

  const achievements = [
    { icon: "👶", title: "Новичок", desc: "Свайпнуть 10 фильмов", unlocked: stats.swiped >= 10 },
    { icon: "🍿", title: "Киноманьяк", desc: "Свайпнуть 100 фильмов", unlocked: stats.swiped >= 100 },
    { icon: "❤️", title: "Доброе сердце", desc: "Поставить 50 лайков", unlocked: stats.likes >= 50 },
    { icon: "🥂", title: "Идеальная пара", desc: "Получить 5 совпадений", unlocked: stats.matches >= 5 },
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
          <div className="profile-left">
            <div className="profile-card-main">
              <div className="profile-avatar-large">
                {profileData?.avatar || "😎"}
              </div>
              <h2 className="profile-display-name">
                <span className="profile-name-bold">{namePart}</span>
                <span className="profile-tag-dim">{tagPart}</span>
              </h2>
              <button 
                className={`btn-share-profile ${copiedLink ? 'copied' : ''}`}
                onClick={handleShareProfile}
              >
                {copiedLink ? "✅ Скопировано!" : "🔗 Поделиться профилем"}
              </button>
            </div>

            {/* Settings card */}
            <div className="profile-card-settings">
              <h3>⚙️ Настройки</h3>
              
              <div className="setting-group">
                <label>Аватар</label>
                <div className="avatar-picker">
                  {['😎','🤓','👽','👻','🤡','🤖','🐶','🐱'].map(emoji => (
                    <button 
                      key={emoji} 
                      className={`avatar-option ${profileData?.avatar === emoji ? 'selected' : ''}`}
                      onClick={() => set(ref(database, `users/${user.uid}/profile/avatar`), emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <label>Обучение</label>
                <div style={{display: "flex", alignItems: "center", gap: "10px", marginTop: "5px"}}>
                  <input 
                    type="checkbox" 
                    id="disable-onboarding"
                    checked={profileData?.disableOnboarding || false}
                    onChange={(e) => set(ref(database, `users/${user.uid}/profile/disableOnboarding`), e.target.checked)}
                    style={{width: "20px", height: "20px", cursor: "pointer"}}
                  />
                  <label htmlFor="disable-onboarding" style={{fontSize: "0.95rem", cursor: "pointer"}}>Выключить обучение</label>
                </div>
                <p className="setting-hint">Если включено, подсказки не показываются.</p>
              </div>

              <div className="setting-group">
                <label>Стоп-жанры</label>
                <p className="setting-hint">Фильмы этих жанров не будут предлагаться.</p>
                <div className="stop-genres-picker">
                  {["Ужасы", "Драма", "Комедия", "Боевик", "Триллер", "Фантастика", "Документальный"].map(genre => {
                    const isStopped = profileData?.stopGenres?.includes(genre);
                    return (
                      <button 
                        key={genre}
                        className={`genre-option ${isStopped ? 'stopped' : ''}`}
                        onClick={() => {
                          let current = profileData?.stopGenres || [];
                          if (isStopped) {
                            current = current.filter(g => g !== genre);
                          } else {
                            current = [...current, genre];
                          }
                          set(ref(database, `users/${user.uid}/profile/stopGenres`), current);
                        }}
                      >
                        {isStopped ? '🚫 ' : ''}{genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="setting-group">
                <label>Редактирование профиля</label>
                {!isEditingProfile ? (
                  <button className="btn-secondary btn-small" onClick={startEditingProfile}>✏️ Изменить имя и тег</button>
                ) : (
                  <form onSubmit={handleEditProfile} className="auth-form" style={{marginTop: "10px"}}>
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      placeholder="Новое имя" 
                      required 
                      className="form-input" 
                      style={{marginBottom: "8px"}}
                    />
                    <input 
                      type="text" 
                      value={editTag} 
                      onChange={e => setEditTag(e.target.value)} 
                      placeholder="Новый тег (4 цифры)" 
                      className="form-input" 
                      maxLength={4}
                      style={{marginBottom: "8px"}}
                    />
                    {editError && <div className="error-text">{editError}</div>}
                    {editSuccess && <div className="success-text">{editSuccess}</div>}
                    <div style={{display: "flex", gap: "8px", marginTop: "10px"}}>
                      <button type="submit" className="btn-primary btn-small">Сохранить</button>
                      <button type="button" className="btn-secondary btn-small" onClick={() => setIsEditingProfile(false)}>Отмена</button>
                    </div>
                  </form>
                )}
              </div>

              <div className="setting-group danger-zone">
                <label>Сброс прогресса</label>
                <p className="setting-hint">Удалит все ваши лайки и дизлайки.</p>
                <button className="btn-secondary btn-small" onClick={handleResetProgress}>🗑 Сбросить</button>
              </div>

              <div className="setting-group danger-zone" style={{marginTop: "15px"}}>
                <label>Выход из аккаунта</label>
                <button className="btn-secondary btn-small" onClick={handleLogout}>🚪 Выйти</button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="profile-right">
            <div className="profile-card-stats">
              <h3>📊 Статистика</h3>
              <div className="stats-grid-2col" style={{marginBottom: "20px"}}>
                <div className="stat-card">
                  <div className="stat-value">{stats.swiped}</div>
                  <div className="stat-label">Фильмов оценено</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.likes}</div>
                  <div className="stat-label">Лайков</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.matches}</div>
                  <div className="stat-label">Совпадений</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{fontSize: stats.favoriteDecade.length > 8 ? "1.1rem" : "1.8rem"}}>{stats.favoriteDecade}</div>
                  <div className="stat-label">Любимая эпоха</div>
                </div>
              </div>
              
              <div className="stats-detailed-box">
                <h4>Любимые жанры</h4>
                <div className="stats-tags">
                  {stats.topGenres.length > 0 ? stats.topGenres.map(g => (
                    <span key={g} className="stats-tag">{g}</span>
                  )) : <span className="stats-tag dim">Нет данных</span>}
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
                      <div key={m.id} className="favorite-item-card" title={m.titleRu || m.title}>
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
                      <div key={m.id} className="favorite-item-card" title={m.titleRu || m.title}>
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
                      <div key={m.id} className="favorite-item-card" title={m.titleRu || m.title}>
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

        </motion.div>
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
