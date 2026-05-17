import { useState } from "react";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";

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

// Categorize movies into moods based on genres
const getMoodCategory = (movie) => {
  const genres = (movie.genres || "").toLowerCase();
  
  // Проверяем по ключевым жанрам
  if (genres.includes("комедия") || genres.includes("семейный") || genres.includes("мультфильм") || genres.includes("приключения")) {
    return "chill";
  }
  if (genres.includes("мелодрама") || genres.includes("романтика")) {
    return "romance";
  }
  if (genres.includes("боевик") || genres.includes("фантастика") || genres.includes("фэнтези") || genres.includes("триллер") || genres.includes("военный")) {
    return "epic";
  }
  if (genres.includes("драма") || genres.includes("криминал") || genres.includes("детектив") || genres.includes("биография") || genres.includes("история")) {
    return "smart";
  }
  
  // Фолбэк, если жанры не подошли
  const defaultMoods = ["chill", "smart", "romance", "epic"];
  return defaultMoods[movie.id % defaultMoods.length];
};

export default function MoodPicker({ decisions, onToggleLike, favorites, onToggleFavorite, ratings, onSetRating }) {
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeCategory, setActiveCategory] = useState("movie");

  const filteredMovies = selectedMood
    ? movies.filter(movie => {
        const type = movie.type || "movie";
        return type === activeCategory && getMoodCategory(movie) === selectedMood;
      })
    : [];

  const selectedMoodData = MOODS.find(m => m.id === selectedMood);

  const getCategoryLabel = () => {
    if (activeCategory === 'movie') return 'фильмов';
    if (activeCategory === 'series') return 'сериалов';
    return 'аниме';
  };

  return (
    <div className="mood-picker-container">
      <h2 className="page-title">🎬 Выбери настроение</h2>
      <p className="mood-subtitle">Что будем смотреть?</p>

      <div className="category-picker">
        <button 
          className={`category-btn ${activeCategory === 'movie' ? 'active' : ''}`}
          onClick={() => setSelectedMood(null) || setActiveCategory('movie')}
        >
          Фильмы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'series' ? 'active' : ''}`}
          onClick={() => setSelectedMood(null) || setActiveCategory('series')}
        >
          Сериалы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'anime' ? 'active' : ''}`}
          onClick={() => setSelectedMood(null) || setActiveCategory('anime')}
        >
          Аниме
        </button>
      </div>

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
            Найдено <strong>{filteredMovies.length}</strong> {getCategoryLabel()}
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
