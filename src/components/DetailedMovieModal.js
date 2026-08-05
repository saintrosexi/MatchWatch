import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import "../styles/DetailedMovieModal.css";
import { getPosterCandidates, fetchLivePosterFromApi, fetchLiveStillsFromApi } from "../posterResolver";

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

  const [activeStillIndex, setActiveStillIndex] = useState(null);

  const handlePrevStill = (e) => {
    e.stopPropagation();
    if (activeStillIndex !== null && liveStills.length > 0) {
      setActiveStillIndex((activeStillIndex - 1 + liveStills.length) % liveStills.length);
    }
  };

  const handleNextStill = (e) => {
    e.stopPropagation();
    if (activeStillIndex !== null && liveStills.length > 0) {
      setActiveStillIndex((activeStillIndex + 1) % liveStills.length);
    }
  };

  useEffect(() => {
    if (movie) {
      const candidates = getPosterCandidates(movie);
      setPosterCandidates(candidates);
      setCandidateIndex(0);
      setCurrentPosterSrc(candidates[0] || movie.poster || "");

      // If movie has static stills array with Unsplash / AI placeholders or empty, fetch REAL stills from API
      const hasRealStills = Array.isArray(movie.stills) && movie.stills.length > 0 && !movie.stills[0].includes("unsplash");
      if (hasRealStills) {
        setLiveStills(movie.stills);
      } else {
        fetchLiveStillsFromApi(movie.kinopoiskId, movie.titleRu || movie.title, movie.year).then(stills => {
          if (stills && stills.length > 0) {
            setLiveStills(stills);
          } else {
            setLiveStills([]);
          }
        });
      }
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

            {/* Stills / Movie Shots Section Right Below Title */}
            {Array.isArray(liveStills) && liveStills.length > 0 && (
              <div className="detailed-modal-section" style={{ margin: "14px 0" }}>
                <h3 className="section-title">📸 Кадры из фильма</h3>
                <div 
                  style={{ 
                    display: "flex", 
                    gap: "8px", 
                    overflowX: "auto", 
                    paddingBottom: "8px", 
                    marginTop: "8px",
                    scrollbarWidth: "thin"
                  }}
                >
                  {liveStills.map((stillUrl, i) => (
                    <img
                      key={i}
                      src={stillUrl}
                      alt={`Кадр ${i + 1}`}
                      onClick={() => setActiveStillIndex(i)}
                      style={{
                        height: "70px",
                        width: "110px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        border: "1px solid rgba(255,255,255,0.12)",
                        boxShadow: "0 3px 8px rgba(0,0,0,0.35)",
                        flexShrink: 0,
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ))}
                </div>
              </div>
            )}

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

      {/* macOS-style QuickLook Still Preview Window Modal */}
      {activeStillIndex !== null && liveStills[activeStillIndex] && (
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
            {/* macOS Window Title bar / Header */}
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
                  title="Закрыть (Esc)"
                />
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#ffbd2e", opacity: 0.8 }} />
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#27c93f", opacity: 0.8 }} />
              </div>

              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                Кадр {activeStillIndex + 1} из {liveStills.length}
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

            {/* Still Image & Navigation Arrows Container */}
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
              {liveStills.length > 1 && (
                <button
                  onClick={handlePrevStill}
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
                src={liveStills[activeStillIndex]}
                alt={`Кадр ${activeStillIndex + 1}`}
                style={{
                  maxWidth: "100%",
                  maxHeight: "calc(82vh - 90px)",
                  objectFit: "contain",
                  borderRadius: "10px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                }}
              />

              {liveStills.length > 1 && (
                <button
                  onClick={handleNextStill}
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
    </motion.div>
  );
}
