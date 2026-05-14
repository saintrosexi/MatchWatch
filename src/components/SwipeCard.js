import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { useState, useEffect } from "react";

const TUTORIAL_MOVIE = {
  id: "tutorial",
  title: "Как пользоваться?",
  titleRu: "Как пользоваться?",
  year: "Обучение",
  poster:
    "https://images.unsplash.com/photo-1585647347384-2593bcac5503?q=80&w=1000&auto=format&fit=crop",
  description: "Нажми чтобы перевернуть и узнать больше 👆",
  backTitle: "Управление карточками",
  backInstructions: [
    { emoji: "❤️", text: "Свайп ВПРАВО — если фильм нравится" },
    { emoji: "✕", text: "Свайп ВЛЕВО — чтобы пропустить" },
    { emoji: "✨", text: "Если лайки совпадут — вы узнаете об этом!" },
  ],
  backAction: "нажми если хочешь вернуться к постеру или свапни в одну из сторон",
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
    return () => {
      window.removeEventListener("resize", handleResize);
      // Safety reset for hints
      onDragProgress?.(0, false);
    };
  }, [onDragProgress]);

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
              height: isMobile ? "95%" : "65%",
              flex: `0 0 ${isMobile ? "95%" : "65%"}`,
              width: "100%",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {isTutorial ? (
              <div
                className="tutorial-poster-content"
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                }}
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{ fontSize: "8rem" }}
                >
                  ✨
                </motion.div>
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
              </>
            )}
          </div>

          <div
            className="info-front"
            style={{
              height: isMobile ? "5%" : "35%",
              flex: `0 0 ${isMobile ? "5%" : "35%"}`,
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
              background: "white",
              color: "#000",
              overflow: "hidden",
            }}
          >
            <h2
              style={{
                fontSize: isMobile ? "1rem" : "1.4rem",
                fontWeight: "800",
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {movie.titleRu || movie.title}
            </h2>
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
                height: "10%",
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid #eee",
                marginBottom: "15px",
              }}
            >
              <h2
                style={{ fontSize: "1.2rem", fontWeight: "800", color: "#333" }}
              >
                {isTutorial ? movie.backTitle : movie.titleRu || movie.title}
              </h2>
            </div>

            <div
              className="back-content"
              style={{ flex: 1, overflowY: "auto", color: "#444" }}
            >
              {isTutorial ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                    marginTop: "10px",
                  }}
                >
                  {movie.backInstructions.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "15px",
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "12px",
                      }}
                    >
                      <span style={{ fontSize: "1.5rem" }}>{item.emoji}</span>
                      <span style={{ fontSize: "0.95rem", fontWeight: "600" }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      color: "#888",
                      marginBottom: "15px",
                    }}
                  >
                    {movie.year} • {movie.genres}
                  </p>
                  <p style={{ fontSize: "1rem", lineHeight: "1.6" }}>
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
                  color: "#999",
                  fontStyle: "italic",
                  lineHeight: "1.4",
                }}
              >
                {isTutorial
                  ? movie.backAction
                  : "Нажми, чтобы вернуться к постеру или свайпай"}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
