import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { triggerHaptic } from "../tma";
import { getPosterCandidates, getBestPosterUrl, fetchLivePosterFromApi } from "../posterResolver";
import { getMovieVibeBadge } from "../recommendations";

const TUTORIAL_MOVIE = {
  id: "tutorial",
  title: "Обучение с Чамой 🐾",
  titleRu: "Обучение с Чамой 🐾",
  year: "MatchWatch v2",
  poster: "/chama/Mascot_demonstrating_swipe_gestures_202607301352.jpeg",
  description: "Привет! Я песик Чама 🐾 Смахни карточку вправо (лайк 👉) или влево (пропустить 👈). Нажимай ⭐ для Избранного и ℹ️ для деталей. Алгоритм MatchWatch создаст твой 5D вектор (Энергия, Мрачность, Интеллект, Эмоции, Динамика)!",
};

export default function SwipeCard({
  movie: inputMovie,
  onSwipe,
  onShowDetails,
  onUndo,
  onToggleFavorite,
  isFavorite = false,
  isTutorial = false,
}) {
  const movie = isTutorial ? TUTORIAL_MOVIE : inputMovie;
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const imgRef = useRef(null);

  // Poster candidate state algorithm
  const [posterCandidates, setPosterCandidates] = useState([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [currentPosterSrc, setCurrentPosterSrc] = useState(() => getBestPosterUrl(movie));

  useEffect(() => {
    if (movie) {
      const best = getBestPosterUrl(movie);
      const candidates = getPosterCandidates(movie);
      setPosterCandidates(candidates);
      setCandidateIndex(0);
      setCurrentPosterSrc(best);
    }
  }, [movie?.id]);

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
    setIsExpanded(false);
  }, [movie?.id]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-18, 0, 18]);
  const opacity = useTransform(x, [-300, -180, 0, 180, 300], [0.4, 1, 1, 1, 0.4]);

  const handleDragEnd = (_, info) => {
    setIsDragging(false);
    const threshold = 100;
    if (info.offset.x > threshold) {
      triggerHaptic("success");
      onSwipe("like", movie);
    } else if (info.offset.x < -threshold) {
      triggerHaptic("light");
      onSwipe("dislike", movie);
    }
  };

  const vibeBadge = isTutorial ? { emoji: "🐾", label: "5D Вектор Вкуса" } : getMovieVibeBadge(movie);

  return (
    <motion.div
      className="swipe-card"
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onClick={() => {
        if (!isDragging && onShowDetails) {
          onShowDetails(movie);
        }
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Dynamic Glowing Feedback Stamp */}
      <motion.div
        className="swipe-badge like"
        style={{ opacity: useTransform(x, [20, 120], [0, 1]) }}
      >
        МАТЧ
      </motion.div>
      <motion.div
        className="swipe-badge nope"
        style={{ opacity: useTransform(x, [-20, -120], [0, 1]) }}
      >
        МИМО
      </motion.div>

      {/* Poster Image */}
      <div className="swipe-card-poster-container">
        {vibeBadge && (
          <div
            className="vibe-sensation-badge"
            style={{
              background: `${vibeBadge.color}25`,
              borderColor: vibeBadge.color,
              color: vibeBadge.color,
            }}
          >
            {vibeBadge.label}
          </div>
        )}

        <img
          ref={imgRef}
          className="swipe-card-poster"
          src={currentPosterSrc || getBestPosterUrl(movie)}
          alt={movie.titleRu || movie.title}
          onError={handleImageError}
          referrerPolicy="no-referrer"
          draggable={false}
          loading="lazy"
          style={{
            objectFit: "cover",
            objectPosition: isTutorial ? "center 75%" : "center center"
          }}
        />
      </div>

      {/* Minimal Glass Content Overlay */}
      <div className="swipe-card-overlay">
        <div className="swipe-card-meta">
          {!isTutorial && movie.rating && (
            <span className="meta-rating">⭐ {movie.rating}</span>
          )}
          <span>{movie.year}</span>
          {movie.duration && <span>• {movie.duration}</span>}
        </div>

        <h2 className="swipe-card-title">{movie.titleRu || movie.title}</h2>

        <div className="swipe-card-genres">
          {movie.genres &&
            movie.genres.split(",").map((g) => (
              <span key={g} className="genre-badge">
                {g.trim()}
              </span>
            ))}
        </div>

        <p className="swipe-card-description">{movie.description}</p>
      </div>
    </motion.div>
  );
}
