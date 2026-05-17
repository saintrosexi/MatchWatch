import { useMemo } from "react";
import { movies } from "../data";

export default function TasteProfile({ likedMovies = [] }) {
  const profile = useMemo(() => {
    if (!likedMovies || likedMovies.length === 0) {
      return {
        totalMovies: 0,
        avgRating: 0,
        decades: [],
        topYears: [],
        topDirectors: [],
        compatibility: 0
      };
    }

    // Calculate statistics
    const totalMovies = likedMovies.length;
    const avgRating =
      likedMovies.reduce((sum, m) => sum + m.rating, 0) / totalMovies;

    // Group by decades
    const decades = {};
    likedMovies.forEach(movie => {
      const decade = Math.floor(movie.year / 10) * 10;
      decades[decade] = (decades[decade] || 0) + 1;
    });

    const topDecades = Object.entries(decades)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([decade, count]) => ({
        decade: `${decade}s`,
        count,
        percentage: Math.round((count / totalMovies) * 100)
      }));

    // Group by year
    const topYears = [...new Set(likedMovies.map(m => m.year))]
      .sort((a, b) => {
        const countA = likedMovies.filter(m => m.year === a).length;
        const countB = likedMovies.filter(m => m.year === b).length;
        return countB - countA;
      })
      .slice(0, 3)
      .map(year => ({
        year,
        count: likedMovies.filter(m => m.year === year).length
      }));

    // Top directors
    const directors = {};
    likedMovies.forEach(movie => {
      if (movie.director && movie.director.trim() !== "") {
        directors[movie.director] = (directors[movie.director] || 0) + 1;
      }
    });

    const topDirectors = Object.entries(directors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([director, count]) => ({ director, count }));

    return {
      totalMovies,
      avgRating: avgRating.toFixed(1),
      topDecades,
      topYears,
      topDirectors,
      compatibility: Math.round(Math.min(100, 30 + totalMovies * 3))
    };
  }, [likedMovies]);

  if (!likedMovies || likedMovies.length === 0) {
    return (
      <div className="taste-profile-container">
        <div className="empty-profile">
          <p>😴 Вы пока ничего не посмотрели</p>
          <p>Начните свайпить, чтобы создать ваш профиль вкуса!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="taste-profile-container">
      <h2 className="profile-title">👤 Ваш профиль вкуса</h2>

      {/* Overview Stats */}
      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-value">{profile.totalMovies}</div>
          <div className="stat-label">Просмотрено</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{profile.avgRating}</div>
          <div className="stat-label">Средний рейтинг</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{profile.compatibility}%</div>
          <div className="stat-label">Определённость вкуса</div>
        </div>
      </div>

      {/* Top Decades */}
      {profile.topDecades.length > 0 && (
        <div className="profile-section">
          <h3 className="section-title">📅 Любимые десятилетия</h3>
          <div className="timeline">
            {profile.topDecades.map((decade, index) => (
              <div key={index} className="timeline-item">
                <div className="timeline-label">{decade.decade}</div>
                <div className="timeline-bar-container">
                  <div
                    className="timeline-bar"
                    style={{
                      width: `${decade.percentage}%`,
                      background: `linear-gradient(90deg, #ff6b6b, #ff8a50)`
                    }}
                  />
                </div>
                <div className="timeline-count">
                  {decade.count} ({decade.percentage}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Years */}
      {profile.topYears.length > 0 && (
        <div className="profile-section">
          <h3 className="section-title">🎬 Топ годов</h3>
          <div className="years-list">
            {profile.topYears.map((year, index) => (
              <div key={index} className="year-item">
                <span className="year-number">{year.year}</span>
                <span className="year-count">({year.count} фильм)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Directors */}
      {profile.topDirectors.length > 0 && (
        <div className="profile-section">
          <h3 className="section-title">👨‍🎬 Любимые режиссёры</h3>
          <div className="directors-list">
            {profile.topDirectors.map((dir, index) => (
              <div key={index} className="director-item">
                <span className="director-rank">#{index + 1}</span>
                <span className="director-name">{dir.director}</span>
                <span className="director-count">{dir.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="profile-insights">
        <p>💡 <strong>Вывод:</strong></p>
        <p>
          Вы предпочитаете контент 
          {profile.topDecades.length > 0 && ` из ${profile.topDecades[0].decade.toLowerCase()}`}
          {profile.avgRating >= 8.5 && ' с высоким рейтингом'}
          {profile.avgRating < 7.5 && ' разнообразных рейтингов'}
          . Ваш вкус 
          {profile.compatibility > 80 && 'очень определён!'}
          {profile.compatibility > 50 && 'хорошо сформирован.'}
          {profile.compatibility <= 50 && 'только развивается!'}
        </p>
      </div>
    </div>
  );
}
