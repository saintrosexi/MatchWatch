import { useState } from "react";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";

const MOODS = [
  {
    id: "chill",
    emoji: "😌",
    getLabel: (cat) => {
      if (cat === "movie") return "Посмеяться / Расслабиться";
      if (cat === "series") return "Залипнуть / Отдохнуть";
      return "Повседневность / Комедия";
    },
    getDescription: (cat) => {
      if (cat === "movie") return "Лёгкие комедии и весёлые приключения для отличного вечера.";
      if (cat === "series") return "Расслабляющие сериалы, под которые приятно отдохнуть после работы.";
      return "Уютное аниме про обычную жизнь, дружбу и с хорошим юмором.";
    }
  },
  {
    id: "smart",
    emoji: "🧠",
    getLabel: (cat) => {
      if (cat === "movie") return "Умное кино";
      if (cat === "series") return "Умный сюжет";
      return "Умный сюжет / Психология";
    },
    getDescription: (cat) => {
      if (cat === "movie") return "Глубокие драмы, детективы и биографии, заставляющие задуматься.";
      if (cat === "series") return "Сложные детективные интриги, заговоры и психологические игры.";
      return "Аниме с глубоким смыслом, запутанными загадками и психологией.";
    }
  },
  {
    id: "epic",
    emoji: "💥",
    getLabel: (cat) => {
      if (cat === "movie") return "Мощный экшен";
      if (cat === "series") return "Эпичный экшен";
      return "Мощный экшен / Сёнен";
    },
    getDescription: (cat) => {
      if (cat === "movie") return "Фантастика, фэнтези и масштабные боевики с крутыми битвами.";
      if (cat === "series") return "Зрелищные фантастические миры, битвы и приключения.";
      return "Эпичные сражения, превозмогания героев и захватывающие приключения.";
    }
  },
  {
    id: "romance",
    emoji: "💕",
    getLabel: (cat) => {
      if (cat === "movie") return "Романтика";
      if (cat === "series") return "Романтика";
      return "Романтика / Сёдзё";
    },
    getDescription: (cat) => {
      if (cat === "movie") return "Красивые истории любви, теплые чувства и душевные мелодрамы.";
      if (cat === "series") return "Сериалы про любовь, сложные взаимоотношения и искреннюю дружбу.";
      return "Трогательное романтическое аниме о первой любви и нежных чувствах.";
    }
  },
  {
    id: "horror",
    emoji: "👻",
    getLabel: (cat) => {
      if (cat === "movie") return "Жутко интересно";
      if (cat === "series") return "Мистика / Хоррор";
      return "Мрачное аниме / Триллер";
    },
    getDescription: (cat) => {
      if (cat === "movie") return "Триллер, мистика и ужасы для любителей пощекотать нервы.";
      if (cat === "series") return "Остросюжетные триллеры, паранормальные явления и хорроры.";
      return "Мрачные тайны, выживание, темное фэнтези и леденящие кровь триллеры.";
    }
  },
  {
    id: "drama",
    emoji: "😭",
    getLabel: (cat) => {
      if (cat === "movie") return "Слезовыжималка";
      if (cat === "series") return "Драматичные судьбы";
      return "Драма / До слез";
    },
    getDescription: (cat) => {
      if (cat === "movie") return "Сильные эмоциональные картины, трогающие до самой глубины души.";
      if (cat === "series") return "Семейные трагедии, преодоление трудностей и искренние слезы.";
      return "Шедевры, которые заставят вас сопереживать героям и пустить слезу.";
    }
  }
];

const getMoodCategory = (movie) => {
  const genres = (movie.genres || "").toLowerCase();
  const desc = (movie.description || "").toLowerCase();
  const type = movie.type || "movie";

  // 1. РОМАНТИКА (Romance)
  if (genres.includes("мелодрама") || genres.includes("романтика") || genres.includes("любовь")) {
    return "romance";
  }

  // 2. ЖУТКО ИНТЕРЕСНО (Thriller/Mystery/Horror)
  if (genres.includes("ужасы") || genres.includes("хоррор") || genres.includes("мистика") || (genres.includes("триллер") && (genres.includes("детектив") || genres.includes("криминал") || desc.includes("таинственн") || desc.includes("убийц")))) {
    return "horror";
  }

  // 3. УМНЫЙ СЮЖЕТ (Smart)
  if (genres.includes("детектив") || genres.includes("криминал") || genres.includes("биография") || genres.includes("история") || (genres.includes("драма") && !genres.includes("комедия") && !genres.includes("боевик"))) {
    if (type === "anime" && (genres.includes("драма") || desc.includes("тяжел") || desc.includes("судьб"))) {
      return "drama"; // "До слез"
    }
    return "smart";
  }

  // 4. ДО СЛЕЗ / ДРАМА (Tear-jerker)
  if (genres.includes("драма") && (genres.includes("семейный") || desc.includes("потер") || desc.includes("трагед") || desc.includes("слез") || desc.includes("судьб"))) {
    return "drama";
  }

  // 5. МОЩНЫЙ ЭКШЕН (Action/Epic)
  if (genres.includes("боевик") || genres.includes("военный") || genres.includes("фантастика") || genres.includes("фэнтези") || (type === "anime" && (genres.includes("приключения") || genres.includes("боевые искусства")))) {
    return "epic";
  }

  // 6. РАССЛАБИТЬСЯ (Chill/Comedy)
  if (genres.includes("комедия") || genres.includes("семейный") || genres.includes("детский") || genres.includes("мюзикл") || genres.includes("приключения")) {
    return "chill";
  }

  // Фолбэк по умолчанию на основе ID фильма
  const defaultMoods = ["chill", "smart", "epic", "romance", "horror", "drama"];
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
            <div className="mood-label">{mood.getLabel(activeCategory)}</div>
          </button>
        ))}
      </div>

      {selectedMood && (
        <div className="mood-results glass-panel" style={{ marginTop: "24px" }}>
          <h3 className="mood-results-title">
            {selectedMoodData?.emoji} {selectedMoodData?.getLabel(activeCategory)}
          </h3>
          <p className="mood-description-sub" style={{ color: "var(--text-sub)", fontSize: "0.95rem", marginTop: "-5px", marginBottom: "20px", fontStyle: "italic" }}>
            {selectedMoodData?.getDescription(activeCategory)}
          </p>
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
