import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import "../styles/DetailedMovieModal.css";
import { getPosterCandidates, fetchLivePosterFromApi } from "../posterResolver";

const formatReleaseDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  return `${day} ${months[month - 1]} ${year}`;
};

export default function DetailedMovieModal({ movie, onClose, isLiked, onToggleLike, isFavorite, onToggleFavorite, rating, onSetRating }) {
  const [hoverRating, setHoverRating] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);

  const [posterCandidates, setPosterCandidates] = useState([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [currentPosterSrc, setCurrentPosterSrc] = useState("");

  useEffect(() => {
    if (movie) {
      const candidates = getPosterCandidates(movie);
      setPosterCandidates(candidates);
      setCandidateIndex(0);
      setCurrentPosterSrc(candidates[0] || movie.poster || "");
    }
  }, [movie]);

  const handleImageError = async () => {
    if (candidateIndex + 1 < posterCandidates.length) {
      const nextIdx = candidateIndex + 1;
      setCandidateIndex(nextIdx);
      setCurrentPosterSrc(posterCandidates[nextIdx]);
    } else {
      const livePoster = await fetchLivePosterFromApi(movie.titleRu || movie.title, movie.year);
      if (livePoster && livePoster !== currentPosterSrc) {
        setCurrentPosterSrc(livePoster);
      }
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!movie) return null;

  const extendedDescription = movie.fullDescription || movie.description;
  const kinopoiskUrl = movie.kinopoiskId 
    ? `https://www.kinopoisk.ru/film/${movie.kinopoiskId}/` 
    : `https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(movie.titleRu || movie.title)}`;
  
  const actors = (() => {
    const raw = movie.actors;
    if (!raw || typeof raw !== "string") return "";
    const list = raw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    return list.slice(0, 5).join(", ");
  })();

  return (
    <motion.div
      className="detailed-modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <motion.div
        className="detailed-modal-content"
        onClick={e => e.stopPropagation()}
        initial={isMobile ? { y: "100%" } : { scale: 0.85, opacity: 0, y: 20 }}
        animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
        exit={isMobile ? { y: "100%" } : { scale: 0.85, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
      >
        {/* Mobile Swipe-down Drag Handle Indicator */}
        <div className="detailed-modal-drag-handle" />

        {/* Close Button */}
        <button
          className="modal-close-btn"
          onClick={onClose}
          title="Закрыть"
          aria-label="Закрыть"
        >
          ✕
        </button>

        {/* Top Actions */}
        <div className="modal-top-actions">
          {onToggleLike && (
            <button 
              className={`modal-action-btn modal-like-btn ${isLiked ? "active" : ""}`} 
              onClick={() => onToggleLike(movie)}
              title={isLiked ? "Убрать из просмотренного" : "Отметить как просмотренное"}
              aria-label={isLiked ? "Убрать из просмотренного" : "Отметить как просмотренное"}
              aria-pressed={isLiked}
            >
              {isLiked ? "👁️" : "👁️‍🗨️"}
            </button>
          )}
          {onToggleFavorite && (
            <button 
              className={`modal-action-btn modal-bookmark-btn ${isFavorite ? "active" : ""}`} 
              onClick={() => onToggleFavorite(movie)}
              title={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
              aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
              aria-pressed={isFavorite}
            >
              {isFavorite ? "❤️" : "🤍"}
            </button>
          )}
        </div>

        <div className="detailed-modal-wrapper">
          {/* Left Section: Poster (Hidden or adapted in mobile layout via CSS) */}
          <div className="detailed-modal-left">
            <img
              src={currentPosterSrc || movie.poster}
              alt={movie.titleRu || movie.title}
              className="detailed-modal-poster"
              onError={handleImageError}
            />
          </div>

          {/* Right Section: Info */}
          <div className="detailed-modal-right">
            {/* Header Info */}
            <div className="detailed-modal-header">
              <h1 className="detailed-modal-title">
                {movie.titleRu || movie.title}
              </h1>
              
              <div className="detailed-modal-meta">
                <span className="modal-year">🗓️ {movie.year}</span>
                {movie.releaseDate && new Date(movie.releaseDate) > new Date("2026-05-19") ? (
                  <span className="modal-release-badge">
                    ⏳ Ожидается: {formatReleaseDate(movie.releaseDate)}
                  </span>
                ) : (
                  <span className="modal-rating">⭐ {movie.rating}</span>
                )}
              </div>
            </div>

            {/* About Movie Section */}
            <div className="detailed-modal-section">
              <h3 className="section-title">📽️ О фильме</h3>
              <div className="section-content">
                {movie.country && (
                  <p className="info-line">
                    <strong>Страна:</strong> {movie.country}
                  </p>
                )}
                {movie.genres && (
                  <p className="info-line">
                    <strong>Жанры:</strong> {movie.genres}
                  </p>
                )}
                {movie.director && (
                  <p className="info-line">
                    <strong>Режиссер:</strong> {movie.director}
                  </p>
                )}
                {movie.actors && (
                  <p className="info-line">
                    <strong>Актёры:</strong>{" "}
                    {movie.actors
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 5)
                      .map((actor, idx, arr) => {
                        return (
                          <span key={actor}>
                            <span
                              className="clickable-actor-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(
                                  new CustomEvent("show-actor-details", {
                                    detail: actor,
                                  })
                                );
                              }}
                            >
                              {actor}
                            </span>
                            {idx < arr.length - 1 ? ", " : ""}
                          </span>
                        );
                      })}
                  </p>
                )}
                {movie.duration && (
                  <p className="info-line">
                    <strong>Длительность:</strong> {movie.duration}
                  </p>
                )}
              </div>
            </div>

            {/* 5D Sensation Vector & Social Likes Section */}
            {movie.vector && (
              <div className="detailed-modal-section">
                <h3 className="section-title">📊 5D-Вектор Ощущений Фильма</h3>
                <div className="vector-breakdown-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", margin: "10px 0" }}>
                  <div style={{ background: "rgba(255,255,255,0.05)", padding: "8px 12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>⚡ Энергия</div>
                    <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((movie.vector.energy || 0.5) * 100)}%`, height: "100%", background: "linear-gradient(90deg, #ff9966, #ff5e62)" }} />
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.05)", padding: "8px 12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>🌙 Мрачность</div>
                    <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((movie.vector.darkness || 0.5) * 100)}%`, height: "100%", background: "linear-gradient(90deg, #a18cd1, #fbc2eb)" }} />
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.05)", padding: "8px 12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>🧠 Интеллект</div>
                    <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((movie.vector.intellect || 0.5) * 100)}%`, height: "100%", background: "linear-gradient(90deg, #4facfe, #00f2fe)" }} />
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.05)", padding: "8px 12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>💖 Эмоции</div>
                    <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((movie.vector.emotion || 0.5) * 100)}%`, height: "100%", background: "linear-gradient(90deg, #ff0844, #ffb199)" }} />
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.05)", padding: "8px 12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>🔥 Динамика</div>
                    <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((movie.vector.dynamism || 0.5) * 100)}%`, height: "100%", background: "linear-gradient(90deg, #f12711, #f5af19)" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Personal Rating Section */}
            {onSetRating && (
              <div className="detailed-modal-section">
                <h3 className="section-title">🌟 Моя оценка</h3>
                <div className="star-rating-container" onMouseLeave={() => setHoverRating(0)}>
                  {[1,2,3,4,5,6,7,8,9,10].map(star => (
                    <span 
                      key={star}
                      className={`rating-star ${star <= (hoverRating || rating || 0) ? 'active' : ''}`}
                      onMouseEnter={() => setHoverRating(star)}
                      onClick={() => onSetRating(movie, star === rating ? null : star)}
                    >
                      ★
                    </span>
                  ))}
                  <span className="rating-value">{rating ? `${rating}/10` : '—/10'}</span>
                </div>
              </div>
            )}

            {/* Stills / Movie Shots Section */}
            {Array.isArray(movie.stills) && movie.stills.length > 0 && (
              <div className="detailed-modal-section">
                <h3 className="section-title">📸 Кадры из фильма</h3>
                <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px", margin: "10px 0" }}>
                  {movie.stills.map((stillUrl, i) => (
                    <img
                      key={i}
                      src={stillUrl}
                      alt={`Кадр ${i + 1}`}
                      style={{
                        height: "110px",
                        borderRadius: "10px",
                        objectFit: "cover",
                        border: "1px solid rgba(255,255,255,0.1)",
                        flexShrink: 0
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Description Section */}
            <div className="detailed-modal-section detailed-modal-section--grow">
              <h3 className="section-title">📖 Описание</h3>
              <p className="section-description detailed-modal-description">
                {extendedDescription}
              </p>
            </div>

            {/* Links & Streaming Services */}
            <div className="detailed-modal-section">
              <h3 className="section-title">🍿 Где посмотреть онлайн</h3>
              <div className="streaming-services-grid" style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "10px 0 15px 0" }}>
                <a
                  href={`https://hd.kinopoisk.ru/search?query=${encodeURIComponent(movie.titleRu || movie.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="streaming-badge streaming-kp"
                  style={{ background: "#ff5500", color: "#fff", padding: "6px 14px", borderRadius: "16px", textDecoration: "none", fontSize: "0.82rem", fontWeight: "bold", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 2px 10px rgba(255,85,0,0.3)" }}
                >
                  ▶ Кинопоиск HD
                </a>
                <a
                  href={`https://www.ivi.ru/search/?q=${encodeURIComponent(movie.titleRu || movie.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="streaming-badge streaming-ivi"
                  style={{ background: "#ea0042", color: "#fff", padding: "6px 14px", borderRadius: "16px", textDecoration: "none", fontSize: "0.82rem", fontWeight: "bold", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 2px 10px rgba(234,0,66,0.3)" }}
                >
                  ▶ Иви
                </a>
                <a
                  href={`https://okko.tv/search/${encodeURIComponent(movie.titleRu || movie.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="streaming-badge streaming-okko"
                  style={{ background: "#5d15a5", color: "#fff", padding: "6px 14px", borderRadius: "16px", textDecoration: "none", fontSize: "0.82rem", fontWeight: "bold", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 2px 10px rgba(93,21,165,0.3)" }}
                >
                  ▶ Okko
                </a>
                <a
                  href={`https://wink.ru/search?query=${encodeURIComponent(movie.titleRu || movie.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="streaming-badge streaming-wink"
                  style={{ background: "#ff3366", color: "#fff", padding: "6px 14px", borderRadius: "16px", textDecoration: "none", fontSize: "0.82rem", fontWeight: "bold", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 2px 10px rgba(255,51,102,0.3)" }}
                >
                  ▶ Wink
                </a>
                <a
                  href={movie.trailer || `https://www.youtube.com/results?search_query=${encodeURIComponent((movie.titleRu || movie.title) + " трейлер")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="streaming-badge streaming-yt"
                  style={{ background: "#cc0000", color: "#fff", padding: "6px 14px", borderRadius: "16px", textDecoration: "none", fontSize: "0.82rem", fontWeight: "bold", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 2px 10px rgba(204,0,0,0.3)" }}
                >
                  🎬 Трейлер
                </a>
              </div>
            </div>

            <div className="detailed-modal-section detailed-modal-section-links">
              <a
                href={movie.imdb || `https://www.imdb.com/find/?q=${encodeURIComponent(movie.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-imdb-link"
              >
                Подробнее на IMDb
              </a>
              {kinopoiskUrl && (
                <a
                  href={kinopoiskUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-kp-link"
                >
                  Подробнее на Кинопоиске
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
