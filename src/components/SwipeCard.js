import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useState } from "react";

export default function SwipeCard({ movie, onSwipe, onDragProgress, isTutorial = false }) {
  const [direction, setDirection] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const x = useMotionValue(0);
  
  // Map horizontal drag to various properties
  const rotate = useTransform(x, [-150, 0, 150], [-15, 0, 15]);
  const opacity = useTransform(x, [-150, -100, 0, 100, 150], [0.5, 1, 1, 1, 0.5]);
  
  // Heart icon animations based on drag - Grows more when swiped further
  const heartScale = useTransform(x, [0, 100, 200], [0, 1.5, 3], { clamp: true });
  const heartOpacity = useTransform(x, [0, 50], [0, 1], { clamp: true });
  
  // Cross icon animations based on drag
  const crossScale = useTransform(x, [-200, -100, 0], [3, 1.5, 0], { clamp: true });
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
      setDirection(offset > 0 ? 1 : -1);
      onSwipe(dir, movie);
    } else {
      onDragProgress?.(0, false);
    }
  };

  const cardContent = isTutorial ? (
    <div className="tutorial-card-inner" style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", color: "white" }}>
      <div className="tutorial-icon" style={{ fontSize: "5rem", marginBottom: "20px" }}>👋</div>
      <div className="tutorial-text" style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "30px", textAlign: "center" }}>
        Перетяни меня <b>влево</b>, если я тебе не нравлюсь.<br/><br/>
        Или <b>вправо</b>, если нравлюсь!
      </div>
      <div className="tutorial-arrows" style={{ display: "flex", width: "100%", justifyContent: "space-between", fontSize: "2.5rem" }}>
        <span>⬅️</span>
        <span>➡️</span>
      </div>
    </div>
  ) : (
    <>
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
    </>
  );

  return (
    <AnimatePresence>
      <motion.div
        key={isTutorial ? "tutorial" : movie.id}
        className={`movie-card ${isTutorial ? 'tutorial-card' : ''}`}
        style={{
          x,
          rotate,
          opacity,
          cursor: isDragging ? "grabbing" : "grab",
          zIndex: 1,
          position: "relative",
          overflow: "hidden"
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }} // We handle the "throw" via exit and onSwipe
        dragElastic={1}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{
          x: direction * 1000,
          y: 200,
          rotate: direction * 45,
          opacity: 0,
          transition: { duration: 0.45, ease: "easeIn" }
        }}
        transition={{
          type: "spring",
          stiffness: 350,
          damping: 25
        }}
      >
        {/* Interactive feedback icons */}
        <motion.div 
          className="feedback-icon"
          style={{ 
            scale: heartScale, 
            opacity: heartOpacity,
            position: "absolute",
            top: "50%",
            left: "50%",
            x: "-50%",
            y: "-50%",
            fontSize: "7rem",
            zIndex: 10,
            pointerEvents: "none",
            textShadow: "0 0 40px rgba(0,0,0,0.5)"
          }}
        >
          ❤️
        </motion.div>
        
        <motion.div 
          className="feedback-icon"
          style={{ 
            scale: crossScale, 
            opacity: crossOpacity,
            position: "absolute",
            top: "50%",
            left: "50%",
            x: "-50%",
            y: "-50%",
            fontSize: "7rem",
            zIndex: 10,
            pointerEvents: "none",
            color: "#ff4757",
            textShadow: "0 0 40px rgba(0,0,0,0.5)"
          }}
        >
          ✕
        </motion.div>

        {cardContent}
      </motion.div>
    </AnimatePresence>
  );
}
