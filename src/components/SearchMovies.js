import { useState, useMemo } from "react";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";

export default function SearchMovies({ decisions, onToggleLike, favorites, onToggleFavorite, ratings, onSetRating }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeCategory, setActiveCategory] = useState("movie");

  // Get available years for current category
  const availableYears = useMemo(() => {
    const categoryMovies = movies.filter(m => (m.type || "movie") === activeCategory);
    return [...new Set(categoryMovies.map(m => m.year))].sort((a, b) => b - a);
  }, [activeCategory]);

  // Filter movies based on search, year and category
  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      const type = movie.type || "movie";
      if (type !== activeCategory) return false;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (movie.title?.toLowerCase() || "").includes(searchLower) ||
        (movie.titleRu?.toLowerCase() || "").includes(searchLower) ||
        (movie.director?.toLowerCase() || "").includes(searchLower);
      
      const matchesYear = !selectedYear || movie.year.toString() === selectedYear;
      
      return matchesSearch && matchesYear;
    });
  }, [searchTerm, selectedYear, activeCategory]);

  const getTitle = () => {
    console.log("SEARCH DEBUG: searchTerm=", searchTerm, "activeCategory=", activeCategory, "filteredCount=", filteredMovies.length);
    switch(activeCategory) {
      case 'series': return '🔍 Поиск сериалов';
      case 'anime': return '🔍 Поиск аниме';
      default: return '🔍 Поиск фильмов';
    }
  };

  return (
    <div className="search-movies-container">
      <h2 className="page-title">{getTitle()}</h2>
      
      <div className="category-picker">
        <button 
          className={`category-btn ${activeCategory === 'movie' ? 'active' : ''}`}
          onClick={() => { setActiveCategory('movie'); setSelectedYear(""); }}
        >
          Фильмы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'series' ? 'active' : ''}`}
          onClick={() => { setActiveCategory('series'); setSelectedYear(""); }}
        >
          Сериалы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'anime' ? 'active' : ''}`}
          onClick={() => { setActiveCategory('anime'); setSelectedYear(""); }}
        >
          Аниме
        </button>
      </div>

      <div className="search-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск по названию или режиссёру..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="year-select">Год:</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="filter-select"
          >
            <option value="">Все годы</option>
            {availableYears.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="search-result-count">
          Найдено: <strong>{filteredMovies.length}</strong> {activeCategory === 'movie' ? 'фильмов' : activeCategory === 'series' ? 'сериалов' : 'аниме'}
        </div>
      </div>

      <div className="search-results-grid">
        {filteredMovies.length > 0 ? (
          filteredMovies.map(movie => (
            <div
              key={movie.id}
              className="search-result-card"
              onClick={() => setSelectedMovie(movie)}
            >
              <div className="result-poster-container">
                <img
                  src={movie.poster}
                  alt={movie.titleRu || movie.title}
                  className="result-poster"
                />
                <div className="result-rating">⭐ {movie.rating}</div>
              </div>
              <div className="result-info">
                <h3 className="result-title">
                  {movie.titleRu || movie.title}
                </h3>
                <p className="result-year">{movie.year}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="no-results">
            Фильмы не найдены
          </div>
        )}
      </div>

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
