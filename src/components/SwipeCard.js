import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState, useEffect } from "react";

export default function SwipeCard({ movie, onSwipe, onDragProgress, isTutorial = false }) {
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
      onSwipe(dir, movie);
    } else {
      onDragProgress?.(0, false);
    }
  };

  const posterHeight = isMobile ? "40%" : "55%";
  const infoHeight = isMobile ? "60%" : "45%";

  return (
    <motion.div
      className="swipe-card-inner"
      style={{
        x,
        rotate,
        opacity,
        cursor: isDragging ? "grabbing" : "grab",
        width: "100%",
        height: "100%"
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
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
              fontSize: "6rem",
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
              fontSize: "6rem",
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
        padding: isMobile ? "20px 20px" : "20px", 
        background: "white",
        color: "#000",
        overflow: "hidden"
      }}>
        {isTutorial ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px", fontWeight: "800" }}>Обучение</h2>
            <p style={{ fontSize: "1rem", lineHeight: "1.5", opacity: 0.8 }}>
              Свайпай <b>влево</b>, чтобы пропустить,<br/>
              или <b>вправо</b>, чтобы лайкнуть!
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: isMobile ? "8px" : "12px" }}>
              <h2 style={{ fontSize: isMobile ? "1.3rem" : "1.4rem", marginBottom: "2px", fontWeight: "800", letterSpacing: "-0.5px", lineHeight: "1.2" }}>{movie.titleRu || movie.title}</h2>
              <p style={{ fontSize: "0.85rem", color: "#888", fontWeight: "500" }}>{movie.year}</p>
            </div>
            
            <div style={{ fontSize: isMobile ? "0.75rem" : "0.9rem", color: "#333", marginBottom: isMobile ? "8px" : "12px", lineHeight: "1.4" }}>
              {movie.director && <div style={{ marginBottom: "2px" }}><b>Режиссер:</b> {movie.director}</div>}
              {movie.actors && <div><b>В ролях:</b> {movie.actors}</div>}
            </div>

            <div style={{ flex: 1, overflow: "hidden" }}>
              <p style={{ 
                fontSize: isMobile ? "0.8rem" : "0.9rem", 
                color: "#444", 
                lineHeight: "1.5", 
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: isMobile ? 12 : "unset", // Increased line clamp to allow more text
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }}>
                {movie.description}
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
