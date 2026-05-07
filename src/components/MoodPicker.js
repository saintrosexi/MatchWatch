import { useState } from "react";
import { movies } from "../data";
import MovieModal from "./MovieModal";

const MOODS = [
  {
    id: "chill",
    label: "Расслабиться",
    emoji: "😌",
    keywords: ["comedy", "light", "feel-good", "adventure", "animation"]
  },
  {
    id: "smart",
    label: "Умное кино",
    emoji: "🧠",
    keywords: ["drama", "crime", "mystery", "thriller", "psychological"]
  },
  {
    id: "romance",
    label: "Романтика",
    emoji: "💕",
    keywords: ["love", "romance", "drama", "family", "drama"]
  },
  {
    id: "epic",
    label: "Мощное кино",
    emoji: "💥",
    keywords: ["action", "war", "epic", "science fiction", "fantasy"]
  }
];

// Categorize movies into moods based on keywords in description/title
const getMoodCategory = (movie) => {
  const text = `${movie.title} ${movie.titleRu} ${movie.description}`.toLowerCase();
  
  // Simple heuristic-based categorization
  if (movie.rating >= 8.8 && text.includes("drama")) return "smart";
  if (text.includes("fantasy") || text.includes("action")) return "epic";
  if (text.includes("comedy") || movie.year < 1980) return "chill";
  if (movie.rating >= 8.9) return "smart";
  
  // Default to mood based on year and rating
  const defaultMoods = ["chill", "smart", "romance", "epic"];
  return defaultMoods[movie.id % defaultMoods.length];
};

export default function MoodPicker() {
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);

  const filteredMovies = selectedMood
    ? movies.filter(movie => getMoodCategory(movie) === selectedMood)
    : [];

  const selectedMoodData = MOODS.find(m => m.id === selectedMood);

  return (
    <div className="mood-picker-container">
      <h2 className="page-title">🎬 Выбери настроение</h2>
      <p className="mood-subtitle">Какой фильм тебе нужен прямо сейчас?</p>

      <div className="moods-grid">
        {MOODS.map(mood => (
          <button
            key={mood.id}
            className={`mood-card ${selectedMood === mood.id ? "active" : ""}`}
            onClick={() => setSelectedMood(mood.id)}
          >
            <div className="mood-emoji">{mood.emoji}</div>
            <div className="mood-label">{mood.label}</div>
          </button>
        ))}
      </div>

      {selectedMood && (
        <div className="mood-results">
          <h3 className="mood-results-title">
            {selectedMoodData?.emoji} {selectedMoodData?.label}
          </h3>
          <p className="mood-results-count">
            Найдено <strong>{filteredMovies.length}</strong> фильм(ов)
          </p>

          <div className="mood-movies-grid">
            {filteredMovies.map(movie => (
              <div
                key={movie.id}
                className="mood-movie-card"
                onClick={() => setSelectedMovie(movie)}
              >
                <div className="mood-movie-poster-container">
                  <img
                    src={movie.poster}
                    alt={movie.titleRu || movie.title}
                    className="mood-movie-poster"
                  />
                  <div className="mood-movie-rating">⭐ {movie.rating}</div>
                </div>
                <div className="mood-movie-info">
                  <h4 className="mood-movie-title">
                    {movie.titleRu || movie.title}
                  </h4>
                  <p className="mood-movie-year">{movie.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
        />
      )}
    </div>
  );
}
