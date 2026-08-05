import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { movies } from "../data";
import { actorsData } from "../actorsData";
import { fetchRealActorProfile, fetchActorMovieStills } from "../actorResolver";

// Robust string normalization for matching actor names
const normalizeName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name.toLowerCase().replace(/[^а-яёa-z0-9]/g, "");
};

export default function ActorProfilePage({ actorName, onBack, onMovieSelect, userAppData = {} }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, movie, series, anime

  const [imageError, setImageError] = useState(false);
  const [livePhoto, setLivePhoto] = useState(null);
  const [actorStills, setActorStills] = useState([]);
  const [activeStillIndex, setActiveStillIndex] = useState(null);

  // Scroll to top of the page on mount or actor change & fetch live real actor photo & stills
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setImageError(false);
    setLivePhoto(null);
    setActorStills([]);
    setActiveStillIndex(null);

    if (actorName) {
      fetchRealActorProfile(actorName).then((profile) => {
        if (profile && profile.photo) {
          setLivePhoto(profile.photo);
        }
      });
    }
  }, [actorName]);

  const actor = useMemo(() => {
    if (!actorName) return null;
    
    const normalizedTarget = normalizeName(actorName);
    const matchKey = Object.keys(actorsData).find(
      (key) => normalizeName(key) === normalizedTarget
    );
    
    const baseActor = matchKey ? actorsData[matchKey] : {
      name: actorName,
      nameEn: "Movie Star",
      photo: null,
      facts: [
        "Харизматичный и талантливый артист, полюбившийся публике выразительной игрой и глубиной образов.",
        "Признанный мастер перевоплощений, снискавший уважение коллег по цеху и признание критиков.",
        "Внес неоценимый творческий вклад в развитие современного кинематографа."
      ]
    };

    return {
      ...baseActor,
      photo: baseActor.photo || livePhoto
    };
  }, [actorName, livePhoto]);

  // Dynamically filter all movies starring this actor in real-time
  const actorMovies = useMemo(() => {
    if (!actorName) return [];
    const normalizedTarget = normalizeName(actorName);
    return movies.filter((m) => {
      if (!m.actors || typeof m.actors !== "string") return false;
      const list = m.actors.split(",").map((s) => normalizeName(s.trim()));
      return list.includes(normalizedTarget);
    });
  // Fetch actor movie stills
  useEffect(() => {
    if (actorName && actorMovies.length > 0) {
      fetchActorMovieStills(actorName, actorMovies).then(stills => {
        if (stills && stills.length > 0) {
          setActorStills(stills);
        }
      });
    }
  }, [actorName, actorMovies]);
  const userStats = useMemo(() => {
    const decs = userAppData.decisions || {};
    const favs = userAppData.favorites || {};
    const ratings = userAppData.ratings || {};

    let swipedCount = 0;
    let likedCount = 0;
    let favoriteCount = 0;
    let ratingSum = 0;
    let ratedCount = 0;

    actorMovies.forEach((m) => {
      const swiped = decs[m.id] !== undefined;
      const liked = decs[m.id] === "like";
      const isFav = !!favs[m.id];
      const rating = ratings[m.id];

      if (swiped) swipedCount++;
      if (liked) likedCount++;
      if (isFav) favoriteCount++;
      if (rating !== undefined) {
        ratingSum += rating;
        ratedCount++;
      }
    });

    const averageRating = ratedCount > 0 ? (ratingSum / ratedCount).toFixed(1) : null;

    return {
      swipedCount,
      likedCount,
      favoriteCount,
      averageRating,
      completionRate: actorMovies.length > 0 ? Math.round((swipedCount / actorMovies.length) * 100) : 0
    };
  }, [actorMovies, userAppData]);

  // Filter and search movies
  const filteredMovies = useMemo(() => {
    return actorMovies.filter((m) => {
      const title = (m.titleRu || m.title || "").toLowerCase();
      const matchesSearch = title.includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || m.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [actorMovies, searchQuery, filterType]);

  if (!actor || !actorName) {
    return (
      <div className="actor-profile-page-container">
        <h2 className="page-title">Загрузка профиля актера...</h2>
      </div>
    );
  }

  return (
    <div className="actor-profile-page-wrapper">
      {/* Ambient background glow matching the actor's portrait */}
      <div className="actor-ambient-glow">
        {actor.photo && !imageError && <img src={actor.photo} alt="" aria-hidden="true" />}
        <div className="actor-ambient-overlay" />
      </div>

      <motion.div
        className="actor-profile-page-content"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {/* Navigation / Header Row */}
        <div className="actor-page-nav-row">
          <button className="btn btn-secondary btn-actor-back" onClick={onBack}>
            <span>← Назад</span>
          </button>
          <span className="actor-page-subtitle">Профиль актера</span>
        </div>

        {/* Hero Section */}
        <div className="actor-hero-container">
          <div className="actor-hero-avatar-frame">
            {actor.photo && !imageError && !actor.photo.includes("unsplash") ? (
              <img 
                src={actor.photo} 
                alt={actor.name} 
                className="actor-hero-img" 
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="actor-no-photo-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", padding: "20px", textAlign: "center", background: "rgba(255,255,255,0.05)", borderRadius: "20px", border: "1px dashed rgba(255,255,255,0.2)", color: "#ccc" }}>
                <span style={{ fontSize: "2rem", marginBottom: "8px" }}>🎬</span>
                <span style={{ fontSize: "0.82rem", lineHeight: "1.3", color: "rgba(255,255,255,0.7)", fontWeight: "500" }}>
                  Мы работаем над сайтом, фотографии пока нет
                </span>
              </div>
            )}
            <div className="actor-hero-photo-ring" />
          </div>

          <div className="actor-hero-meta">
            <h1 className="actor-hero-name">{actor.name}</h1>
            {actor.nameEn && <span className="actor-hero-name-en">{actor.nameEn}</span>}
            
            {/* User Statistics Badges relative to this actor */}
            <div className="actor-user-stats-grid">
              <div className="actor-user-stat-card">
                <span className="stat-num">{actorMovies.length}</span>
                <span className="stat-label">Фильмов в MatchWatch</span>
              </div>
              <div className="actor-user-stat-card">
                <span className="stat-num">{userStats.likedCount}</span>
                <span className="stat-label">Просмотрено вами</span>
              </div>
              {userStats.averageRating && (
                <div className="actor-user-stat-card actor-user-stat-card--rating">
                  <span className="stat-num">★ {userStats.averageRating}</span>
                  <span className="stat-label">Ваша ср. оценка</span>
                </div>
              )}
              <div className="actor-user-stat-card actor-user-stat-card--progress">
                <span className="stat-num">{userStats.completionRate}%</span>
                <span className="stat-label">Изучено вами</span>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column Layout for Biography / Facts and Filmography */}
        <div className="actor-profile-columns">
          {/* Left / Facts & Stills Column */}
          <div className="actor-profile-left-column">
            {/* Actor Stills Section */}
            {Array.isArray(actorStills) && actorStills.length > 0 && (
              <div className="actor-card-section" style={{ marginBottom: "20px" }}>
                <h3 className="section-title">📸 Кадры со съёмок</h3>
                <div 
                  style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))", 
                    gap: "8px", 
                    marginTop: "10px"
                  }}
                >
                  {actorStills.map((stillUrl, i) => (
                    <img
                      key={i}
                      src={stillUrl}
                      alt={`Кадр ${i + 1}`}
                      onClick={() => setActiveStillIndex(i)}
                      style={{
                        height: "70px",
                        width: "100%",
                        borderRadius: "8px",
                        objectFit: "cover",
                        border: "1px solid rgba(255,255,255,0.12)",
                        boxShadow: "0 3px 8px rgba(0,0,0,0.35)",
                        cursor: "pointer",
                        transition: "transform 0.2s ease"
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="actor-card-section">
              <h3 className="section-title">💡 Удивительные факты</h3>
              <ul className="actor-detailed-facts">
                {actor.facts.map((fact, index) => (
                  <li key={index} className="actor-detailed-fact-item">
                    <span className="fact-icon">🌟</span>
                    <p className="fact-text">{fact}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right / Filmography Column */}
          <div className="actor-profile-right-column">
            <div className="actor-card-section">
              <div className="actor-filmography-header-row">
                <h3 className="section-title" style={{ margin: 0 }}>
                  🎞️ Фильмография ({filteredMovies.length})
                </h3>
                
                {/* Filmography Filter Controls */}
                <div className="actor-filmography-filters">
                  <button 
                    onClick={() => setFilterType("all")} 
                    className={`category-btn filter-pill ${filterType === "all" ? "active" : ""}`}
                  >
                    Всё
                  </button>
                  <button 
                    onClick={() => setFilterType("movie")} 
                    className={`category-btn filter-pill ${filterType === "movie" ? "active" : ""}`}
                  >
                    Фильмы
                  </button>
                  <button 
                    onClick={() => setFilterType("series")} 
                    className={`category-btn filter-pill ${filterType === "series" ? "active" : ""}`}
                  >
                    Сериалы
                  </button>
                  <button 
                    onClick={() => setFilterType("anime")} 
                    className={`category-btn filter-pill ${filterType === "anime" ? "active" : ""}`}
                  >
                    Аниме
                  </button>
                </div>
              </div>

              {/* Filmography Search */}
              <div className="actor-search-wrapper">
                <input
                  type="text"
                  placeholder="Поиск по названию фильма..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input actor-search-input"
                />
                {searchQuery && (
                  <button className="btn btn-secondary actor-search-clear" onClick={() => setSearchQuery("")}>
                    ✕
                  </button>
                )}
              </div>

              {/* Filmography Grid */}
              {filteredMovies.length > 0 ? (
                <div className="actor-page-movies-grid">
                  {filteredMovies.map((m) => {
                    const hasLiked = userAppData.decisions?.[m.id] === "like";
                    return (
                      <div
                        key={m.id}
                        className="actor-grid-movie-card"
                        onClick={() => onMovieSelect?.(m)}
                        title={m.titleRu || m.title}
                      >
                        <div className="movie-card-poster-wrapper">
                          <img src={m.poster} alt={m.title} className="movie-card-poster-img" />
                          <div className="movie-card-badges">
                            {m.rating && <span className="movie-rating-badge">★ {m.rating}</span>}
                            {hasLiked && <span className="movie-liked-badge">❤️</span>}
                          </div>
                        </div>
                        <div className="movie-card-info-box">
                          <h4 className="movie-card-title">{m.titleRu || m.title}</h4>
                          <div className="movie-card-meta-line">
                            <span className="movie-card-year">{m.year}</span>
                            {m.genres && (
                              <span className="movie-card-genre">
                                • {m.genres.split(",")[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="actor-no-results">
                  <p className="no-results-text">
                    {searchQuery
                      ? "Фильмы с таким названием в фильмографии не найдены."
                      : "Нет фильмов выбранного типа в нашей коллекции."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* macOS QuickLook Modal for Actor Movie Stills */}
      {activeStillIndex !== null && actorStills[activeStillIndex] && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setActiveStillIndex(null)}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              position: "relative",
              maxWidth: "85vw",
              maxHeight: "82vh",
              background: "#16151f",
              borderRadius: "18px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.12)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* macOS Window Header */}
            <div
              style={{
                width: "100%",
                padding: "12px 18px",
                background: "rgba(255,255,255,0.03)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setActiveStillIndex(null)}
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: "#ff5f56",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 0 4px rgba(255,95,86,0.5)"
                  }}
                  title="Закрыть"
                />
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#ffbd2e", opacity: 0.8 }} />
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#27c93f", opacity: 0.8 }} />
              </div>

              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                {actor.name} — Кадр {activeStillIndex + 1} из {actorStills.length}
              </span>

              <button
                onClick={() => setActiveStillIndex(null)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  fontSize: "1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Still Image & Arrows */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                maxWidth: "100%",
                maxHeight: "calc(82vh - 50px)",
                overflow: "hidden"
              }}
            >
              {actorStills.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStillIndex((activeStillIndex - 1 + actorStills.length) % actorStills.length);
                  }}
                  style={{
                    position: "absolute",
                    left: "24px",
                    zIndex: 2,
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: "1.4rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                  }}
                >
                  ‹
                </button>
              )}

              <img
                src={actorStills[activeStillIndex]}
                alt={`Кадр ${activeStillIndex + 1}`}
                style={{
                  maxWidth: "100%",
                  maxHeight: "calc(82vh - 90px)",
                  objectFit: "contain",
                  borderRadius: "10px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                }}
              />

              {actorStills.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStillIndex((activeStillIndex + 1) % actorStills.length);
                  }}
                  style={{
                    position: "absolute",
                    right: "24px",
                    zIndex: 2,
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: "1.4rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                  }}
                >
                  ›
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
