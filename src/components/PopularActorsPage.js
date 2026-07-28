import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { movies } from "../data";
import { actorsData } from "../actorsData";

// Robust string normalization for matching actor names
const normalizeName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name.toLowerCase().replace(/[^а-яёa-z0-9]/g, "");
};

function PopularActorCard({ actor, index, onActorSelect }) {
  const [imgError, setImgError] = useState(false);

  const hasPhoto = actor.photo && !imgError && !actor.photo.includes("unsplash");

  return (
    <motion.div
      key={actor.name}
      className="popular-actor-card"
      onClick={() => onActorSelect(actor.name)}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -6 }}
    >
      {/* Actor Portrait Frame with Circular Accent Glow */}
      <div className="popular-actor-avatar-wrapper">
        {hasPhoto ? (
          <img 
            src={actor.photo} 
            alt={actor.name} 
            className="popular-actor-portrait" 
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="popular-actor-no-photo-grid" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", padding: "12px", textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: "16px", border: "1px dashed rgba(255,255,255,0.2)", color: "#aaa" }}>
            <span style={{ fontSize: "1.5rem", marginBottom: "4px" }}>🎬</span>
            <span style={{ fontSize: "0.72rem", lineHeight: "1.25", color: "rgba(255,255,255,0.65)", fontWeight: "500" }}>
              Мы работаем над сайтом, фотографии пока нет
            </span>
          </div>
        )}
        <div className="popular-actor-card-overlay" />
        {actor.completionRate > 0 && (
          <span className="actor-completion-badge">
            {actor.completionRate}%
          </span>
        )}
      </div>

      {/* Actor Meta Data */}
      <div className="popular-actor-info">
        <h3 className="popular-actor-name">{actor.name}</h3>
        {actor.nameEn && <span className="popular-actor-name-en">{actor.nameEn}</span>}

        {/* Statistics Line */}
        <div className="popular-actor-stat-row">
          <span className="actor-stat-capsule actor-stat-capsule--films">
            🎬 {actor.filmsCount} фильмов
          </span>
          {actor.swipedCount > 0 && (
            <span className="actor-stat-capsule actor-stat-capsule--liked">
              👀 {actor.swipedCount} совпадений
            </span>
          )}
        </div>

        {/* Progress bar of swiped filmography */}
        {actor.filmsCount > 0 && (
          <div className="actor-progress-bar-container">
            <div 
              className="actor-progress-bar-fill" 
              style={{ width: `${actor.completionRate}%` }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function PopularActorsPage({ onActorSelect, userAppData = {} }) {
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate actors list with real-time filmography frequency and user stats
  const popularActorsList = useMemo(() => {
    const decs = userAppData.decisions || {};
    
    // We only show the curated actors that are in our actorsData database
    return Object.values(actorsData).map((actor) => {
      // Find all movies with this actor
      const normalizedTarget = normalizeName(actor.name);
      const starredMovies = movies.filter((m) => {
        if (!m.actors || typeof m.actors !== "string") return false;
        const list = m.actors.split(",").map((s) => normalizeName(s.trim()));
        return list.includes(normalizedTarget);
      });

      // Count user swiped/liked movies
      let swipedCount = 0;
      let likedCount = 0;
      starredMovies.forEach((m) => {
        const swiped = decs[m.id] !== undefined;
        const liked = decs[m.id] === "like";
        if (swiped) swipedCount++;
        if (liked) likedCount++;
      });

      return {
        ...actor,
        filmsCount: starredMovies.length,
        swipedCount,
        likedCount,
        completionRate: starredMovies.length > 0 ? Math.round((swipedCount / starredMovies.length) * 100) : 0
      };
    })
    // Filter out variants/duplicates if name matches
    .filter((actor, index, self) => 
      self.findIndex((a) => normalizeName(a.name) === normalizeName(actor.name)) === index
    )
    // Sort by number of films in our database descending
    .sort((a, b) => b.filmsCount - a.filmsCount);
  }, [userAppData]);

  // Filter list by search query
  const filteredActors = useMemo(() => {
    return popularActorsList.filter((actor) => {
      const nameRu = (actor.name || "").toLowerCase();
      const nameEn = (actor.nameEn || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      return nameRu.includes(query) || nameEn.includes(query);
    });
  }, [popularActorsList, searchQuery]);

  return (
    <div className="popular-actors-page-container">
      {/* Page Header */}
      <div className="actors-page-header">
        <div className="header-title-block">
          <span className="actors-page-tagline">Звезды экрана</span>
          <h1 className="actors-page-title">🌟 Лучшие актеры</h1>
        </div>
        <p className="actors-page-desc">
          Популярные кинозвезды из нашей коллекции фильмов. Просматривайте их фильмографию,
          читайте удивительные факты и отслеживайте свой прогресс просмотра их шедевров!
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="actor-search-wrapper" style={{ maxWidth: "600px", margin: "0 auto 40px auto" }}>
        <input
          type="text"
          placeholder="Поиск любимого актера по имени..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="actor-search-input"
          style={{ paddingLeft: "45px" }}
        />
        <span className="search-icon-inside" style={{ position: "absolute", left: "18px", top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>🔍</span>
        {searchQuery && (
          <button className="actor-search-clear" onClick={() => setSearchQuery("")}>
            ✕
          </button>
        )}
      </div>

      {/* Grid of Actors */}
      {filteredActors.length > 0 ? (
        <div className="popular-actors-grid">
          {filteredActors.map((actor, index) => (
            <PopularActorCard
              key={actor.name}
              actor={actor}
              index={index}
              onActorSelect={onActorSelect}
            />
          ))}
        </div>
      ) : (
        <div className="actor-no-results">
          <p className="no-results-text">
            Актеры с таким именем в нашей базе не найдены. Попробуйте ввести другое имя!
          </p>
        </div>
      )}
    </div>
  );
}
