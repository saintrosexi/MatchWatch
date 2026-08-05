import { useState, useMemo } from "react";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";
import { ChamaBanner, ChamaBackgroundArt } from "../chamaAssets";

export default function SearchMovies({ decisions, onToggleLike, favorites, onToggleFavorite, ratings, onSetRating }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeCategory, setActiveCategory] = useState("movie");
  const [visibleCount, setVisibleCount] = useState(25);

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

  const displayedMovies = useMemo(() => {
    return filteredMovies.slice(0, visibleCount);
  }, [filteredMovies, visibleCount]);

  const getTitle = () => {
    switch(activeCategory) {
      case 'series': return '🔍 Поиск сериалов';
      case 'anime': return '🔍 Поиск аниме';
      default: return '🔍 Поиск фильмов';
    }
  };

  return (
    <div className="search-movies-container relative overflow-hidden">
      <ChamaBackgroundArt type="SEARCH_GLASS" opacity={0.22} />
      <h2 className="page-title">{getTitle()}</h2>
      
      <div className="category-picker">
        <button 
          className={`category-btn ${activeCategory === 'movie' ? 'active' : ''}`}
          onClick={() => { setActiveCategory('movie'); setSelectedYear(""); setVisibleCount(25); }}
        >
          Фильмы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'series' ? 'active' : ''}`}
          onClick={() => { setActiveCategory('series'); setSelectedYear(""); setVisibleCount(25); }}
        >
          Сериалы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'anime' ? 'active' : ''}`}
          onClick={() => { setActiveCategory('anime'); setSelectedYear(""); setVisibleCount(25); }}
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
            onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(25); }}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="year-select">Год:</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => { setSelectedYear(e.target.value); setVisibleCount(25); }}
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
        {displayedMovies.length > 0 ? (
          displayedMovies.map(movie => (
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
          <div className="no-results w-full col-span-full py-6">
            <ChamaBanner
              type="EMPTY_POPCORN"
              title="Ничего не найдено"
              text="Чама обыскал всю библиотеку, но ничего не нашёл по вашему запросу. Попробуйте изменить запрос!"
              size="large"
            />
          </div>
        )}
      </div>

      {visibleCount < filteredMovies.length && (
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
            Показать ещё ({filteredMovies.length - visibleCount} осталось)
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
