import { useState } from "react";
import { motion } from "framer-motion";
import "./DetailedMovieModal.css";

export default function DetailedMovieModal({ movie, onClose, isLiked, onToggleLike, isFavorite, onToggleFavorite, rating, onSetRating }) {
  const [hoverRating, setHoverRating] = useState(0);
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
