import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function SwipeCard({ movie, onSwipe, onDragProgress }) {
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

    // Require significant drag to swipe (lower threshold)
    if (Math.abs(offset) > 60 || Math.abs(velocity) > 300) {
      if (offset > 0) {
        setLiked(true);
        setDirection(1);
        setTimeout(() => onSwipe("right", movie), 500);
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
            x: direction * 600,
            y: 300,
            rotate: direction * 25,
            opacity: 0,
            scale: 0.7,
            transition: { duration: 0.5, ease: "easeIn" }
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            x: { type: "spring", stiffness: 400, damping: 40 }
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
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
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
            <div className="swipe-hint">← Пропустить | Нравится →</div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
