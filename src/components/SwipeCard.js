import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { useState, useEffect } from "react";

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
    "Перетяни карточку налево если тебе не нравится, Перетяни направо если тебе нравится, Нажми на карточку чтобы узнать больше о фильме",
  pcDescription:
    "Перетяни карточку налево если тебе не нравится, Перетяни направо если тебе нравится, Нажми на карточку чтобы узнать больше о фильме",
  backTitle: "Обучение",
  backAction:
    "Нажми еще раз чтобы вернуться к постеру или перетяни в любую сторону.",
};

export default function SwipeCard({
  movie: inputMovie,
  onSwipe,
  onDragProgress,
  onShowDetails,
  isTutorial = false,
}) {
  const movie = isTutorial ? TUTORIAL_MOVIE : inputMovie;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  const [showInfo, setShowInfo] = useState(false);
  const [isSwiped, setIsSwiped] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const x = useMotionValue(0);

  const rotate = useTransform(x, [-150, 0, 150], [-15, 0, 15]);
  const opacity = useTransform(
    x,
    [-150, -100, 0, 100, 150],
    [0.5, 1, 1, 1, 0.5],
  );

  const feedbackScale = useTransform(x, [-150, 0, 150], [2.5, 0, 2.5], {
    clamp: true,
  });
  const heartOpacity = useTransform(x, [0, 50], [0, 1], { clamp: true });
  const crossOpacity = useTransform(x, [-50, 0], [1, 0], { clamp: true });

  const handleDragStart = () => {
    setIsDragging(true);
    onDragProgress?.(0, true);
  };

  const handleDrag = (event, info) => {
    onDragProgress?.(info.offset.x, true);
  };

  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (Math.abs(offset) > 70 || Math.abs(velocity) > 400) {
      const dir = offset > 0 ? "right" : "left";
      setIsSwiped(true);
      onSwipe(dir, movie);
      // Reset hints in parent immediately
      onDragProgress?.(0, false);
    } else {
      onDragProgress?.(0, false);
    }
  };

  const handleCardClick = (e) => {
    if (Math.abs(x.get()) > 10) return;

    if (isMobile) {
      setShowInfo(!showInfo);
    }
  };

  const handleInfoClick = (e) => {
    if (Math.abs(x.get()) > 10) return;

    if (!isMobile) {
      onShowDetails?.(movie);
    } else {
      setShowInfo(!showInfo);
    }
  };

  // PC: Static 60/40 split. Mobile: Mode 1 (100% overlay), Mode 2 (10/90)
  const posterHeight = isMobile ? (showInfo ? "10%" : "100%") : "60%";
  const infoHeight = isMobile ? (showInfo ? "90%" : "0%") : "40%";

  return (
    <div
      className="swipe-card-perspective"
      style={{
        perspective: "1200px",
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <motion.div
        className="swipe-card-inner"
        onClick={isMobile ? handleCardClick : undefined}
        animate={{
          rotateY: isMobile && showInfo ? 180 : 0,
        }}
        transition={{
          rotateY: { type: "spring", stiffness: 260, damping: 20 },
        }}
        style={{
          x,
          rotate,
          opacity,
          cursor: isDragging ? "grabbing" : "grab",
          width: "100%",
          height: "100%",
          borderRadius: "24px",
          display: "flex",
          flexDirection: "column",
          transformStyle: "preserve-3d",
          position: "relative",
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={1}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      >
        {/* FRONT FACE */}
        <div
          className="card-face card-front"
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            backfaceVisibility: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "white",
            borderRadius: "24px",
            overflow: "hidden",
          }}
        >
          <AnimatePresence>
            {isMobile && !isSwiped && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    scale: feedbackScale,
                    opacity: heartOpacity,
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    x: "-50%",
                    y: "-50%",
                    fontSize: "6rem",
                    zIndex: 100,
                    pointerEvents: "none",
                    textShadow: "0 0 40px rgba(0,0,0,0.5)",
                  }}
                >
                  ❤️
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    scale: feedbackScale,
                    opacity: crossOpacity,
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    x: "-50%",
                    y: "-50%",
                    fontSize: "6rem",
                    zIndex: 100,
                    pointerEvents: "none",
                    color: "#ff4757",
                    textShadow: "0 0 40px rgba(0,0,0,0.5)",
                  }}
                >
                  ✕
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div
            className="poster-container"
            style={{
              pointerEvents: "none",
              height: posterHeight,
              flex: `0 0 ${posterHeight}`,
              width: "100%",
              overflow: "hidden",
              position: "relative",
              transition: "height 0.3s ease",
            }}
          >
            {!isTutorial && movie.releaseDate && new Date(movie.releaseDate) > new Date("2026-05-19") && (
              <div
                className="badge-coming-soon"
                style={{
                  position: "absolute",
                  top: "20px",
                  left: "20px",
                  background: "linear-gradient(135deg, rgba(255, 138, 80, 0.95) 0%, rgba(233, 30, 99, 0.95) 100%)",
                  backdropFilter: "blur(10px)",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "0.8rem",
                  fontWeight: "bold",
                  boxShadow: "0 4px 15px rgba(233, 30, 99, 0.35)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  zIndex: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                🍿 Скоро в кино
              </div>
            )}
            {isTutorial ? (

              <div
                className="tutorial-poster-content"
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                  position: "relative",
                  padding: "20px",
                }}
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{ fontSize: "6rem", marginBottom: "20px" }}
                >
                  ✨
                </motion.div>
                {isMobile && !showInfo && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "white",
                      fontWeight: "600",
                      fontSize: "1.1rem",
                      lineHeight: "1.4",
                      textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                      maxWidth: "280px",
                    }}
                  >
                    Нажми, чтобы узнать подробнее о фильме
                  </div>
                )}
              </div>
            ) : (
              <>
                {!imageLoaded && <div className="image-skeleton" />}
                <img
                  className="poster"
                  src={movie.poster}
                  alt={movie.title}
                  onLoad={() => setImageLoaded(true)}
                  draggable={false}
                  style={{
                    pointerEvents: "none",
                    objectFit: "cover",
                    width: "100%",
                    height: "100%",
                  }}
                />
                {isMobile && !showInfo && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: "80px 20px 25px",
                      background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.9) 100%)",
                      zIndex: 5,
                      color: "white",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end"
                    }}
                  >
                    <h2 className="swipe-card-title-mobile">
                      {movie.titleRu || movie.title}
                    </h2>
                    <div className="swipe-card-meta-mobile">
                      {movie.year} {movie.genres ? `• ${movie.genres.split(',')[0]}` : ''}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div
            className="info-front"
            onClick={!isMobile ? handleInfoClick : undefined}
            style={{
              height: infoHeight,
              flex: `0 0 ${infoHeight}`,
              display: isMobile && !showInfo ? "none" : "flex",
              flexDirection: "column",
              padding: isMobile ? "20px" : "15px 20px",
              background: "white",
              color: "#000",
              overflow: "hidden",
              justifyContent: isMobile ? "flex-start" : "flex-start",
              transition: "height 0.3s ease",
            }}
          >
            <div style={{ marginBottom: isMobile ? "8px" : "8px" }}>
              <h2
                style={{
                  fontSize: isMobile ? "1.3rem" : "1.2rem",
                  fontWeight: "800",
                  margin: 0,
                  whiteSpace: isMobile ? "normal" : "normal",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {movie.titleRu || movie.title}
              </h2>
              {!isMobile && (
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#888",
                    fontWeight: "500",
                    marginTop: "2px",
                  }}
                >
                  {movie.year}
                </p>
              )}
            </div>

            {!isMobile && (
              <>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#333",
                    marginBottom: "8px",
                    lineHeight: "1.3",
                  }}
                >
                  {movie.director && (
                    <div style={{ marginBottom: "2px" }}>
                      <b>Режиссер:</b> {movie.director}
                    </div>
                  )}
                  {movie.actors && (
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      <b>В ролях:</b> {movie.actors}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#444",
                      lineHeight: "1.4",
                      margin: 0,
                    }}
                  >
                    {isTutorial ? movie.pcDescription : movie.description}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* BACK FACE (Mobile only flip) */}
        {isMobile && (
          <div
            className="card-face card-back"
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              display: "flex",
              flexDirection: "column",
              background: "white",
              borderRadius: "24px",
              overflow: "hidden",
              padding: "20px",
            }}
          >
            <div
              className="back-header"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
                paddingBottom: "15px",
                marginBottom: "15px",
              }}
            >
              <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#1a1a1a", letterSpacing: "-0.5px" }}>
                {isTutorial ? movie.backTitle : movie.titleRu || movie.title}
              </h2>
            </div>

            <div
              className="back-content"
              style={{
                flex: 1,
                overflowY: "auto",
                color: "#444",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              {isTutorial ? (
                <p
                  style={{
                    fontSize: "1rem",
                    lineHeight: "1.5",
                    fontWeight: "500",
                    padding: "0 10px",
                    color: "#333",
                  }}
                >
                  {movie.backAction}
                </p>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      color: "#888",
                      marginBottom: "15px",
                    }}
                  >
                    {movie.year} {movie.releaseDate && new Date(movie.releaseDate) > new Date("2026-05-19") && `(Ожидается: ${formatReleaseDate(movie.releaseDate)})`} • {movie.genres}
                  </p>

                  <p style={{ fontSize: "0.95rem", lineHeight: "1.5", color: "#1a1a1a" }}>
                    {movie.description}
                  </p>
                  {movie.director && (
                    <p style={{ marginTop: "15px", fontSize: "0.9rem" }}>
                      <b>Режиссер:</b> {movie.director}
                    </p>
                  )}
                </>
              )}
            </div>

            <div
              className="back-footer"
              style={{
                marginTop: "15px",
                paddingTop: "15px",
                borderTop: "1px solid #eee",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#8e8e93",
                  lineHeight: "1.4",
                  fontWeight: "500",
                }}
              >
                {!isTutorial && "Нажми, чтобы вернуться к постеру или свайпай"}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
