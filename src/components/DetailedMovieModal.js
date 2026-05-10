import { motion } from "framer-motion";
import "./DetailedMovieModal.css";

export default function DetailedMovieModal({ movie, onClose, isLiked, onToggleLike }) {
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
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="detailed-modal-content"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose} title="Закрыть">
          ✕
        </button>

        {/* Favorite Button */}
        {onToggleLike && (
          <button 
            className={`modal-favorite-btn ${isLiked ? "is-liked" : ""}`} 
            onClick={() => onToggleLike(movie)}
            title={isLiked ? "Убрать из избранного" : "Добавить в избранное"}
          >
            {isLiked ? "❤️" : "🤍"}
          </button>
        )}

        <div className="detailed-modal-wrapper">
          {/* Left Section: Poster */}
          <div className="detailed-modal-left">
            <img
              src={movie.poster}
              alt={movie.titleRu || movie.title}
              className="detailed-modal-poster"
            />
          </div>

          {/* Right Section: Info (no internal scroll) */}
          <div className="detailed-modal-right">
            {/* Header Info */}
            <div className="detailed-modal-header">
              <h1 className="detailed-modal-title">
                {movie.titleRu || movie.title}
              </h1>
              <div className="detailed-modal-meta">
                <span className="modal-year">🗓️ {movie.year}</span>
                <span className="modal-rating">⭐ {movie.rating}</span>
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
                {actors && (
                  <p className="info-line">
                    <strong>Актёры:</strong> {actors}
                  </p>
                )}
                {movie.duration && (
                  <p className="info-line">
                    <strong>Длительность:</strong> {movie.duration}
                  </p>
                )}
              </div>
            </div>

            {/* Description Section */}
            <div className="detailed-modal-section detailed-modal-section--grow">
              <h3 className="section-title">📖 Описание</h3>
              <p className="section-description detailed-modal-description">
                {extendedDescription}
              </p>
            </div>

            {/* Links */}
            <div className="detailed-modal-section">
              <a
                href={movie.imdb || `https://www.imdb.com/find/?q=${encodeURIComponent(movie.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-imdb-link"
              >
                Подробнее на IMDb
              </a>
              {kinopoiskUrl && (
                <a
                  href={kinopoiskUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-kp-link"
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
