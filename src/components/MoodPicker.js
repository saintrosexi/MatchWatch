import { useState, useMemo } from "react";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";
import { getMovieVibeVector, getMovieVibeBadge } from "../recommendations";

const SENSATIONAL_MOODS = [
  {
    id: "chill",
    emoji: "🍿",
    label: "Уютный & Легкий",
    badgeColor: "#32d74b",
    description: "Фильмы с высоким уровнем позитивной энергии и низкой мрачностью. Идеально для отдыха.",
    targetVector: { energy: 7, darkness: 2, intellect: 4, emotion: 6, dynamism: 5 }
  },
  {
    id: "smart",
    emoji: "🧠",
    label: "На подумать",
    badgeColor: "#af52de",
    description: "Картины с высоким коэффициентом интеллекта, закрученным сюжетом и загадками.",
    targetVector: { energy: 4, darkness: 5, intellect: 9, emotion: 6, dynamism: 4 }
  },
  {
    id: "dynamism",
    emoji: "🔥",
    label: "Экшен & Драйв",
    badgeColor: "#ff5e62",
    description: "Максимальный уровень динамизма и взрывной энергии. Захватывает с первых секунд.",
    targetVector: { energy: 9, darkness: 4, intellect: 4, emotion: 4, dynamism: 9 }
  },
  {
    id: "darkness",
    emoji: "🌙",
    label: "Мрачная атмосфера",
    badgeColor: "#8e8e93",
    description: "Густая, таинственная атмосфера, хорроры, мистика и психологический напряг.",
    targetVector: { energy: 5, darkness: 9, intellect: 6, emotion: 5, dynamism: 6 }
  },
  {
    id: "emotion",
    emoji: "💔",
    label: "Эмоциональный шторм",
    badgeColor: "#ff2d55",
    description: "Глубокие чувства, романтика и драмы, заставляющие сопереживать героям до слез.",
    targetVector: { energy: 5, darkness: 3, intellect: 5, emotion: 9, dynamism: 3 }
  },
  {
    id: "energy",
    emoji: "⚡",
    label: "Заряд энергии",
    badgeColor: "#ff9966",
    description: "Мотивирующие, вдохновляющие истории для поднятия духа и бодрости.",
    targetVector: { energy: 9, darkness: 2, intellect: 5, emotion: 7, dynamism: 7 }
  }
];

