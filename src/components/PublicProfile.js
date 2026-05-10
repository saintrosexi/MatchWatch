import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { getPublicProfile, sendFriendRequest, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { movies } from "../data";

export default function PublicProfile({ tag, onBackToApp }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [targetData, setTargetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reqStatus, setReqStatus] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await getPublicProfile(tag);
        if (!data) {
          setError("Профиль не найден");
        } else {
          setTargetData(data);
        }
      } catch (err) {
        setError("Ошибка при загрузке профиля");
      } finally {
        setLoading(false);
      }
    }
    if (tag) fetchProfile();
  }, [tag]);

  const stats = useMemo(() => {
    if (!targetData || !targetData.appData) return { swiped: 0, likes: 0, matches: 0, topGenres: [], favoriteDecade: "—", recentLikes: [] };
    const decs = targetData.appData.decisions || {};
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
    
    const matches = targetData.appData.history ? targetData.appData.history.length : 0;
    return { swiped, likes, matches, topGenres, favoriteDecade, recentLikes };
  }, [targetData]);

  const handleAddFriend = async () => {
    if (!currentUser) {
      setReqStatus("Сначала войдите в аккаунт, чтобы добавлять друзей.");
      return;
    }
    if (!currentUser.displayName || !currentUser.displayName.includes("#")) {
      setReqStatus("Сначала обновите свой профиль (вкладка Аккаунт), чтобы добавлять друзей.");
      return;
    }
    try {
      setReqStatus("");
      await sendFriendRequest(currentUser.uid, currentUser.displayName, tag);
      setReqStatus("✅ Заявка отправлена!");
    } catch (err) {
      setReqStatus("❌ " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="public-profile-container">
        <h2 className="page-title">Загрузка...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-profile-container">
        <div className="public-profile-card">
          <div style={{fontSize: "4rem", marginBottom: "10px"}}>🤷‍♂️</div>
          <h2>Ой!</h2>
          <p>{error}</p>
          <button className="btn-secondary" onClick={onBackToApp} style={{marginTop: "20px"}}>На главную</button>
        </div>
      </div>
    );
  }

  const namePart = tag.split('#')[0];
  const tagPart = '#' + tag.split('#')[1];

  return (
    <div className="public-profile-container">
      <motion.div className="public-profile-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        
        <div className="public-profile-header">
          <div className="profile-avatar-large">
            {targetData.profile.avatar || "😎"}
          </div>
          <h2 className="profile-display-name" style={{marginTop: "15px"}}>
            <span className="profile-name-bold">{namePart}</span>
            <span className="profile-tag-dim">{tagPart}</span>
          </h2>
        </div>

        <div className="public-profile-actions">
          {currentUser && currentUser.displayName === tag ? (
            <p style={{color: "rgba(255,255,255,0.5)"}}>Это ваш профиль!</p>
          ) : (
            <>
              <button className="btn-primary btn-large" onClick={handleAddFriend}>➕ Добавить в друзья</button>
              {reqStatus && <p style={{marginTop: "10px", fontSize: "0.9rem"}}>{reqStatus}</p>}
            </>
          )}
        </div>

        <div className="public-profile-stats">
          <h3>Статистика {namePart}</h3>
          <div className="stats-grid-2col" style={{marginBottom: "20px"}}>
            <div className="stat-card">
              <div className="stat-value">{stats.swiped}</div>
              <div className="stat-label">Оценено</div>
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

          {stats.recentLikes.length > 0 && (
            <div className="stats-detailed-box">
              <h4>Любимые фильмы</h4>
              <div className="recent-likes-row">
                {stats.recentLikes.map(m => (
                  <div key={m.id} className="recent-like-item" title={m.titleRu || m.title}>
                    <img src={m.poster} alt={m.title} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className="btn-secondary" onClick={onBackToApp} style={{marginTop: "30px", width: "100%"}}>Закрыть профиль</button>

      </motion.div>
    </div>
  );
}
