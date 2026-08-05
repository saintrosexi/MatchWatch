import { useState } from "react";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";

export default function TopMovies({ decisions, onToggleLike, favorites, onToggleFavorite, ratings, onSetRating }) {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [visibleCount, setVisibleCount] = useState(25);

  // Sort movies by rating and filter by category
  const topMovies = [...movies]
    .filter(m => (m.type || "movie") === activeCategory)
    .sort((a, b) => b.rating - a.rating);

  const displayedMovies = topMovies.slice(0, visibleCount);

  const getTitle = () => {
    switch(activeCategory) {
      case 'series': return '⭐ Топ сериалов';
      case 'anime': return '⭐ Топ аниме';
      default: return '⭐ Топ фильмов';
    }
  };

  return (
    <div className="top-movies-container">
      <h2 className="page-title">{getTitle()}</h2>
      
      <div className="category-picker">
        <button 
          className={`category-btn ${activeCategory === 'movie' ? 'active' : ''}`}
          onClick={() => { setActiveCategory('movie'); setVisibleCount(25); }}
        >
          Фильмы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'series' ? 'active' : ''}`}
          onClick={() => { setActiveCategory('series'); setVisibleCount(25); }}
        >
          Сериалы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'anime' ? 'active' : ''}`}
          onClick={() => { setActiveCategory('anime'); setVisibleCount(25); }}
        >
          Аниме
        </button>
      </div>

      <div className="top-movies-grid">
        {displayedMovies.map((movie, index) => (
          <div
            key={movie.id}
            className="top-movie-card"
            onClick={() => setSelectedMovie(movie)}
          >
            <div className="top-movie-rank">#{index + 1}</div>
            <img
              src={movie.poster}
              alt={movie.title}
              className="top-movie-poster"
            />
            <div className="top-movie-info">
              <div className="top-movie-title">
                {movie.titleRu || movie.title}
              </div>
              <div className="top-movie-meta">
                <span className="rating">⭐ {movie.rating}</span>
                <span className="year">{movie.year}</span>
              </div>
              <div className="top-movie-director">
                Режиссер: {movie.director}
              </div>
            </div>
            <div className="top-movie-overlay" />
          </div>
        ))}
      </div>

      {visibleCount < topMovies.length && (
        <div style={{ textAlign: "center", margin: "25px 0 10px 0" }}>
          <button 
            className="btn btn-primary"
            onClick={() => setVisibleCount(prev => prev + 25)}
            style={{
              padding: "12px 28px",
              borderRadius: "24px",
              fontWeight: "bold",
              fontSize: "0.95rem",
              background: "linear-gradient(135deg, #ff8a50 0%, #ff5e62 100%)",
              boxShadow: "0 4px 15px rgba(255, 138, 80, 0.3)",
              border: "none",
              cursor: "pointer"
            }}
          >
            Показать ещё ({topMovies.length - visibleCount} осталось)
          </button>
        </div>
      )}

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
    </div>
  );
}
