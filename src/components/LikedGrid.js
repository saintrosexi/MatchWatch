import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import DetailedMovieModal from "./DetailedMovieModal";
import TasteProfile from "./TasteProfile";

export default function LikedGrid({ liked, decisions, onToggleLike, favorites, onToggleFavorite, ratings, onSetRating }) {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredLiked = liked.filter(m => {
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
      <div className="liked-grid-wrapper">
        <TasteProfile likedMovies={liked} favorites={favorites} ratings={ratings} />

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
            {filteredLiked.length === 0 ? (
              <div className="empty-message">
                {getEmptyMessage()}
              </div>
            ) : (
              filteredLiked.map(m => (
                <div 
                  key={m.id} 
                  className="grid-item"
                  onClick={() => setSelectedMovie(m)}
                  style={{ cursor: "pointer" }}
                >
                  <img src={m.poster} alt={m.title} />
                  <div className="movie-title">{m.titleRu || m.title}</div>
                </div>
              ))
            )}
          </div>
        </div>
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
