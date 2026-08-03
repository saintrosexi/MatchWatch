import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import DetailedMovieModal from "./DetailedMovieModal";
import TasteProfile from "./TasteProfile";
import { ChamaBanner, ChamaBackgroundArt } from "../chamaAssets";

const getDaysUntilRelease = (releaseDateStr) => {
  const currentDate = new Date("2026-05-19");
  const releaseDate = new Date(releaseDateStr);
  const diffTime = releaseDate - currentDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const formatCountdown = (releaseDateStr) => {
  const days = getDaysUntilRelease(releaseDateStr);
  if (days <= 0) return "🍿 Уже в кино!";
  if (days === 1) return "🔥 Премьера завтра!";
  if (days === 2) return "🔥 Премьера послезавтра!";
  if (days <= 30) return `⏳ Осталось ${days} дн.`;
  
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (remainingDays === 0) {
    return `⏳ Через ${months} мес.`;
  }
  return `⏳ Через ${months} мес. и ${remainingDays} дн.`;
};

export default function LikedGrid({ liked, decisions, onToggleLike, favorites, onToggleFavorite, ratings, onSetRating }) {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");

  const releasedLiked = liked.filter(m => !m.releaseDate || new Date(m.releaseDate) <= new Date("2026-05-19"));
  const waitingLiked = liked.filter(m => m.releaseDate && new Date(m.releaseDate) > new Date("2026-05-19"));

  const filteredReleasedLiked = releasedLiked.filter(m => {
    if (activeCategory === "all") return true;
    return (m.type || "movie") === activeCategory;
  });

  const filteredWaitingLiked = waitingLiked.filter(m => {
    if (activeCategory === "all") return true;
    return (m.type || "movie") === activeCategory;
  });

  const getGridTitle = () => {
    switch (activeCategory) {
      case "movie": return "Любимые фильмы";
      case "series": return "Любимые сериалы";
      case "anime": return "Любимые аниме";
      default: return "Всё любимое";
    }
  };

  const getEmptyMessage = () => {
    switch (activeCategory) {
      case "movie": return "Вы ещё не добавили фильмы в избранное. Начните свайпить! 🎬";
      case "series": return "Вы ещё не добавили сериалы в избранное. Начните свайпить! 📺";
      case "anime": return "Вы ещё не добавили аниме в избранное. Начните свайпить! 👾";
      default: return "Вы ещё не добавили ничего в избранное. Начните свайпить! 🍿";
    }
  };

  return (
    <>
      <div className="liked-grid-wrapper relative overflow-hidden">
        <ChamaBackgroundArt type="EATING_NACHOS" opacity={0.06} />
        <TasteProfile likedMovies={releasedLiked} favorites={favorites} ratings={ratings} />

        <div className="liked-section">
          <h2 className="page-title">❤️ {getGridTitle()}</h2>
          
          <div className="category-picker liked-category-picker">
            <button 
              className={`category-btn ${activeCategory === "all" ? "active" : ""}`}
              onClick={() => setActiveCategory("all")}
            >
              Все
            </button>
            <button 
              className={`category-btn ${activeCategory === "movie" ? "active" : ""}`}
              onClick={() => setActiveCategory("movie")}
            >
              🎬 Фильмы
            </button>
            <button 
              className={`category-btn ${activeCategory === "series" ? "active" : ""}`}
              onClick={() => setActiveCategory("series")}
            >
              📺 Сериалы
            </button>
            <button 
              className={`category-btn ${activeCategory === "anime" ? "active" : ""}`}
              onClick={() => setActiveCategory("anime")}
            >
              👾 Аниме
            </button>
          </div>

          <div className="grid">
            {filteredReleasedLiked.length === 0 ? (
              <div className="empty-message-container w-full col-span-full py-6">
                <ChamaBanner 
                  type="EMPTY_POPCORN"
                  title="Чама скучает..."
                  text={getEmptyMessage()}
                  size="large"
                />
              </div>
            ) : (
              filteredReleasedLiked.map(m => (
                <div 
                  key={m.id} 
                  className="grid-item"
                  onClick={() => setSelectedMovie(m)}
                  style={{ cursor: "pointer", position: "relative" }}
                >
                  <img src={m.poster} alt={m.title} />
                  {ratings?.[m.id] && (
                    <div className="glass-badge-rating">
                      ★ {ratings[m.id]}
                    </div>
                  )}
                  <div className="movie-title">{m.titleRu || m.title}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 2: Waiting List (Coming Soon) */}
        {filteredWaitingLiked.length > 0 && (
          <div className="liked-section waiting-section" style={{ marginTop: "40px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "40px" }}>
            <h2 className="page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              ⏳ Список ожидания (Coming Soon)
            </h2>
            <div className="grid">
              {filteredWaitingLiked.map(m => (
                <div 
                  key={m.id} 
                  className="grid-item waiting-grid-item"
                  onClick={() => setSelectedMovie(m)}
                  style={{ 
                    cursor: "pointer", 
                    position: "relative",
                    boxShadow: "0 0 15px rgba(255, 138, 80, 0.1)",
                    border: "1px solid rgba(255, 138, 80, 0.25)",
                    borderRadius: "16px",
                    overflow: "hidden"
                  }}
                >
                  <img src={m.poster} alt={m.title} style={{ transition: "all 0.3s ease" }} />
                  <div className="glass-badge-countdown">
                    {formatCountdown(m.releaseDate)}
                  </div>
                  <div className="movie-title">{m.titleRu || m.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedMovie && (
          <DetailedMovieModal 
            movie={selectedMovie} 
            onClose={() => setSelectedMovie(null)}
            isLiked={decisions?.[selectedMovie.id] === "like"}
            onToggleLike={onToggleLike}
            isFavorite={favorites?.[selectedMovie.id]}
            onToggleFavorite={onToggleFavorite}
            rating={ratings?.[selectedMovie.id]}
            onSetRating={onSetRating}
          />
        )}
      </AnimatePresence>
    </>
  );
}
