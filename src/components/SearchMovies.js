import { useState, useMemo } from "react";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";

export default function SearchMovies({ decisions, onToggleLike }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMovie, setSelectedMovie] = useState(null);

  // Get all available years
  const availableYears = useMemo(() => {
    return [...new Set(movies.map(m => m.year))].sort((a, b) => b - a);
  }, []);

  // Filter movies based on search and year
  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (movie.title?.toLowerCase() || "").includes(searchLower) ||
        (movie.titleRu?.toLowerCase() || "").includes(searchLower) ||
        (movie.director?.toLowerCase() || "").includes(searchLower);
      
      const matchesYear = !selectedYear || movie.year.toString() === selectedYear;
      
      return matchesSearch && matchesYear;
    });
  }, [searchTerm, selectedYear]);

  return (
    <div className="search-movies-container">
      <h2 className="page-title">🔍 Поиск фильмов</h2>
      
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
          Найдено: <strong>{filteredMovies.length}</strong> фильмов
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
        />
      )}
    </div>
  );
}
