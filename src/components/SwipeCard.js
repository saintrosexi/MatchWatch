import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const TUTORIAL_MOVIE = {
  id: "tutorial",
  title: "Обучение",
  titleRu: "Обучение",
  year: "2024",
  poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1000&auto=format&fit=crop",
  description: "Нажми на меня, чтобы узнать больше. Свайпай вправо/влево для выбора.",
  descriptionBack: "На обороте — тапни для возврата или свайпай сразу",
  pcDescription: "Нажми на текст снизу, чтобы узнать больше. Свайпай вправо/влево для выбора."
};

export default function SwipeCard({ movie: inputMovie, onSwipe, onDragProgress, onShowDetails, isTutorial = false }) {
  const movie = isTutorial ? TUTORIAL_MOVIE : inputMovie;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  const [showInfo, setShowInfo] = useState(false);
  const [isSwiped, setIsSwiped] = useState(false);
  
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
      setIsSwiped(true);
      onSwipe(dir, movie);
    } else {
      onDragProgress?.(0, false);
    }
  };

  const handleCardClick = (e) => {
    // Threshold: if dragged more than 10px, block click
    if (Math.abs(x.get()) > 10) return;
    
    if (isMobile) {
      setShowInfo(!showInfo);
    } else {
      // On PC, this is handled by clicking the info area specifically
    }
  };

  const handleInfoClick = (e) => {
    if (Math.abs(x.get()) > 10) return;
    
    if (!isMobile) {
      onShowDetails?.(movie);
    } else {
      // On mobile, info click also toggles back
      setShowInfo(!showInfo);
    }
  };

  // PC: 65% poster. Mobile: Mode 1 (95/5), Mode 2 (20/80)
  const posterHeight = isMobile ? (showInfo ? "20%" : "95%") : "65%";
  const infoHeight = isMobile ? (showInfo ? "80%" : "5%") : "35%";

  return (
    <motion.div
      className="swipe-card-inner"
      onClick={isMobile ? handleCardClick : undefined}
      style={{
        x,
        rotate,
        opacity,
        cursor: isDragging ? "grabbing" : "grab",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: "24px",
        display: "flex",
        flexDirection: "column"
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
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
                textShadow: "0 0 40px rgba(0,0,0,0.5)"
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
                textShadow: "0 0 40px rgba(0,0,0,0.5)"
              }}
            >
              ✕
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="poster-container" style={{ 
        pointerEvents: "none", 
        height: posterHeight, 
        flex: `0 0 ${posterHeight}`, 
        width: "100%",
        transition: "height 0.3s ease"
      }}>
        {isTutorial ? (
           <div className="tutorial-poster-content" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
             <div style={{ fontSize: "8rem" }}>🎬</div>
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
              style={{ pointerEvents: "none", objectFit: "cover", width: "100%", height: "100%" }}
            />
          </>
        )}
      </div>
      
      <div className="info" 
        onClick={handleInfoClick}
        style={{ 
          height: infoHeight, 
          flex: `0 0 ${infoHeight}`, 
          display: "flex", 
          flexDirection: "column", 
          padding: "20px", 
          background: "white",
          color: "#000",
          overflow: "hidden",
          width: "100%",
          transition: "height 0.3s ease",
          cursor: isMobile ? "pointer" : "default"
        }}
      >
        {isTutorial ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px", fontWeight: "800" }}>{movie.titleRu}</h2>
            <p style={{ fontSize: "1.1rem", lineHeight: "1.5", opacity: 0.9, color: "#333" }}>
              {isMobile 
                ? (showInfo 
                    ? movie.descriptionBack 
                    : movie.description)
                : movie.pcDescription
              }
            </p>
            {isMobile && showInfo && (
              <p style={{ fontSize: "0.9rem", marginTop: "20px", color: "#666", fontWeight: "600", fontStyle: "italic" }}>
                «Тапни, чтобы вернуться к постеру, или свайпай»
              </p>
            )}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: isMobile ? "12px" : "8px" }}>
              <h2 style={{ fontSize: isMobile ? "1.5rem" : "1.4rem", marginBottom: "2px", fontWeight: "800", letterSpacing: "-0.5px", lineHeight: "1.2" }}>{movie.titleRu || movie.title}</h2>
              <p style={{ fontSize: "0.95rem", color: "#888", fontWeight: "500", marginTop: "2px" }}>{movie.year}</p>
            </div>
            
            <div style={{ fontSize: isMobile ? "0.9rem" : "0.9rem", color: "#333", marginBottom: isMobile ? "12px" : "8px", lineHeight: "1.4" }}>
              {movie.director && <div style={{ marginBottom: "4px" }}><b>Режиссер:</b> {movie.director}</div>}
              {movie.actors && <div><b>В ролях:</b> {movie.actors}</div>}
            </div>

            <div style={{ flex: 1, overflow: "hidden" }}>
              <p style={{ 
                fontSize: isMobile ? "1rem" : "0.9rem", 
                color: "#444", 
                lineHeight: "1.6", 
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: isMobile ? 15 : "unset",
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

