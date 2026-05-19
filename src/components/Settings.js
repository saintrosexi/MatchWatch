import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { auth, database, signOut, updateUserTag } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";

export default function Settings({ theme, setTheme, language, setLanguage }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);

  // Profile editing states
  const [editName, setEditName] = useState("");
  const [editTag, setEditTag] = useState("");
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Avatar uploading states
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Bio state
  const [bio, setBio] = useState("");
  const [bioSuccess, setBioSuccess] = useState("");

  useEffect(() => {
    if (!auth || !database) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const profileRef = ref(database, `users/${currentUser.uid}/profile`);
        onValue(profileRef, (snap) => {
          const data = snap.val() || {};
          setProfileData(data);
          setBio(data.bio || "");
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Ошибка выхода", err);
    }
  };

  const handleResetProgress = async () => {
    if (!user) return;
    if (window.confirm("Вы уверены? Это удалит все ваши лайки и свайпы (история совпадений останется).")) {
      await set(ref(database, `users/${user.uid}/appData/decisions`), null);
      alert("Прогресс сброшен!");
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Файл слишком большой. Выберите изображение менее 5 МБ.");
      return;
    }

    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext("2d");

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 150, 150);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);

        if (user) {
          set(ref(database, `users/${user.uid}/profile/avatar`), compressedBase64)
            .then(() => {
              setAvatarUploading(false);
            })
            .catch((err) => {
              console.error("Error saving avatar: ", err);
              setAvatarUploading(false);
              alert("Ошибка сохранения аватарки.");
            });
        }
      };
      img.onerror = () => {
        setAvatarUploading(false);
        alert("Не удалось загрузить изображение.");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

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

  const handleSaveBio = async (e) => {
    e.preventDefault();
    setBioSuccess("");
    try {
      await set(ref(database, `users/${user.uid}/profile/bio`), bio);
      setBioSuccess("Информация «О себе» успешно обновлена!");
      setTimeout(() => setBioSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      alert("Ошибка при сохранении.");
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <h2 className="page-title">Загрузка параметров...</h2>
      </div>
    );
  }

  return (
    <div className="profile-dashboard">
      <h2 className="page-title" style={{ marginBottom: "30px", textAlign: "left" }}>⚙️ Параметры</h2>

      {user ? (
        <motion.div className="profile-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          
          {/* LEFT COLUMN */}
          <div className="profile-left" style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            
            {/* Card 1: Appearance & Language */}
            <div className="profile-card-settings">
              <h3>Внешний вид и язык</h3>

              <div className="setting-group" style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Тема оформления</label>
                <div className="toggle-container" style={{ display: "flex", gap: "10px" }}>
                  <button
                    className={`btn-secondary ${theme === "dark" ? "active-theme" : ""}`}
                    onClick={() => setTheme("dark")}
                    style={{
                      flex: 1,
                      border: theme === "dark" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                      opacity: theme === "dark" ? 1 : 0.7
                    }}
                  >
                    🌙 Темная
                  </button>
                  <button
                    className={`btn-secondary ${theme === "light" ? "active-theme" : ""}`}
                    onClick={() => setTheme("light")}
                    style={{
                      flex: 1,
                      border: theme === "light" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                      opacity: theme === "light" ? 1 : 0.7
                    }}
                  >
                    ☀️ Светлая
                  </button>
                </div>
              </div>

              <div className="setting-group">
                <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Язык</label>
                <div className="toggle-container" style={{ display: "flex", gap: "10px" }}>
                  <button
                    className={`btn-secondary ${language === "ru" ? "active-lang" : ""}`}
                    onClick={() => setLanguage("ru")}
                    style={{
                      flex: 1,
                      border: language === "ru" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                      opacity: language === "ru" ? 1 : 0.7
                    }}
                  >
                    🇷🇺 Русский
                  </button>
                  <button
                    className={`btn-secondary ${language === "en" ? "active-lang" : ""}`}
                    onClick={() => setLanguage("en")}
                    style={{
                      flex: 1,
                      border: language === "en" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                      opacity: language === "en" ? 1 : 0.7
                    }}
                  >
                    🇬🇧 Английский
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Avatar selector */}
            <div className="profile-card-settings">
              <h3>👤 Аватар</h3>
              
              <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "15px" }}>
                <div className="profile-avatar-large" style={{ overflow: "hidden", margin: 0, width: "60px", height: "60px", minWidth: "60px", fontSize: "2rem" }}>
                  {(profileData?.avatar && (profileData.avatar.startsWith("data:image/") || profileData.avatar.startsWith("http"))) ? (
                    <img src={profileData.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    profileData?.avatar || "😎"
                  )}
                </div>
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
                  Выберите эмодзи ниже или загрузите собственную фотографию
                </div>
              </div>

              <div className="avatar-picker" style={{ marginBottom: "12px" }}>
                {['😎','🤓','👽','👻','🤡','🤖','🐶','🐱'].map(emoji => (
                  <button 
                    key={emoji} 
                    className={`avatar-option ${profileData?.avatar === emoji ? 'selected' : ''}`}
                    onClick={() => set(ref(database, `users/${user.uid}/profile/avatar`), emoji)}
                    style={{ padding: "8px", fontSize: "1.3rem" }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                <label htmlFor="avatar-upload" className="btn-secondary btn-small" style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: "pointer",
                  margin: 0,
                  width: "100%",
                  textAlign: "center",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px dashed rgba(255, 255, 255, 0.2)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "0.85rem",
                  transition: "all 0.2s"
                }}>
                  📷 Загрузить своё фото
                </label>
                <input 
                  type="file" 
                  id="avatar-upload" 
                  accept="image/*" 
                  onChange={handleAvatarUpload} 
                  style={{ display: "none" }}
                />
                {avatarUploading && <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Обработка и сжатие...</span>}
              </div>
            </div>

            {/* Card 3: Danger Zone */}
            <div className="profile-card-settings danger-zone" style={{ border: "1px solid rgba(255, 82, 82, 0.2)" }}>
              <h3 style={{ color: "#ff5252" }}>🚫 Опасная зона</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <p className="setting-hint" style={{ marginBottom: "8px" }}>Удалит всю историю ваших оценок, лайков и дизлайков.</p>
                  <button className="btn-secondary btn-small" onClick={handleResetProgress} style={{ width: "100%", borderColor: "rgba(255, 82, 82, 0.3)", color: "#ff5252" }}>🗑 Сбросить прогресс</button>
                </div>
                
                <div style={{ marginTop: "5px" }}>
                  <button className="btn-secondary btn-small" onClick={handleLogout} style={{ width: "100%" }}>🚪 Выйти из аккаунта</button>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="profile-right" style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            
            {/* Card 4: Username & Tag Edit */}
            <div className="profile-card-settings">
              <h3>✏️ Имя пользователя и тег</h3>
              {!isEditingProfile ? (
                <button className="btn-secondary btn-small" onClick={startEditingProfile} style={{ width: "100%" }}>Изменить имя и тег</button>
              ) : (
                <form onSubmit={handleEditProfile} className="auth-form" style={{ marginTop: "10px" }}>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    placeholder="Новое имя" 
                    required 
                    className="form-input" 
                    style={{ marginBottom: "8px" }}
                  />
                  <input 
                    type="text" 
                    value={editTag} 
                    onChange={e => setEditTag(e.target.value)} 
                    placeholder="Новый тег (4 цифры)" 
                    className="form-input" 
                    maxLength={4}
                    style={{ marginBottom: "8px" }}
                  />
                  {editError && <div className="error-text" style={{ color: "#ff5252", fontSize: "0.85rem", marginTop: "4px" }}>{editError}</div>}
                  {editSuccess && <div className="success-text" style={{ color: "#4caf50", fontSize: "0.85rem", marginTop: "4px" }}>{editSuccess}</div>}
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                    <button type="submit" className="btn-primary btn-small" style={{ flex: 1 }}>Сохранить</button>
                    <button type="button" className="btn-secondary btn-small" style={{ flex: 1 }} onClick={() => setIsEditingProfile(false)}>Отмена</button>
                  </div>
                </form>
              )}
            </div>

            {/* Card 5: About Me */}
            <div className="profile-card-settings">
              <h3>📝 О себе</h3>
              <p className="setting-hint" style={{ marginBottom: "12px" }}>Напишите пару слов о своих вкусах в кино, чтобы друзья знали, что вы любите.</p>
              <form onSubmit={handleSaveBio} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <textarea
                  className="form-input"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Люблю научную фантастику, ненавижу спойлеры..."
                  maxLength={180}
                  style={{
                    width: "100%",
                    minHeight: "100px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#fff",
                    fontSize: "0.9rem",
                    resize: "none"
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                    {bio.length} / 180 символов
                  </span>
                  <button type="submit" className="btn-primary btn-small" style={{ padding: "6px 16px" }}>
                    Сохранить
                  </button>
                </div>
                {bioSuccess && <div className="success-text" style={{ color: "#4caf50", fontSize: "0.85rem", marginTop: "4px", textAlign: "right" }}>{bioSuccess}</div>}
              </form>
            </div>

            {/* Card 6: MatchWatch Preferences */}
            <div className="profile-card-settings">
              <h3>🍿 Настройки MatchWatch</h3>
              
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Обучение</label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                  <input 
                    type="checkbox" 
                    id="disable-onboarding"
                    checked={profileData?.disableOnboarding || false}
                    onChange={(e) => set(ref(database, `users/${user.uid}/profile/disableOnboarding`), e.target.checked)}
                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                  />
                  <label htmlFor="disable-onboarding" style={{ fontSize: "0.95rem", cursor: "pointer" }}>Выключить обучение</label>
                </div>
                <p className="setting-hint">Если включено, подсказки при свайпах не показываются.</p>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Стоп-жанры</label>
                <p className="setting-hint">Фильмы этих жанров не будут предлагаться в поиске и свайпах.</p>
                <div className="stop-genres-picker" style={{ marginTop: "12px" }}>
                  {["Ужасы", "Драма", "Комедия", "Боевик", "Триллер", "Фантастика", "Документальный"].map(genre => {
                    const rawStopGenres = profileData?.stopGenres || [];
                    const stopGenresList = (Array.isArray(rawStopGenres)
                      ? rawStopGenres
                      : (rawStopGenres && typeof rawStopGenres === 'object' ? Object.values(rawStopGenres) : []))
                      .filter(item => typeof item === 'string' && item.trim() !== "");
                    const isStopped = stopGenresList.includes(genre);
                    return (
                      <button 
                        key={genre}
                        className={`genre-option ${isStopped ? 'stopped' : ''}`}
                        onClick={() => {
                          let current = stopGenresList;
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
            </div>

          </div>

        </motion.div>
      ) : (
        <motion.div className="profile-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* LEFT COLUMN */}
          <div className="profile-left">
            <div className="profile-card-settings">
              <h3>Внешний вид и язык</h3>

              <div className="setting-group" style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Тема оформления</label>
                <div className="toggle-container" style={{ display: "flex", gap: "10px" }}>
                  <button
                    className={`btn-secondary ${theme === "dark" ? "active-theme" : ""}`}
                    onClick={() => setTheme("dark")}
                    style={{
                      flex: 1,
                      border: theme === "dark" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                      opacity: theme === "dark" ? 1 : 0.7
                    }}
                  >
                    🌙 Темная
                  </button>
                  <button
                    className={`btn-secondary ${theme === "light" ? "active-theme" : ""}`}
                    onClick={() => setTheme("light")}
                    style={{
                      flex: 1,
                      border: theme === "light" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                      opacity: theme === "light" ? 1 : 0.7
                    }}
                  >
                    ☀️ Светлая
                  </button>
                </div>
              </div>

              <div className="setting-group">
                <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Язык</label>
                <div className="toggle-container" style={{ display: "flex", gap: "10px" }}>
                  <button
                    className={`btn-secondary ${language === "ru" ? "active-lang" : ""}`}
                    onClick={() => setLanguage("ru")}
                    style={{
                      flex: 1,
                      border: language === "ru" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                      opacity: language === "ru" ? 1 : 0.7
                    }}
                  >
                    🇷🇺 Русский
                  </button>
                  <button
                    className={`btn-secondary ${language === "en" ? "active-lang" : ""}`}
                    onClick={() => setLanguage("en")}
                    style={{
                      flex: 1,
                      border: language === "en" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                      opacity: language === "en" ? 1 : 0.7
                    }}
                  >
                    🇬🇧 Английский
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="profile-right">
            <div className="profile-card-settings" style={{ textAlign: "center", padding: "40px 30px" }}>
              <span style={{ fontSize: "3rem", display: "block", marginBottom: "15px" }}>👤</span>
              <h3 style={{ marginBottom: "12px", fontSize: "1.3rem" }}>Настройки профиля недоступны</h3>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem", lineHeight: "1.5", marginBottom: "0", maxWidth: "500px", margin: "0 auto" }}>
                Войдите или зарегистрируйтесь во вкладке **«Аккаунт»**, чтобы редактировать свой аватар, имя, тег, описание «О себе» и синхронизировать стоп-жанры.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

