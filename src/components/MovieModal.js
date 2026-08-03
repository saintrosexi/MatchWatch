import { motion } from "framer-motion";
import "../styles/MovieModal.css";

export default function MovieModal({ movie, onClose }) {
  if (!movie) return null;

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <button className="close-btn modal-close-btn" onClick={onClose}>✕</button>

        <div className="modal-poster">
          <img src={movie.poster} alt={movie.titleRu} />
        </div>

        <div className="modal-info">
          <h2>{movie.titleRu || movie.title}</h2>
          <p className="modal-year">{movie.year}</p>
          <p className="modal-director"><strong>Режиссер:</strong> {movie.director}</p>
          <p className="modal-rating"><strong>Рейтинг:</strong> {movie.rating}</p>

          <div className="modal-buttons">
            <a 
              href={movie.trailer} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary btn-trailer"
            >
              ▶ Трейлер
            </a>
            <a 
              href={movie.imdb} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-secondary btn-imdb"
            >
              Подробнее на IMDb
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
