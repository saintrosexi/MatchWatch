import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function SwipeCard({ movie, onSwipe, onDragProgress, isTutorial = false }) {
  const [liked_state, setLiked] = useState(false);
  const [direction, setDirection] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);

  const handleDrag = (event, info) => {
    setDragX(info.offset.x);
    onDragProgress?.(info.offset.x, true);
  };

  const handleDragStart = () => {
    setIsDragging(true);
    onDragProgress?.(dragX, true);
  };

  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Require significant drag to swipe
    if (Math.abs(offset) > 60 || Math.abs(velocity) > 300) {
      if (offset > 0) {
        setLiked(true);
        setDirection(1);
        // Wait for heart animation (1 second) then swipe
        setTimeout(() => onSwipe("right", movie), 1000);
      } else {
        setDirection(-1);
        onSwipe("left", movie);
      }
    }
    // Return to center on weak drag
    setDragX(0);
    onDragProgress?.(0, false);
  };

  const rotation = isDragging ? (dragX / 100) * 8 : 0;
  const yOffset = isDragging ? Math.abs(dragX) * 0.1 : 0;

  if (isTutorial) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="tutorial"
          className="movie-card tutorial-card"
          drag="x"
          dragConstraints={{ left: -150, right: 150 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ 
            x: direction * 800, 
            opacity: 0,
            transition: { duration: 0.5 }
          }}
          style={{
            cursor: isDragging ? "grabbing" : "grab"
          }}
        >
          <div className="tutorial-icon">👋</div>
          <div className="tutorial-text">
            Перетяни меня <b>влево</b>, если я тебе не нравлюсь.<br/><br/>
            Или <b>вправо</b>, если нравлюсь!
          </div>
          <div className="tutorial-arrows">
            <span>⬅️</span>
            <span>➡️</span>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          key={movie.id}
          className="movie-card"
          drag="x"
          dragConstraints={{ left: -150, right: 150 }}
          dragElastic={0.2}
          dragMomentum={false}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          initial={{ scale: 0.9, opacity: 0, y: 20, rotate: 0, x: 0 }}
          animate={{ scale: 1, opacity: 1, y: 0, rotate: 0, x: 0 }}
          exit={{
            x: direction * 800,
            y: 100,
            rotate: direction * 35,
            opacity: 0,
            scale: 0.8,
            transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] }
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 35,
            x: { type: "spring", stiffness: 500, damping: 45 }
          }}
          style={{
            transformOrigin: "bottom center",
            rotate: rotation,
            y: yOffset,
            cursor: isDragging ? "grabbing" : "grab"
          }}
        >
          {liked_state && (
            <motion.div
              className="heart"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: [0, 1.8, 1.5], rotate: [0, 10, 0] }}
              transition={{ duration: 0.7, times: [0, 0.6, 1] }}
            >
              ❤️
            </motion.div>
          )}

          <div className="poster-container" style={{ pointerEvents: "none" }}>
            {!imageLoaded && <div className="image-skeleton" />}
            <img
              className="poster"
              src={movie.poster}
              alt={movie.title}
              onLoad={() => setImageLoaded(true)}
              draggable={false}
              style={{ pointerEvents: "none" }}
            />
          </div>
          <div className="info">
            <h2>{movie.titleRu || movie.title}</h2>
            <p className="year">{movie.year}</p>
            <p className="description">{movie.description}</p>
            <div className="swipe-hint">
              <span style={{color: "#ff4757"}}>✕</span>
              <span style={{opacity: 0.3, fontSize: "1rem"}}>|</span>
              <span style={{color: "#2ed573"}}>❤️</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
