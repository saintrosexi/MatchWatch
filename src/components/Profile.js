import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { auth, database, registerWithTag, signInWithEmailAndPassword, signOut, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { movies } from "../data";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("stats"); // stats, friends, settings
  
  const [profileData, setProfileData] = useState(null);
  const [appData, setAppData] = useState(null);
  const [friends, setFriends] = useState({});
  const [friendRequests, setFriendRequests] = useState({});
  const [matchHistory, setMatchHistory] = useState([]);
  
  const [friendTagInput, setFriendTagInput] = useState("");
  const [friendError, setFriendError] = useState("");
  const [friendSuccess, setFriendSuccess] = useState("");

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load everything
        const userRef = ref(database, `users/${currentUser.uid}`);
        onValue(userRef, (snap) => {
          const data = snap.val() || {};
          setProfileData(data.profile || {});
          setAppData(data.appData || {});
          setFriends(data.friends || {});
          setFriendRequests(data.friendRequests || {});
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
        await registerWithTag(email, password, name);
      }
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes("Не удалось сгенерировать")) {
        setAuthError(err.message);
      } else if (err.code === "auth/email-already-in-use") {
        setAuthError("Эта почта уже зарегистрирована");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setAuthError("Неверная почта или пароль");
      } else if (err.code === "auth/weak-password") {
        setAuthError("Пароль должен быть не менее 6 символов");
      } else {
        setAuthError("Произошла ошибка. Проверьте настройки Firebase.");
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
    if (!appData) return { swiped: 0, likes: 0, matches: matchHistory.length, favGenre: "Нет" };
    const decs = appData.decisions || {};
    const swiped = Object.keys(decs).length;
    const likes = Object.values(decs).filter(d => d === "like").length;
    
    // Fav genre
    const genreCounts = {};
    Object.keys(decs).forEach(id => {
      if (decs[id] === "like") {
        const m = movies.find(x => x.id === parseInt(id));
        if (m && m.genres) {
          m.genres.split(", ").forEach(g => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          });
        }
      }
    });
    let favGenre = "Нет";
    let max = 0;
    Object.entries(genreCounts).forEach(([g, count]) => {
      if (count > max) { max = count; favGenre = g; }
    });
    
    return { swiped, likes, matches: matchHistory.length, favGenre };
  }, [appData, matchHistory]);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setFriendError("");
    setFriendSuccess("");
    if (!friendTagInput.includes("#")) {
      return setFriendError("Тег должен содержать # (например Саша#1111)");
    }
    try {
      await sendFriendRequest(user.uid, user.displayName, friendTagInput);
      setFriendSuccess("Заявка отправлена!");
      setFriendTagInput("");
    } catch (err) {
      setFriendError(err.message);
    }
  };

  const handleAcceptFriend = async (uid, tag) => {
    try {
      await acceptFriendRequest(user.uid, user.displayName, uid, tag);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectFriend = async (uid) => {
    try {
      await rejectFriendRequest(user.uid, uid);
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleResetProgress = async () => {
    if (window.confirm("Вы уверены? Это удалит все ваши лайки и свайпы (история совпадений останется).")) {
      await set(ref(database, `users/${user.uid}/appData/decisions`), null);
      alert("Прогресс сброшен!");
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
    return (
      <div className="profile-container profile-container--dashboard">
        <div className="profile-header-large">
          <div className="profile-avatar-large">
            {profileData?.avatar || "😎"}
          </div>
          <div className="profile-title-area">
            <h2>{user.displayName || "Без имени"}</h2>
            <button className="btn-copy-tag" onClick={() => {
              navigator.clipboard.writeText(user.displayName);
              alert("Тег скопирован!");
            }}>📋 Скопировать тег</button>
          </div>
          <button className="btn-logout-small" onClick={handleLogout}>🚪 Выйти</button>
        </div>

        <div className="profile-nav">
          <button className={activeTab === "stats" ? "active" : ""} onClick={() => setActiveTab("stats")}>📊 Статистика</button>
          <button className={activeTab === "friends" ? "active" : ""} onClick={() => setActiveTab("friends")}>
            👥 Друзья
            {Object.keys(friendRequests).length > 0 && <span className="badge-count">{Object.keys(friendRequests).length}</span>}
          </button>
          <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}>⚙️ Настройки</button>
        </div>

        <div className="profile-content">
          {activeTab === "stats" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stats-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{stats.swiped}</div>
                  <div className="stat-label">Фильмов оценено</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.likes}</div>
                  <div className="stat-label">Лайков поставлено</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.matches}</div>
                  <div className="stat-label">Совпадений</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{fontSize: "1.2rem", marginTop: "10px"}}>{stats.favGenre}</div>
                  <div className="stat-label">Любимый жанр</div>
                </div>
              </div>
              
              <div className="achievements-section">
                <h3>🏆 Достижения</h3>
                <div className="achievements-grid">
                  <div className={`achievement-card ${stats.swiped >= 10 ? "unlocked" : "locked"}`}>
                    <div className="ach-icon">👶</div>
                    <div className="ach-title">Новичок</div>
                    <div className="ach-desc">Свайпнуть 10 фильмов</div>
                  </div>
                  <div className={`achievement-card ${stats.swiped >= 100 ? "unlocked" : "locked"}`}>
                    <div className="ach-icon">🍿</div>
                    <div className="ach-title">Киноманьяк</div>
                    <div className="ach-desc">Свайпнуть 100 фильмов</div>
                  </div>
                  <div className={`achievement-card ${stats.likes >= 50 ? "unlocked" : "locked"}`}>
                    <div className="ach-icon">❤️</div>
                    <div className="ach-title">Доброе сердце</div>
                    <div className="ach-desc">Поставить 50 лайков</div>
                  </div>
                  <div className={`achievement-card ${stats.matches >= 5 ? "unlocked" : "locked"}`}>
                    <div className="ach-icon">🥂</div>
                    <div className="ach-title">Идеальная пара</div>
                    <div className="ach-desc">Получить 5 совпадений</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "friends" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="friends-section">
              <div className="add-friend-box">
                <h3>Добавить друга</h3>
                <form onSubmit={handleAddFriend} className="add-friend-form">
                  <input 
                    type="text" 
                    value={friendTagInput} 
                    onChange={e => setFriendTagInput(e.target.value)} 
                    placeholder="Например: Саша#1111" 
                    className="form-input form-input-friend"
                  />
                  <button type="submit" className="btn-primary btn-friend-submit">Добавить</button>
                </form>
                {friendError && <p className="error-text">{friendError}</p>}
                {friendSuccess && <p className="success-text">{friendSuccess}</p>}
              </div>

              {Object.keys(friendRequests).length > 0 && (
                <div className="friend-requests-list">
                  <h3>Входящие заявки</h3>
                  {Object.entries(friendRequests).map(([uid, tag]) => (
                    <div key={uid} className="friend-request-item">
                      <span>👤 {tag}</span>
                      <div className="request-actions">
                        <button className="btn-accept" onClick={() => handleAcceptFriend(uid, tag)}>Принять</button>
                        <button className="btn-reject" onClick={() => handleRejectFriend(uid)}>Отклонить</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="friends-list">
                <h3>Мои друзья ({Object.keys(friends).length})</h3>
                {Object.keys(friends).length === 0 ? (
                  <p className="empty-text">У вас пока нет друзей. Добавьте их по тегу!</p>
                ) : (
                  Object.entries(friends).map(([uid, tag]) => (
                    <div key={uid} className="friend-item">
                      <span>👤 {tag}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="settings-section">
              <h3>⚙️ Настройки аккаунта</h3>
              
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
                <label>Стоп-жанры</label>
                <p style={{fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginBottom: "10px"}}>Фильмы этих жанров не будут предлагаться при поиске и свайпах.</p>
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

              <div className="setting-group danger-zone">
                <h4>Сброс прогресса</h4>
                <p style={{marginBottom: "15px", color: "rgba(255,255,255,0.6)"}}>Удалит все ваши лайки и дизлайки. Вы начнете выбирать фильмы с чистого листа.</p>
                <button className="btn-secondary" onClick={handleResetProgress}>🗑 Сбросить оценки</button>
              </div>
            </motion.div>
          )}
        </div>
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
              <small style={{color: 'rgba(255,255,255,0.5)', marginTop: '4px'}}>К имени будет добавлен уникальный код (Иван#1234)</small>
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
