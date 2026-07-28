import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { triggerHaptic } from "../tma";
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

const TUTORIAL_MOVIE = {
  id: "tutorial",
  title: "Обучение",
  titleRu: "Обучение",
  year: "MatchWatch",
  poster:
    "https://images.unsplash.com/photo-1585647347384-2593bcac5503?q=80&w=1000&auto=format&fit=crop",
  description:
    "Смахни карточку направо, если фильм нравится, или налево, если хочешь пропустить. Нажми в любое место, чтобы открыть подробное описание.",
  pcDescription:
    "Перетяни карточку налево если тебе не нравится, Перетяни направо если тебе нравится, Нажми на карточку чтобы узнать больше о фильме",
  backTitle: "Обучение",
};

export default function SwipeCard({
  movie: inputMovie,
  onSwipe,
  onShowDetails,
  isTutorial = false,
}) {
  const movie = isTutorial ? TUTORIAL_MOVIE : inputMovie;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  const [isExpanded, setIsExpanded] = useState(false);

  const imgRef = useRef(null);

  // Poster candidate state algorithm
  const [posterCandidates, setPosterCandidates] = useState([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [currentPosterSrc, setCurrentPosterSrc] = useState("");

  useEffect(() => {
    if (movie) {
      const candidates = getPosterCandidates(movie);
      setPosterCandidates(candidates);
      setCandidateIndex(0);
      setCurrentPosterSrc(candidates[0] || movie.poster || "");
      setImageLoaded(false);

      // Safety timeout: never leave skeleton loader visible for more than 700ms
      const timer = setTimeout(() => {
        setImageLoaded(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [movie?.id]);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setImageLoaded(true);
    }
  }, [currentPosterSrc]);

  const handleImageError = async () => {
    // Try next precomputed candidate URL first
    if (candidateIndex + 1 < posterCandidates.length) {
      const nextIdx = candidateIndex + 1;
      setCandidateIndex(nextIdx);
      setCurrentPosterSrc(posterCandidates[nextIdx]);
    } else {
      // If candidates exhausted, try a live API search lookup by title & year
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

  useEffect(() => {
    setIsExpanded(false);
  }, [movie?.id]);

  const x = useMotionValue(0);

  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12]);
  const opacity = useTransform(
    x,
    [-200, -150, 0, 150, 200],
    [0.6, 1, 1, 1, 0.6]
  );

  // Dynamic Neon Glow based on drag direction
  const cardGlow = useTransform(
    x,
    [-150, 0, 150],
    [
      "0 15px 40px rgba(255, 71, 87, 0.4), 0 0 60px rgba(255, 71, 87, 0.5), 0 0 120px rgba(255, 71, 87, 0.3), 0 0 0 3px rgba(255, 71, 87, 0.7)",
      "0 24px 50px rgba(0, 0, 0, 0.6), 0 0 0px rgba(0, 0, 0, 0), 0 0 0px rgba(0, 0, 0, 0), 0 0 0 1px rgba(255, 255, 255, 0.08)",
      "0 15px 40px rgba(46, 213, 115, 0.4), 0 0 60px rgba(46, 213, 115, 0.5), 0 0 120px rgba(46, 213, 115, 0.3), 0 0 0 3px rgba(46, 213, 115, 0.7)"
    ]
  );

  // Tinder/Bumble style diagonal badges
  const likeBadgeOpacity = useTransform(x, [10, 80], [0, 1], { clamp: true });
  const skipBadgeOpacity = useTransform(x, [-80, -10], [1, 0], { clamp: true });
  
  const likeBadgeScale = useTransform(x, [0, 100], [0.8, 1], { clamp: true });
  const skipBadgeScale = useTransform(x, [-100, 0], [1, 0.8], { clamp: true });

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDrag = (event, info) => {
    // Hardware accelerated dragging, no React re-renders!
  };

  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (Math.abs(offset) > 100 || Math.abs(velocity) > 600) {
      const dir = offset > 0 ? "right" : "left";
      triggerHaptic(dir === "right" ? "medium" : "light");
      onSwipe(dir, movie);
    }
  };

  const handleCardClick = (e) => {
    // If the user was dragging, do not toggle expand
    if (Math.abs(x.get()) > 10) return;
    
    // Check if clicked specifically on the "подробнее" / "свернуть" action indicator
    const isIndicatorClick = e.target.closest(".info-overlay-action-indicator");
    
    if (isIndicatorClick) {
      // Toggle the local expandable description drawer inside the card
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="swipe-card-perspective">
      <motion.div
        className="swipe-card-inner"
        onClick={handleCardClick}
        style={{
          x,
          rotate,
          opacity,
          boxShadow: cardGlow,
          cursor: isDragging ? "grabbing" : "grab",
          width: "100%",
          height: "100%",
          borderRadius: "24px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden"
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Glowing Swipe Feedback Badges */}
        <AnimatePresence>
          {isMobile && (
            <>
              {/* LIKE BADGE (Top Left, Green Glow) */}
              <motion.div
                style={{
                  opacity: likeBadgeOpacity,
                  scale: likeBadgeScale,
                  position: "absolute",
                  top: "30px",
                  left: "30px",
                  zIndex: 200,
                  transform: "rotate(-15deg)",
                  pointerEvents: "none"
                }}
              >
                <div className="swipe-feedback-badge swipe-feedback-badge--like">
                  МАТЧ
                </div>
              </motion.div>

              {/* SKIP BADGE (Top Right, Red Glow) */}
              <motion.div
                style={{
                  opacity: skipBadgeOpacity,
                  scale: skipBadgeScale,
                  position: "absolute",
                  top: "30px",
                  right: "30px",
                  zIndex: 200,
                  transform: "rotate(15deg)",
                  pointerEvents: "none"
                }}
              >
                <div className="swipe-feedback-badge swipe-feedback-badge--skip">
                  МИМО
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Poster Media Section */}
        <div className="swipe-card-poster-container">
          {!isTutorial && movie.releaseDate && new Date(movie.releaseDate) > new Date("2026-05-19") && (
            <div className="badge-coming-soon-mobile">
              🍿 Скоро в кино
            </div>
          )}

          {isTutorial ? (
            <div className="tutorial-poster-content-mobile">
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                style={{ fontSize: "5.5rem", filter: "drop-shadow(0 0 20px rgba(59,130,246,0.6))" }}
              >
                🎬
              </motion.div>
              <div className="tutorial-title">Свайпай и выбирай</div>
            </div>
          ) : (
            <>
              {!imageLoaded && <div className="image-skeleton-premium" />}
              <img
                ref={imgRef}
                className="poster-premium"
                src={currentPosterSrc || movie.poster}
                alt={movie.titleRu || movie.title}
                onLoad={() => setImageLoaded(true)}
                onError={handleImageError}
                referrerPolicy="no-referrer"
                draggable={false}
                decoding="async"
              />
            </>
          )}
        </div>

        {/* Premium Integrated Info overlay */}
        <div className={`swipe-card-info-overlay ${isExpanded ? "expanded" : ""}`}>
          <div className="info-overlay-gradient" />
          
          <div className="info-overlay-content" style={{ pointerEvents: "auto" }}>
            <div className="info-overlay-top-row">
              <h2 className="info-overlay-title">
                {movie.titleRu || movie.title}
              </h2>
            </div>

            <div className="info-overlay-pills">
              <span className="info-pill info-pill--year">
                {movie.year}
              </span>
              
              {!isTutorial && movie.rating && (
                <span className="info-pill info-pill--rating">
                  ⭐ {movie.rating}
                </span>
              )}
              
              {movie.genres && (
                <span className="info-pill info-pill--genre">
                  {movie.genres.split(",")[0]}
                </span>
              )}
            </div>

            <p className={`info-overlay-desc ${isExpanded ? "expanded" : ""}`}>
              {movie.releaseDate && new Date(movie.releaseDate) > new Date() && (
                <span className="coming-soon-date-tag" style={{ display: "block", color: "#ff8a50", fontWeight: "bold", marginBottom: "6px", fontSize: "0.82rem" }}>
                  📅 Премьера: {formatReleaseDate(movie.releaseDate)}
                </span>
              )}
              {movie.description}
            </p>

            {/* Extra details when expanded */}
            {isExpanded && !isTutorial && (
              <div className="info-overlay-extra-details">
                {movie.director && (
                  <p className="info-detail-line">
                    <strong>Режиссер:</strong> {movie.director}
                  </p>
                )}
                {movie.actors && (
                  <p className="info-detail-line">
                    <strong>В ролях:</strong>{" "}
                    {movie.actors.split(",").map((actor, idx, arr) => {
                      const trimmed = actor.trim();
                      return (
                        <span key={trimmed}>
                          <span
                            className="clickable-actor-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(
                                new CustomEvent("show-actor-details", {
                                  detail: trimmed,
                                })
                              );
                            }}
                          >
                            {trimmed}
                          </span>
                          {idx < arr.length - 1 ? ", " : ""}
                        </span>
                      );
                    })}
                  </p>
                )}
              </div>
            )}

            <div className="info-overlay-action-indicator">
              <span>{isExpanded ? "Свернуть" : "Подробнее"}</span>
              <motion.span 
                animate={isExpanded ? { y: [0, 3, 0] } : { y: [0, -3, 0] }} 
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="indicator-chevron"
              >
                {isExpanded ? "▼" : "▲"}
              </motion.span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