export default function MoodPicker({ decisions, onToggleLike, favorites, onToggleFavorite, ratings, onSetRating }) {
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeCategory, setActiveCategory] = useState("movie");

  const selectedMoodData = SENSATIONAL_MOODS.find(m => m.id === selectedMood);

  const filteredMovies = useMemo(() => {
    if (!selectedMoodData) return [];

    const categoryMovies = movies.filter(m => (m.type || "movie") === activeCategory);
    const target = selectedMoodData.targetVector;

    // Rank movies by Euclidean proximity to the mood target vector
    return categoryMovies.map(movie => {
      const v = getMovieVibeVector(movie);
      const dist = Math.sqrt(
        Math.pow(v.energy - target.energy, 2) +
        Math.pow(v.darkness - target.darkness, 2) +
        Math.pow(v.intellect - target.intellect, 2) +
        Math.pow(v.emotion - target.emotion, 2) +
        Math.pow(v.dynamism - target.dynamism, 2)
      );

      const vibeMatch = Math.max(60, Math.min(99, Math.round(100 - dist * 2.5)));
      return { movie, vibeMatch };
    })
    .sort((a, b) => b.vibeMatch - a.vibeMatch)
    .slice(0, 30);
  }, [selectedMoodData, activeCategory]);

  const getCategoryLabel = () => {
    if (activeCategory === 'movie') return 'фильмов';
    if (activeCategory === 'series') return 'сериалов';
    return 'аниме';
  };

  return (
    <div className="mood-picker-container" style={{ maxWidth: "800px", margin: "0 auto", padding: "10px 15px 100px 15px" }}>
      <h2 className="page-title" style={{ textAlign: "center", fontSize: "1.8rem", marginBottom: "6px" }}>🎨 Сенсорный Поиск по Настроению</h2>
      <p className="mood-subtitle" style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "0.95rem", marginBottom: "20px" }}>
        Подбор под твое состояние по 5D-вектору атмосферы (Энергия, Тьма, Интеллект, Эмоции, Драйв)
      </p>

      <div className="category-picker" style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "24px" }}>
        <button 
          className={`category-btn ${activeCategory === 'movie' ? 'active' : ''}`}
          onClick={() => setActiveCategory('movie')}
        >
          Фильмы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'series' ? 'active' : ''}`}
          onClick={() => setActiveCategory('series')}
        >
          Сериалы
        </button>
        <button 
          className={`category-btn ${activeCategory === 'anime' ? 'active' : ''}`}
          onClick={() => setActiveCategory('anime')}
        >
          Аниме
        </button>
      </div>

      <div className="moods-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
        {SENSATIONAL_MOODS.map(mood => {
          const isActive = selectedMood === mood.id;
          return (
            <button
              key={mood.id}
              className={`mood-card ${isActive ? "active" : ""}`}
              onClick={() => setSelectedMood(mood.id)}
              style={{
                background: isActive ? `linear-gradient(135deg, ${mood.badgeColor}33, rgba(255,255,255,0.08))` : "rgba(255,255,255,0.04)",
                border: isActive ? `2px solid ${mood.badgeColor}` : "1px solid rgba(255,255,255,0.08)",
                borderRadius: "18px",
                padding: "16px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.25s ease",
                boxShadow: isActive ? `0 8px 25px ${mood.badgeColor}40` : "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "1.8rem" }}>{mood.emoji}</span>
                <span style={{ fontSize: "1.05rem", fontWeight: "bold", color: isActive ? mood.badgeColor : "#fff" }}>
                  {mood.label}
                </span>
              </div>
              <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: "1.35" }}>
                {mood.description}
              </p>
            </button>
          );
        })}
      </div>

      {selectedMoodData && (
        <div className="mood-results glass-panel" style={{ marginTop: "30px", background: "rgba(0,0,0,0.4)", borderRadius: "24px", padding: "20px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 className="mood-results-title" style={{ margin: 0, fontSize: "1.3rem", color: selectedMoodData.badgeColor }}>
              {selectedMoodData.emoji} {selectedMoodData.label}
            </h3>
            <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
              Найдено <strong>{filteredMovies.length}</strong> {getCategoryLabel()}
            </span>
          </div>

          <div className="mood-movies-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "14px" }}>
            {filteredMovies.map(({ movie, vibeMatch }) => {
              const badge = getMovieVibeBadge(movie);
              return (
                <div
                  key={movie.id}
                  className="mood-movie-card"
                  onClick={() => setSelectedMovie(movie)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "14px",
                    overflow: "hidden",
                    cursor: "pointer",
                    border: "1px solid rgba(255,255,255,0.08)",
                    transition: "transform 0.2s, boxShadow 0.2s"
                  }}
                >
                  <div className="mood-movie-poster-container" style={{ position: "relative", height: "180px" }}>
                    <img
                      src={movie.poster}
                      alt={movie.titleRu || movie.title}
                      className="mood-movie-poster"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", padding: "3px 7px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "bold", color: "#32d74b" }}>
                      {vibeMatch}%
                    </div>
                  </div>
                  <div className="mood-movie-info" style={{ padding: "10px" }}>
                    <div style={{ fontSize: "0.7rem", color: badge.color, fontWeight: "bold", marginBottom: "4px" }}>
                      {badge.label}
                    </div>
                    <h4 className="mood-movie-title" style={{ margin: "0 0 4px 0", fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {movie.titleRu || movie.title}
                    </h4>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                      <span>⭐ {movie.rating}</span>
                      <span>{movie.year}</span>
                    </div>
                  </div>
                </div>
              );
            })}
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

