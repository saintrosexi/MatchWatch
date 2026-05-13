import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useState, useEffect } from "react";

export default function SwipeCard({ movie, onSwipe, onDragProgress, isTutorial = false }) {
  const [direction, setDirection] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const x = useMotionValue(0);
  
  const rotate = useTransform(x, [-150, 0, 150], [-15, 0, 15]);
  const opacity = useTransform(x, [-150, -100, 0, 100, 150], [0.5, 1, 1, 1, 0.5]);
  
  const feedbackScale = useTransform(x, [-150, 0, 150], [2.5, 0, 2.5], { clamp: true });
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
      setDirection(offset > 0 ? 1 : -1);
      onDragProgress?.(offset > 0 ? 300 : -300, true); 
      onSwipe(dir, movie);
    } else {
      onDragProgress?.(0, false);
    }
  };

  const exitAnimation = { 
    y: 1000, 
    rotate: direction * 25, 
    opacity: 0, 
    transition: { duration: 0.6, ease: "easeIn" } 
  };

  // Responsive layout values
  const posterHeight = isMobile ? "45%" : "55%";
  const infoHeight = isMobile ? "55%" : "45%";

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
          width: "100%",
          height: "100%"
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={1}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={exitAnimation}
        transition={{
          type: "spring",
          stiffness: 350,
          damping: 25
        }}
      >
        {isMobile && (
          <>
            <motion.div 
              style={{ 
                scale: feedbackScale, 
                opacity: heartOpacity,
                position: "absolute",
                top: "50%",
                left: "50%",
                x: "-50%",
                y: "-50%",
                fontSize: "7rem",
                zIndex: 100,
                pointerEvents: "none",
                textShadow: "0 0 40px rgba(0,0,0,0.5)"
              }}
            >
              ❤️
            </motion.div>
            <motion.div 
              style={{ 
                scale: feedbackScale, 
                opacity: crossOpacity,
                position: "absolute",
                top: "50%",
                left: "50%",
                x: "-50%",
                y: "-50%",
                fontSize: "7rem",
                zIndex: 100,
                pointerEvents: "none",
                color: "#ff4757",
                textShadow: "0 0 40px rgba(0,0,0,0.5)"
              }}
            >
              ✕
            </motion.div>
          </>
        )}

        <div className="poster-container" style={{ pointerEvents: "none", height: posterHeight, flex: `0 0 ${posterHeight}` }}>
          {isTutorial ? (
             <div className="tutorial-poster-content" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)" }}>
               <div style={{ fontSize: "5rem" }}>👋</div>
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
                style={{ pointerEvents: "none" }}
              />
            </>
          )}
        </div>
        <div className="info" style={{ 
          height: infoHeight, 
          flex: `0 0 ${infoHeight}`, 
          display: "flex", 
          flexDirection: "column", 
          padding: isMobile ? "24px" : "20px", 
          background: "white", // Matching the photo's clean white look
          color: "#000"
        }}>
          {isTutorial ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "15px", fontWeight: "800" }}>Обучение</h2>
              <p style={{ fontSize: "1.1rem", lineHeight: "1.6", opacity: 0.8 }}>
                Свайпай <b>влево</b>, чтобы пропустить,<br/>
                или <b>вправо</b>, чтобы лайкнуть!
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: isMobile ? "1.6rem" : "1.4rem", marginBottom: "4px", fontWeight: "800", letterSpacing: "-0.5px", lineHeight: "1.2" }}>{movie.titleRu || movie.title}</h2>
                <p style={{ fontSize: "0.95rem", color: "#888", fontWeight: "500" }}>{movie.year}</p>
              </div>
              
              <div style={{ fontSize: "0.9rem", color: "#333", marginBottom: "20px", lineHeight: "1.5" }}>
                {movie.director && <div style={{ marginBottom: "6px" }}><b>Режиссер:</b> {movie.director}</div>}
                {movie.actors && <div><b>В ролях:</b> {movie.actors}</div>}
              </div>

              <div style={{ flex: 1, overflowY: isMobile ? "auto" : "visible" }}>
                <p style={{ 
                  fontSize: isMobile ? "0.95rem" : "0.9rem", 
                  color: "#444", 
                  lineHeight: "1.6", 
                  margin: 0,
                  display: "-webkit-box",
                  WebkitLineClamp: isMobile ? 6 : "unset",
                  WebkitBoxOrient: "vertical",
                  overflow: isMobile ? "hidden" : "visible"
                }}>
                  {movie.description}
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
