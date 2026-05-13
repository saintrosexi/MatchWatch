import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState, useEffect } from "react";

export default function SwipeCard({ movie, onSwipe, onDragProgress, onCardClick, isTutorial = false }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  const [showInfoOnMobile, setShowInfoOnMobile] = useState(false);
  
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
    if (isMobile) {
      setShowInfoOnMobile(false);
    }
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
      // If it wasn't a swipe, check for a click/tap
      if (Math.abs(offset) < 5 && Math.abs(info.offset.y) < 5) {
        if (isMobile) {
          setShowInfoOnMobile(!showInfoOnMobile);
        } else {
          onCardClick?.(movie);
        }
      }
    }
  };

  // PC: Poster 65%, Info 35%
  // Mobile: Toggle between Poster 100% and Info 100%
  const posterHeight = isMobile ? (showInfoOnMobile ? "0%" : "100%") : "65%";
  const infoHeight = isMobile ? (showInfoOnMobile ? "100%" : "0%") : "35%";

  return (
    <motion.div
      className="swipe-card-inner"
      style={{
        x,
        rotate,
        opacity,
        cursor: isDragging ? "grabbing" : "grab",
        width: "100%",
        height: "100%",
        borderRadius: "24px",
        overflow: "hidden",
        backgroundColor: "white"
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

      <div className="poster-container" style={{ 
        pointerEvents: "none", 
        height: posterHeight, 
        flex: `0 0 ${posterHeight}`, 
        width: "100%",
        transition: "height 0.3s ease",
        display: posterHeight === "0%" ? "none" : "block"
      }}>
        {isTutorial ? (
           <div className="tutorial-poster-content" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)" }}>
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
              style={{ pointerEvents: "none", width: "100%", height: "100%", objectFit: "cover" }}
            />
          </>
        )}
      </div>
      <div className="info" style={{ 
        height: infoHeight, 
        flex: `0 0 ${infoHeight}`, 
        display: infoHeight === "0%" ? "none" : "flex", 
        flexDirection: "column", 
        padding: "24px", 
        background: "white",
        color: "#000",
        overflow: "hidden",
        width: "100%",
        transition: "height 0.3s ease"
      }}>
        {isTutorial ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px", fontWeight: "800" }}>Обучение</h2>
            {isMobile ? (
               <p style={{ fontSize: "1.1rem", lineHeight: "1.5", opacity: 0.8 }}>
                 <b>Тап</b> — описание<br/>
                 <b>Свайп</b> — выбор
               </p>
            ) : (
               <p style={{ fontSize: "1rem", lineHeight: "1.5", opacity: 0.8 }}>
                 <b>Клик</b> — подробности<br/>
                 <b>Свайп</b> — выбор
               </p>
            )}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "8px" }}>
              <h2 style={{ fontSize: "1.4rem", marginBottom: "2px", fontWeight: "800", letterSpacing: "-0.5px", lineHeight: "1.2" }}>{movie.titleRu || movie.title}</h2>
              <p style={{ fontSize: "0.85rem", color: "#888", fontWeight: "500" }}>{movie.year}</p>
            </div>
            
            <div style={{ fontSize: "0.9rem", color: "#333", marginBottom: "8px", lineHeight: "1.4" }}>
              {movie.director && <div style={{ marginBottom: "2px" }}><b>Режиссер:</b> {movie.director}</div>}
              {movie.actors && <div><b>В ролях:</b> {movie.actors}</div>}
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              <p style={{ 
                fontSize: "0.95rem", 
                color: "#444", 
                lineHeight: "1.6", 
                margin: 0
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
