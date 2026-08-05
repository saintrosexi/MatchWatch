import { useState, useMemo } from "react";
import { movies } from "../data";
import DetailedMovieModal from "./DetailedMovieModal";
import { getMovieVibeVector, getMovieVibeBadge } from "../recommendations";
import { getBestPosterUrl, fetchLivePosterFromApi } from "../posterResolver";

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
  const [selectedMood, setSelectedMood] = useState("chill");
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeCategory, setActiveCategory] = useState("movie");
  const [visibleCount, setVisibleCount] = useState(36);

  const selectedMoodData = SENSATIONAL_MOODS.find(m => m.id === selectedMood) || SENSATIONAL_MOODS[0];

  const allFilteredMovies = useMemo(() => {
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
    .sort((a, b) => b.vibeMatch - a.vibeMatch);
  }, [selectedMoodData, activeCategory]);

  const displayedMovies = useMemo(() => {
    return allFilteredMovies.slice(0, visibleCount);
  }, [allFilteredMovies, visibleCount]);

  const getCategoryLabel = () => {
    if (activeCategory === 'movie') return 'фильмов';
    if (activeCategory === 'series') return 'сериалов';
    return 'аниме';
  };

  return (
    <div className="mood-picker-container" style={{ maxWidth: "1000px", margin: "0 auto", padding: "10px 15px 120px 15px" }}>
      <h2 className="page-title" style={{ textAlign: "center", fontSize: "1.8rem", marginBottom: "6px" }}>🎨 Сенсорный Поиск по Настроению</h2>
      <p className="mood-subtitle" style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "0.95rem", marginBottom: "20px" }}>
        Подбор под твое состояние по 5D-вектору атмосферы (Энергия, Тьма, Интеллект, Эмоции, Драйв)
      </p>

      {/* Category Pills Header */}
      <div className="category-picker" style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "24px" }}>
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

      {/* Responsive Full-Width Mood Chips Grid */}
      <div 
        className="mood-chips-row" 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", 
          gap: "8px", 
          marginBottom: "20px",
          width: "100%"
        }}
      >
        {SENSATIONAL_MOODS.map(mood => {
          const isActive = selectedMood === mood.id;
          return (
            <button
              key={mood.id}
              onClick={() => setSelectedMood(mood.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "10px 8px",
                borderRadius: "24px",
                cursor: "pointer",
                background: isActive ? `linear-gradient(135deg, ${mood.badgeColor}40, rgba(255,255,255,0.12))` : "rgba(255,255,255,0.05)",
                border: isActive ? `2px solid ${mood.badgeColor}` : "1px solid rgba(255,255,255,0.1)",
                color: isActive ? "#fff" : "rgba(255,255,255,0.8)",
                fontSize: "0.85rem",
                fontWeight: isActive ? "bold" : "500",
                boxShadow: isActive ? `0 4px 18px ${mood.badgeColor}40` : "none",
                transition: "all 0.2s ease",
                textAlign: "center"
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{mood.emoji}</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mood.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Expanded Mood Banner */}
      <div 
        className="active-mood-expanded-card" 
        style={{ 
          background: `linear-gradient(135deg, ${selectedMoodData.badgeColor}22, rgba(0,0,0,0.6))`, 
          border: `1px solid ${selectedMoodData.badgeColor}66`, 
          borderRadius: "20px", 
          padding: "20px 24px", 
          marginBottom: "28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          backdropFilter: "blur(10px)"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "2rem" }}>{selectedMoodData.emoji}</span>
            <h3 style={{ margin: 0, fontSize: "1.4rem", color: selectedMoodData.badgeColor }}>
              {selectedMoodData.label}
            </h3>
          </div>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "0.95rem", lineHeight: "1.4" }}>
            {selectedMoodData.description}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", display: "block" }}>Всего</span>
          <strong style={{ fontSize: "1.2rem", color: "#fff" }}>{allFilteredMovies.length} {getCategoryLabel()}</strong>
        </div>
      </div>

      {/* Spacious Movies Grid with Responsive Posters and Clean Metadata */}
      <div 
        className="mood-movies-grid" 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", 
          gap: "18px" 
        }}
      >
        {displayedMovies.map(({ movie, vibeMatch }) => {
          const badge = getMovieVibeBadge(movie);
          const posterUrl = getBestPosterUrl(movie);

          return (
            <div
              key={movie.id}
              className="mood-movie-card"
              onClick={() => setSelectedMovie(movie)}
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: "16px",
                overflow: "hidden",
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.25s ease",
                boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
              }}
            >
              <div className="mood-movie-poster-container" style={{ position: "relative", width: "100%", paddingTop: "145%", background: "#111" }}>
                <img
                  src={posterUrl}
                  alt={movie.titleRu || movie.title}
                  className="mood-movie-poster"
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  onError={async (e) => {
                    const fallback = await fetchLivePosterFromApi(movie.titleRu || movie.title, movie.year);
                    if (fallback) e.target.src = fallback;
                  }}
                />
                <div style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", padding: "4px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "bold", color: "#32d74b", border: "1px solid rgba(50,215,75,0.3)" }}>
                  {vibeMatch}%
                </div>
              </div>
              
              <div className="mood-movie-info" style={{ padding: "12px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: badge.color, fontWeight: "bold", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {badge.label}
                  </div>
                  <h4 
                    className="mood-movie-title" 
                    style={{ 
                      margin: "0 0 6px 0", 
                      fontSize: "0.9rem", 
                      fontWeight: "bold", 
                      lineHeight: "1.25", 
                      display: "-webkit-box", 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: "vertical", 
                      overflow: "hidden" 
                    }}
                    title={movie.titleRu || movie.title}
                  >
                    {movie.titleRu || movie.title}
                  </h4>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>
                  <span>⭐ {movie.rating || 7.0}</span>
                  <span>{movie.year}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visibleCount < allFilteredMovies.length && (
        <div style={{ textAlign: "center", marginTop: "30px" }}>
          <button
            className="btn-primary"
            onClick={() => setVisibleCount(prev => prev + 36)}
            style={{ padding: "14px 28px", borderRadius: "30px", fontSize: "1rem" }}
          >
            Показать ещё фильмы ({allFilteredMovies.length - visibleCount})
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

