import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { getPublicProfile, sendFriendRequest, removeFriend, inviteToMatchWatch, createMatchRoom, auth, database } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";
import "./MovieModal.css";

const moviesDict = movies.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

export default function PublicProfile({ tag, onBackToApp, onGoToMatchWatch }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [targetData, setTargetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reqStatus, setReqStatus] = useState("");
  const [inviteCategory, setInviteCategory] = useState("movie");
  
  // Is this user already our friend?
  const [isFriend, setIsFriend] = useState(false);

  const [currentUserAppData, setCurrentUserAppData] = useState({});
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showAllFavorites, setShowAllFavorites] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const appDataRef = ref(database, `users/${currentUser.uid}/appData`);
      const unsub = onValue(appDataRef, (snap) => {
        setCurrentUserAppData(snap.val() || {});
      });
      return () => unsub();
    }
  }, [currentUser]);

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

  useEffect(() => {
    if (currentUser && targetData) {
      const friendRef = ref(database, `users/${currentUser.uid}/friends/${targetData.uid}`);
      const unsub = onValue(friendRef, (snap) => {
        setIsFriend(snap.exists());
      });
      return () => unsub();
    }
  }, [currentUser, targetData]);

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
    if (!currentUser) return;
    const current = (currentUserAppData.decisions || {})[movie.id];
    const newDecisions = { ...(currentUserAppData.decisions || {}) };
    const newFavorites = { ...(currentUserAppData.favorites || {}) };
    if (current === "like") {
      delete newDecisions[movie.id];
      delete newFavorites[movie.id];
    } else {
      newDecisions[movie.id] = "like";
    }
    set(ref(database, `users/${currentUser.uid}/appData/decisions`), newDecisions);
    set(ref(database, `users/${currentUser.uid}/appData/favorites`), newFavorites);
  };

  const toggleFavorite = (movie) => {
    if (!currentUser) return;
    const newFavorites = { ...(currentUserAppData.favorites || {}) };
    const newDecisions = { ...(currentUserAppData.decisions || {}) };
    if (newFavorites[movie.id]) {
      delete newFavorites[movie.id];
    } else {
      newFavorites[movie.id] = true;
      if (newDecisions[movie.id] !== "like") {
        newDecisions[movie.id] = "like";
      }
    }
    set(ref(database, `users/${currentUser.uid}/appData/favorites`), newFavorites);
    set(ref(database, `users/${currentUser.uid}/appData/decisions`), newDecisions);
  };

  const handleSetRating = (movie, rating) => {
    if (!currentUser) return;
    const newRatings = { ...(currentUserAppData.ratings || {}) };
    if (rating === null || newRatings[movie.id] === rating) {
      delete newRatings[movie.id];
    } else {
      newRatings[movie.id] = rating;
    }
    set(ref(database, `users/${currentUser.uid}/appData/ratings`), newRatings);
  };

  const stats = useMemo(() => {
    if (!targetData || !targetData.appData) return { 
      swiped: 0, likes: 0, matches: 0, 
      topGenres: [], favoriteDecade: "—", recentLikes: [], 
      favMovies: [], favSeries: [], favAnime: [], ratings: {},
      likedMoviesCount: 0, likedSeriesCount: 0, likedAnimeCount: 0,
      favoriteDirector: "—", favoriteActor: "—", favoriteStudio: "—",
      waitingList: []
    };
    const decs = targetData.appData.decisions || {};
    const swiped = Object.keys(decs).length;
    
    const likedMoviesList = [];
    const waitingMoviesList = [];
    let likedMoviesCount = 0;
    let likedSeriesCount = 0;
    let likedAnimeCount = 0;

    const decadeCounts = {};
    const favIds = Object.keys(targetData.appData.favorites || {}).filter(id => targetData.appData.favorites[id]);
    const ratings = targetData.appData.ratings || {};

    const genreScores = {};
    const directorScores = {};
    const actorScores = {};
    const studioScores = {};

    Object.keys(decs).forEach(id => {
      if (decs[id] === "like") {
        const m = moviesDict[id];
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
    
    const favoriteMoviesList = favIds.map(id => moviesDict[id]).filter(Boolean);
    const favMovies = favoriteMoviesList.filter(m => (m.type || "movie") === "movie");
    const favSeries = favoriteMoviesList.filter(m => m.type === "series");
    const favAnime = favoriteMoviesList.filter(m => m.type === "anime");
    
    const matches = targetData.appData.history ? targetData.appData.history.length : 0;
    return { 
      swiped, likes, matches, topGenres, favoriteDecade, recentLikes, 
      favMovies, favSeries, favAnime, ratings,
      likedMoviesCount, likedSeriesCount, likedAnimeCount,
      favoriteDirector, favoriteActor, favoriteStudio,
      waitingList: waitingMoviesList
    };
  }, [targetData]);

  const handleAddFriend = async () => {
    if (!currentUser) return setReqStatus("Сначала войдите в аккаунт.");
    if (!currentUser.displayName || !currentUser.displayName.includes("#")) {
      return setReqStatus("Сначала обновите свой профиль (вкладка Аккаунт).");
    }
    try {
      setReqStatus("");
      await sendFriendRequest(currentUser.uid, currentUser.displayName, tag);
      setReqStatus("✅ Заявка отправлена!");
    } catch (err) {
      setReqStatus("❌ " + err.message);
    }
  };

  const handleRemoveFriend = async () => {
    if (window.confirm(`Вы уверены, что хотите удалить ${namePart} из друзей?`)) {
      try {
        await removeFriend(currentUser.uid, targetData.uid);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleInviteToMatchWatch = async () => {
    if (!currentUser) return;
    try {
      const categoryIds = movies
        .filter(m => inviteCategory === 'all' || (m.type || "movie") === inviteCategory)
        .map(m => m.id);
      const roomCode = await createMatchRoom(currentUser.displayName, categoryIds);
      await inviteToMatchWatch(targetData.uid, roomCode, currentUser.displayName);
      onGoToMatchWatch(roomCode);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="profile-dashboard">
        <h2 className="page-title">Загрузка...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-dashboard" style={{textAlign: "center", paddingTop: "50px"}}>
        <div style={{fontSize: "4rem", marginBottom: "10px"}}>🤷‍♂️</div>
        <h2>Ой!</h2>
        <p>{error}</p>
        <button className="btn-secondary" onClick={onBackToApp} style={{marginTop: "20px"}}>На главную</button>
      </div>
    );
  }

  const namePart = tag.split('#')[0];
  const tagPart = '#' + tag.split('#')[1];

  const rawStopGenres = targetData.profile?.stopGenres || [];
  const stopGenres = (Array.isArray(rawStopGenres)
    ? rawStopGenres
    : (rawStopGenres && typeof rawStopGenres === 'object' ? Object.values(rawStopGenres) : []))
    .filter(item => typeof item === 'string' && item.trim() !== "");

  return (
    <div className="profile-dashboard">
      <motion.div className="profile-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        
        {/* LEFT COLUMN */}
        <div className="profile-left">
          <div className="profile-card-main">
            <h2 className="profile-display-name">
              <span className="profile-name-bold">{namePart}</span>
              <span className="profile-tag-dim">{tagPart}</span>
            </h2>
            
            <div style={{marginTop: "20px", width: "100%", display: "flex", flexDirection: "column", gap: "10px"}}>
              {currentUser && currentUser.displayName === tag ? (
                <p style={{color: "rgba(255,255,255,0.5)", margin: 0}}>Это ваш профиль</p>
              ) : (
                <>
                  {!isFriend ? (
                    <button className="btn-primary" onClick={handleAddFriend}>➕ Добавить друга</button>
                  ) : (
                    <>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', marginTop: '10px'}}>
                        <p style={{fontSize: '0.85rem', color: '#aaa', margin: '0 0 5px 0'}}>Что будем смотреть?</p>
                        <div className="category-picker" style={{marginBottom: 0, justifyContent: 'space-between', gap: '4px'}}>
                          <button onClick={() => setInviteCategory('movie')} className={`category-btn ${inviteCategory === 'movie' ? 'active' : ''}`} style={{padding: '6px 8px', fontSize: '0.8rem', flex: 1}}>Фильмы</button>
                          <button onClick={() => setInviteCategory('series')} className={`category-btn ${inviteCategory === 'series' ? 'active' : ''}`} style={{padding: '6px 8px', fontSize: '0.8rem', flex: 1}}>Сериалы</button>
                          <button onClick={() => setInviteCategory('anime')} className={`category-btn ${inviteCategory === 'anime' ? 'active' : ''}`} style={{padding: '6px 8px', fontSize: '0.8rem', flex: 1}}>Аниме</button>
                          <button onClick={() => setInviteCategory('all')} className={`category-btn ${inviteCategory === 'all' ? 'active' : ''}`} style={{padding: '6px 8px', fontSize: '0.8rem', flex: 1}}>Всё</button>
                        </div>
                      </div>
                      <button className="btn-primary" style={{background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)"}} onClick={handleInviteToMatchWatch}>🍿 Позвать в MatchWatch</button>
                      <button className="btn-secondary" onClick={handleRemoveFriend}>✅ Ваш друг (Удалить)</button>
                    </>
                  )}
                  {reqStatus && <p style={{margin: 0, fontSize: "0.9rem"}}>{reqStatus}</p>}
                </>
              )}
            </div>
          </div>

          <div className="profile-card-settings">
            <div className="setting-group">
              <label>Стоп-жанры</label>
              {stopGenres.length > 0 ? (
                <div className="stop-genres-picker">
                  {stopGenres.map(genre => (
                    <button key={genre} className="genre-option stopped" style={{cursor: "default"}}>
                      🚫 {genre}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="setting-hint">У пользователя нет стоп-жанров.</p>
              )}
            </div>
            <button className="btn-secondary" onClick={onBackToApp} style={{width: "100%", marginTop: "15px"}}>Закрыть профиль</button>
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
               <p className="setting-hint" style={{textAlign: "center", padding: "20px 0"}}>Пользователь пока не добавил ничего в избранное.</p>
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
                    const text = days === 1 ? "Завтра!" : days === 2 ? "Послезавтра!" : days <= 30 ? `${days} dн.` : `${Math.floor(days / 30)} мес.`;
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
          isLiked={(currentUserAppData.decisions || {})[selectedMovie.id] === "like"}
          onToggleLike={toggleLike}
          isFavorite={!!(currentUserAppData.favorites || {})[selectedMovie.id]}
          onToggleFavorite={toggleFavorite}
          rating={(currentUserAppData.ratings || {})[selectedMovie.id]}
          onSetRating={handleSetRating}
        />
      )}
    </div>
  );
}
