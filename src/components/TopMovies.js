import { useState } from "react";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";

export default function TopMovies() {
  const [selectedMovie, setSelectedMovie] = useState(null);

  // Sort movies by rating in descending order (no slicing - show all)
  const topMovies = [...movies].sort((a, b) => b.rating - a.rating);

  return (
    <div className="top-movies-container">
      <h2 className="page-title">⭐ Топ фильмов</h2>
      <div className="top-movies-grid">
        {topMovies.map((movie, index) => (
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

      {selectedMovie && (
        <DetailedMovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
        />
      )}
    </div>
  );
}
