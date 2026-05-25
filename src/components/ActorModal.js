import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { movies } from "../data";
import { actorsData } from "../actorsData";

// Robust string normalization to match names across databases (e.g. spaces, dashes, case-insensitive)
const normalizeName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name.toLowerCase().replace(/[^а-яёa-z0-9]/g, "");
};

export default function ActorModal({ actorName, onClose, onMovieSelect }) {
  const actor = useMemo(() => {
    if (!actorName) return null;
    
    // Find in curated database
    const normalizedTarget = normalizeName(actorName);
    const matchKey = Object.keys(actorsData).find(
      (key) => normalizeName(key) === normalizedTarget
    );
    
    if (matchKey) {
      return actorsData[matchKey];
    }
    
    // Fallback profile if not in curated list
    return {
      name: actorName,
      nameEn: "Movie Star",
      photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=600&auto=format&fit=crop",
      facts: [
        "Харизматичный и невероятно талантливый актер, полюбившийся зрителям своими яркими ролями.",
        "Пользуется большим признанием критиков и авторитетом на съемочной площадке за свой профессионализм.",
        "Внес весомый творческий вклад в развитие кинематографа, создав множество незабываемых экранных образов."
      ]
    };
  }, [actorName]);

  // Dynamically filter all movies starring this actor in real-time
  const actorMovies = useMemo(() => {
    if (!actorName) return [];
    const normalizedTarget = normalizeName(actorName);
    return movies.filter((m) => {
      if (!m.actors || typeof m.actors !== "string") return false;
      const list = m.actors.split(",").map((s) => normalizeName(s.trim()));
      return list.includes(normalizedTarget);
    });
  }, [actorName]);

  if (!actorName || !actor) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="actor-modal-overlay"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24 }}
      >
        <motion.div
          className="actor-modal-content"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.9, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          {/* Close Button */}
          <button className="actor-modal-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>

          {/* Profile Header Block */}
          <div className="actor-profile-header">
            <div className="actor-photo-frame">
              <img src={actor.photo} alt={actor.name} className="actor-photo-img" />
              <div className="actor-photo-glow" />
            </div>
            
            <div className="actor-profile-meta">
              <h2 className="actor-name-ru">{actor.name}</h2>
              {actor.nameEn && <span className="actor-name-en">{actor.nameEn}</span>}
              
              <div className="actor-stats-capsules">
                <span className="actor-capsule actor-capsule--count">
                  🎬 {actorMovies.length} в базе
                </span>
                <span className="actor-capsule actor-capsule--status">
                  🌟 Звезда
                </span>
              </div>
            </div>
          </div>

          {/* Interesting Facts Block */}
          <div className="actor-modal-section">
            <h3 className="actor-section-title">💡 Интересные факты</h3>
            <ul className="actor-facts-list">
              {actor.facts.map((fact, index) => (
                <li key={index} className="actor-fact-item">
                  <span className="actor-fact-bullet">✨</span>
                  <p className="actor-fact-text">{fact}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Filmography Block */}
          <div className="actor-modal-section">
            <h3 className="actor-section-title">🎞️ Фильмография ({actorMovies.length})</h3>
            
            {actorMovies.length > 0 ? (
              <div className="actor-filmography-scroll">
                {actorMovies.map((m) => (
                  <div
                    key={m.id}
                    className="actor-film-card"
                    onClick={() => onMovieSelect?.(m)}
                    title={m.titleRu || m.title}
                  >
                    <div className="actor-film-poster-wrapper">
                      <img src={m.poster} alt={m.title} className="actor-film-poster" />
                      {m.rating && (
                        <span className="actor-film-rating">
                          ⭐ {m.rating}
                        </span>
                      )}
                    </div>
                    <h4 className="actor-film-title">
                      {m.titleRu || m.title}
                    </h4>
                    <span className="actor-film-year">
                      {m.year}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="actor-empty-filmography">
                Фильмы с этим актером пока не добавлены в нашу коллекцию.
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
