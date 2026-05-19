import { useState, useEffect, useMemo } from "react";
import { movies } from "../data";
import { auth, database } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { motion } from "framer-motion";

export default function TasteProfile({ likedMovies = [], favorites = {}, ratings = {} }) {
  const [user, setUser] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!aiSummary) return;
    
    // Add call to action / invite text with verified link
    const inviteText = `${aiSummary}\n\n🔮 Узнай свой кинопортрет от киноэксперта Жорика и найди идеальный фильм для совместного просмотра с друзьями: https://match-watch-zeta.vercel.app/`;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteText);
      } else {
        // Fallback for older browsers / unsupported environments
        const textArea = document.createElement("textarea");
        textArea.value = inviteText;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      setError("Не удалось скопировать текст в буфер обмена.");
    }
  };

  useEffect(() => {
    if (!auth || !database) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load existing summary from Firebase
        const summaryRef = ref(database, `users/${currentUser.uid}/profile/aiTasteSummary`);
        onValue(summaryRef, (snap) => {
          setAiSummary(snap.val() || "");
        });
      } else {
        setAiSummary("");
      }
    });
    return () => unsubscribe();
  }, []);

  const generateAiSummary = async () => {
    if (!user) {
      setError("Войдите в аккаунт, чтобы запустить ИИ-анализ");
      return;
    }
    if (likedMovies.length === 0) {
      setError("У вас должно быть хотя бы несколько любимых фильмов для анализа.");
      return;
    }

    setLoading(true);
    setError("");

    // Enrich movies with user's personal ratings and favorite flags
    const enrichedMovies = likedMovies.map(m => ({
      ...m,
      personalRating: ratings?.[m.id] || null,
      isFavorite: !!favorites?.[m.id]
    }));

    try {
      const response = await fetch("/api/taste-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ likedMovies: enrichedMovies })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Не удалось сгенерировать ИИ-вывод.");
      }

      const data = await response.json();
      if (data.summary) {
        setAiSummary(data.summary);
        // Save to Firebase securely under /profile/aiTasteSummary
        await set(ref(database, `users/${user.uid}/profile/aiTasteSummary`), data.summary);
      } else {
        throw new Error("Не удалось получить ИИ-анализ.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Ошибка соединения с сервером кинокритики.");
    } finally {
      setLoading(false);
    }
  };

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

      {/* Insights (AI summary or basic fallback) */}
      {loading ? (
        <div className="profile-insights ai-loading-box">
          <div className="ai-pulse-loader" />
          <div className="ai-loading-text">🔮 Нейросеть сканирует ваши свайпы...</div>
        </div>
      ) : aiSummary ? (
        <motion.div
          className="profile-insights ai-summary-box"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="ai-summary-header">
            <div className="ai-summary-title">
              <span>✨ ИИ-Анализ киновкусов</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="btn-ai-share"
                onClick={handleShare}
                style={{
                  background: copied ? "rgba(46, 204, 113, 0.15)" : "rgba(138, 43, 226, 0.15)",
                  border: copied ? "1px solid rgba(46, 204, 113, 0.4)" : "1px solid rgba(138, 43, 226, 0.4)",
                  color: copied ? "#2ecc71" : "#cda4ff",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                {copied ? "✓ Скопировано!" : "🔗 Поделиться"}
              </button>
              {user && (
                <button
                  className="btn-ai-regenerate"
                  onClick={generateAiSummary}
                  title="Обновить ИИ-анализ"
                >
                  🔄
                </button>
              )}
            </div>
          </div>
          <div className="ai-summary-text" style={{ whiteSpace: "pre-line" }}>
            {aiSummary}
          </div>
          <div className="ai-summary-footer" style={{ marginTop: "20px", fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.35)", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "12px", flexWrap: "wrap", gap: "10px" }}>
            <span>🔮 Персональный кинопортрет составлен киноэкспертом - Жориком</span>
            <span style={{ background: "rgba(138, 43, 226, 0.15)", color: "#cda4ff", padding: "2px 8px", borderRadius: "10px", fontSize: "0.75rem", border: "1px solid rgba(138, 43, 226, 0.3)", fontWeight: "600" }}>✓ Индивидуальный расчет</span>
          </div>
          {error && <div className="ai-error-text">⚠️ {error}</div>}
        </motion.div>
      ) : (
        <div className="profile-insights">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
            <div style={{ flex: "1 1 300px" }}>
              <p>💡 <strong>Базовый вывод:</strong></p>
              <p style={{ margin: 0 }}>
                Вы предпочитаете контент 
                {profile.topDecades.length > 0 && ` из ${profile.topDecades[0].decade.toLowerCase()}`}
                {profile.avgRating >= 8.5 && " с высоким рейтингом"}
                {profile.avgRating < 7.5 && " разнообразных рейтингов"}
                . Ваш вкус 
                {profile.compatibility > 80 && " очень определён!"}
                {profile.compatibility > 50 && " хорошо сформирован."}
                {profile.compatibility <= 50 && " только развивается!"}
              </p>
            </div>
            {user && (
              <button className="btn-ai-generate" onClick={generateAiSummary}>
                ✨ Сгенерировать ИИ-вывод
              </button>
            )}
          </div>
          {error && <div className="ai-error-text">⚠️ {error}</div>}
        </div>
      )}
    </div>
  );
}
