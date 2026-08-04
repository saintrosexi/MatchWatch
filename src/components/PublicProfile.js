import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { getPublicProfile, sendFriendRequest, removeFriend, inviteToMatchWatch, createMatchRoom, auth, database } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { movies } from "../data";
import { calculateUserCompatibility, computeUserTasteVector } from "../recommendations";
import DetailedMovieModal from "./DetailedMovieModal";
import { SensationRadarComponent } from "./Profile";
import { ChamaBanner } from "../chamaAssets";
import "../styles/MovieModal.css";

const moviesDict = movies.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

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

export default function PublicProfile({ tag, onBackToApp, onGoToMatchWatch }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [targetData, setTargetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reqStatus, setReqStatus] = useState("");
  const [inviteCategory, setInviteCategory] = useState("movie");
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Friend Status
  const [isFriend, setIsFriend] = useState(false);

  const [currentUserAppData, setCurrentUserAppData] = useState({});
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showAllFavorites, setShowAllFavorites] = useState(false);

  useEffect(() => {
    if (currentUser && database) {
      const appDataRef = ref(database, `users/${currentUser.uid}/appData`);
      const unsub = onValue(appDataRef, (snap) => {
        setCurrentUserAppData(snap.val() || {});
      });
      return () => unsub();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!auth) return;
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
    if (currentUser && targetData && database) {
      const friendRef = ref(database, `users/${currentUser.uid}/friends/${targetData.uid}`);
      const unsub = onValue(friendRef, (snap) => {
        setIsFriend(snap.exists());
      });
      return () => unsub();
    }
  }, [currentUser, targetData]);

  // Taste Compatibility % score calculation
  const compatibilityScore = useMemo(() => {
    if (!targetData) return 85;
    const myTag = currentUser?.displayName || currentUser?.email || "Я";
    const myDecisions = currentUserAppData.decisions || {};
    const targetDecisions = targetData.appData?.decisions || {};
    return calculateUserCompatibility(myDecisions, targetDecisions, myTag, tag);
  }, [currentUser, currentUserAppData, targetData, tag]);

  // 5D Taste Vectors comparison
  const tasteVectors = useMemo(() => {
    const myVec = computeUserTasteVector(currentUserAppData.decisions || {});
    const targetVec = computeUserTasteVector(targetData?.appData?.decisions || {});
    return { myVec, targetVec };
  }, [currentUserAppData, targetData]);

  // Mutual Liked Movies calculation
  const mutualLikedMovies = useMemo(() => {
    if (!currentUserAppData?.decisions || !targetData?.appData?.decisions) return [];
    const myDecs = currentUserAppData.decisions;
    const targetDecs = targetData.appData.decisions;

    const mutualIds = Object.keys(targetDecs).filter(
      id => targetDecs[id] === "like" && myDecs[id] === "like"
    );

    return mutualIds.map(id => moviesDict[id]).filter(Boolean);
  }, [currentUserAppData, targetData]);

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
      waitingList: [], totalMinutes: 0, formattedWatchTime: "0 ч."
    };
    const decs = targetData.appData.decisions || {};
    const swiped = Object.keys(decs).length;
    
    const likedMoviesList = [];
    const waitingMoviesList = [];
    let likedMoviesCount = 0;
    let likedSeriesCount = 0;
    let likedAnimeCount = 0;
    let totalMinutes = 0;

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

            const isFav = favIds.includes(id);
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
      swiped, likes, matches, topGenres, favoriteDecade, recentLikes, 
      favMovies, favSeries, favAnime, ratings,
      likedMoviesCount, likedSeriesCount, likedAnimeCount,
      favoriteDirector, favoriteActor, favoriteStudio, likedMoviesList,
      waitingList: waitingMoviesList, totalMinutes, formattedWatchTime
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

  const handleSharePublicProfile = () => {
    const link = `${window.location.origin}/?add=${encodeURIComponent(tag)}`;
    const text = `Посмотри профиль ${tag} в MatchWatch 🍿: ${link}`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
      <div className="profile-dashboard" style={{ textAlign: "center", paddingTop: "50px" }}>
        <ChamaBanner
          type="DISCONNECTED_PLUG"
          title="Ошибка подключения к профилю"
          text={error}
          size="large"
          className="max-w-md mx-auto mb-4"
        />
        <button className="btn-secondary" onClick={onBackToApp} style={{ marginTop: "20px" }}>На главную</button>
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

  const vibeLabels = [
    { key: "energy", label: "🔥 Энергия", color: "#ff8a50" },
    { key: "darkness", label: "🌙 Мрачность", color: "#a855f7" },
    { key: "intellect", label: "🧠 Интеллект", color: "#3b82f6" },
    { key: "emotion", label: "💔 Эмоции", color: "#ec4899" },
    { key: "dynamism", label: "🏎️ Динамика", color: "#eab308" },
  ];

  return (
    <div className="profile-dashboard">
      <motion.div className="profile-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        
        {/* LEFT COLUMN: HERO & ACTIONS */}
        <div className="profile-left" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Glass User Hero Card */}
          <div className="profile-card-main profile-hero-glass">
            <div className="profile-avatar-large" style={{ overflow: "hidden" }}>
              {(targetData.profile?.avatar && (targetData.profile.avatar.startsWith("data:image/") || targetData.profile.avatar.startsWith("http"))) ? (
                <img src={targetData.profile.avatar} alt="Avatar" />
              ) : (
                targetData.profile?.avatar || "😎"
              )}
            </div>
            
            <h2 className="profile-display-name">
              <span className="profile-name-bold">{namePart}</span>
              <span className="profile-tag-dim">{tagPart}</span>
            </h2>

            {/* Compatibility Badge */}
            <div className="compat-badge-hero" style={{ marginTop: "10px" }}>
              <span className="compat-badge" style={{ fontSize: "0.95rem", padding: "6px 14px" }}>
                ✨ {compatibilityScore}% Совместимость вкусов
              </span>
            </div>

            {/* Bio Block */}
            {targetData.profile?.bio && (
              <div className="profile-bio-container" style={{ width: "100%", marginTop: "15px" }}>
                <p className="profile-bio" style={{
                  color: "rgba(255, 255, 255, 0.85)",
                  fontSize: "0.95rem",
                  lineHeight: "1.4",
                  background: "rgba(255, 255, 255, 0.05)",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  borderLeft: "3px solid var(--accent-orange)",
                  textAlign: "left",
                  margin: 0,
                  wordBreak: "break-word"
                }}>
                  {targetData.profile.bio}
                </p>
              </div>
            )}
            
            {/* Friend & MatchWatch Action Dock */}
            <div style={{ marginTop: "20px", width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
              {currentUser && currentUser.displayName === tag ? (
                <p style={{ color: "rgba(255,255,255,0.5)", margin: 0, textAlign: "center" }}>Это ваш профиль</p>
              ) : (
                <>
                  {!isFriend ? (
                    <button className="btn-glass-primary" style={{ width: "100%", padding: "12px" }} onClick={handleAddFriend}>
                      ➕ Добавить в друзья
                    </button>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '6px', marginTop: '6px' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0, textAlign: "center" }}>Категория просмотра:</p>
                        <div className="category-picker-mini" style={{ marginBottom: 0, width: '100%', justifyContent: 'space-between' }}>
                          <button onClick={() => setInviteCategory('movie')} className={`tab-btn ${inviteCategory === 'movie' ? 'active' : ''}`}>Фильмы</button>
                          <button onClick={() => setInviteCategory('series')} className={`tab-btn ${inviteCategory === 'series' ? 'active' : ''}`}>Сериалы</button>
                          <button onClick={() => setInviteCategory('anime')} className={`tab-btn ${inviteCategory === 'anime' ? 'active' : ''}`}>Аниме</button>
                          <button onClick={() => setInviteCategory('all')} className={`tab-btn ${inviteCategory === 'all' ? 'active' : ''}`}>Всё</button>
                        </div>
                      </div>
                      <button className="btn-glass-primary" style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #ff8a50 0%, #ff5e62 100%)" }} onClick={handleInviteToMatchWatch}>
                        🍿 Позвать в MatchWatch
                      </button>
                      <button className="btn-glass-secondary" style={{ width: "100%", padding: "10px" }} onClick={handleRemoveFriend}>
                        ✅ Ваш друг (Удалить)
                      </button>
                    </>
                  )}
                  {reqStatus && <p style={{ margin: 0, fontSize: "0.9rem", textAlign: "center" }}>{reqStatus}</p>}
                </>
              )}
              <button className={`btn-share-profile ${copiedLink ? 'copied' : ''}`} onClick={handleSharePublicProfile} style={{ marginTop: "4px" }}>
                {copiedLink ? "✅ Скопировано!" : "🔗 Поделиться"}
              </button>
            </div>

            {/* 5D Sensation Radar Vector Component */}
            <SensationRadarComponent likedMovies={stats.likedMoviesList} favorites={targetData?.appData?.favorites || {}} />
          </div>

          <div className="profile-card-stats profile-card-settings">
            <div className="setting-group">
              <label>Стоп-жанры</label>
              {stopGenres.length > 0 ? (
                <div className="stop-genres-picker">
                  {stopGenres.map(genre => (
                    <button key={genre} className="genre-option stopped" style={{ cursor: "default" }}>
                      🚫 {genre}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="setting-hint">У пользователя нет стоп-жанров.</p>
              )}
            </div>
            <button className="btn-glass-secondary" onClick={onBackToApp} style={{ width: "100%", marginTop: "15px" }}>
              Закрыть профиль
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: MUTUAL MOVIES, 5D VIBE COMPARISON, STATS & FAVORITES */}
        <div className="profile-right" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* 1. MUTUAL LIKED MOVIES GRID */}
          <div className="profile-card-stats profile-card-favorites">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 className="section-title" style={{ margin: 0 }}>🍿 Совместные лайки</h3>
              <span className="glass-count-badge" style={{ background: "rgba(255, 138, 80, 0.2)", color: "#ff8a50", padding: "4px 10px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: "bold" }}>
                {mutualLikedMovies.length}
              </span>
            </div>

            {mutualLikedMovies.length > 0 ? (
              <div className="favorites-grid-responsive">
                {mutualLikedMovies.map(movie => (
                  <div 
                    key={movie.id} 
                    className="favorite-card-glass" 
                    title={movie.titleRu || movie.title}
                    onClick={() => setSelectedMovie(movie)}
                  >
                    <img src={movie.poster} alt={movie.title} />
                    <div className="favorite-card-info">
                      <div className="fav-title">{movie.titleRu || movie.title}</div>
                      <div className="fav-rating" style={{ color: "#ff8a50" }}>🍿 Совпало</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ChamaBanner
                type="EMPTY_POPCORN"
                title="Нет совпадений"
                text="У вас пока нет совпавших лайков с этим пользователем. Позовите его в совместный MatchWatch!"
                size="medium"
              />
            )}
          </div>

          {/* 2. 5D VIBE COMPARISON BREAKDOWN */}
          <div className="profile-card-stats profile-section">
            <h3 className="section-title" style={{ marginBottom: "16px" }}>📊 Сравнение кино-вкусов (5D Vibe)</h3>
            <div className="radar-bars-grid">
              {vibeLabels.map(({ key, label, color }) => {
                const myVal = tasteVectors.myVec[key] || 5;
                const targetVal = tasteVectors.targetVec[key] || 5;
                return (
                  <div key={key} className="radar-bar-row" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div className="radar-bar-header" style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span>{label}</span>
                      <span style={{ color: "var(--text-sub)" }}>Вы ({myVal}) vs {namePart} ({targetVal})</span>
                    </div>
                    <div className="radar-bar-track" style={{ height: "10px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "10px", overflow: "hidden", position: "relative" }}>
                      {/* My Bar */}
                      <div 
                        style={{ 
                          position: "absolute", 
                          top: 0, left: 0, bottom: 0, 
                          width: `${(myVal / 10) * 100}%`, 
                          background: color, 
                          borderRadius: "10px",
                          opacity: 0.85
                        }} 
                      />
                      {/* Target Bar Marker */}
                      <div 
                        style={{ 
                          position: "absolute", 
                          top: 0, bottom: 0, 
                          left: `calc(${(targetVal / 10) * 100}% - 2px)`, 
                          width: "4px", 
                          background: "#ffffff", 
                          boxShadow: "0 0 6px rgba(255,255,255,0.8)",
                          zIndex: 2
                        }} 
                        title={`${namePart}: ${targetVal}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. STATS GRID */}
          <div className="profile-card-stats">
            <h3 className="section-title">📊 Статистика профиля</h3>
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
              <div className="stat-card" style={{ background: "rgba(255, 138, 80, 0.1)", border: "1px solid rgba(255, 138, 80, 0.3)" }}>
                <div className="stat-value" style={{ color: "#ff8a50" }}>⏳ {stats.waitingList?.length || 0}</div>
                <div className="stat-label">В списке ожидания</div>
              </div>
              <div className="stat-card" style={{ background: "rgba(255, 215, 0, 0.1)", border: "1px solid rgba(255, 215, 0, 0.3)" }}>
                <div className="stat-value" style={{ color: "#ffd700" }}>⭐ {stats.favMovies.length + stats.favSeries.length + stats.favAnime.length}</div>
                <div className="stat-label">В избранном</div>
              </div>
            </div>
            
            <div className="stats-detailed-box" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "var(--text-sub)" }}>❤️ Любимые жанры</h4>
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
                  <div style={{ fontWeight: "bold", fontSize: "0.95rem", color: stats.favoriteActor !== "—" ? "#ff8a50" : "#fff" }} title={stats.favoriteActor}>
                    {stats.favoriteActor}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. FAVORITES SECTION */}
          <div className="profile-card-stats profile-card-favorites">
            <h3 className="section-title">⭐️ Избранное</h3>
            <div className="favorites-grid-responsive">
              {[...stats.favMovies, ...stats.favSeries, ...stats.favAnime].map(m => (
                <div key={m.id} className="favorite-card-glass" onClick={() => setSelectedMovie(m)}>
                  <img src={m.poster} alt={m.title} />
                  <div className="favorite-card-info">
                    <div className="fav-title">{m.titleRu || m.title}</div>
                    {stats.ratings[m.id] && <div className="fav-rating">★ {stats.ratings[m.id]}</div>}
                  </div>
                </div>
              ))}
              {stats.favMovies.length === 0 && stats.favSeries.length === 0 && stats.favAnime.length === 0 && (
                <p className="setting-hint" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px 0" }}>
                  Пользователь пока не добавил ничего в избранное.
                </p>
              )}
            </div>
          </div>

        </div>

      </motion.div>

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
