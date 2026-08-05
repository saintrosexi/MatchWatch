import { useState, useEffect, useMemo } from "react";
import { movies } from "../data";
import { auth, database } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { motion } from "framer-motion";
import { ChamaBackgroundArt } from "../chamaAssets";
import { SensationRadarComponent } from "./Profile";
import { generateSimpleTasteInference } from "../tasteInference";

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
      if (movie.director && movie.director.trim() !== "" && movie.director !== "N/A" && movie.director !== "—") {
        movie.director.split(", ").forEach(d => {
          directors[d] = (directors[d] || 0) + 1;
        });
      }
    });

    const topDirectors = Object.entries(directors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([director, count]) => ({ director, count }));

    // Top actors
    const actorsMap = {};
    likedMovies.forEach(movie => {
      if (movie.actors && movie.actors.trim() !== "" && movie.actors !== "N/A" && movie.actors !== "—") {
        movie.actors.split(", ").forEach(a => {
          actorsMap[a] = (actorsMap[a] || 0) + 1;
        });
      }
    });

    const topActors = Object.entries(actorsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([actor, count]) => ({ actor, count }));

    return {
      totalMovies,
      avgRating: avgRating.toFixed(1),
      topDecades,
      topYears,
      topDirectors,
      topActors,
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
    <div className="taste-profile-container relative overflow-hidden">
      <ChamaBackgroundArt type="WIZARD" opacity={0.06} />
      <h2 className="profile-title">👤 Ваш профиль вкуса</h2>

      {/* 5D Sensation Radar Vector Component */}
      <SensationRadarComponent likedMovies={likedMovies} favorites={favorites} />

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

      {/* Top Directors & Top Actors Compact Block */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", margin: "16px 0" }}>
        {/* Top Directors */}
        <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "5px" }}>
            👨‍🎬 Режиссёры
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {profile.topDirectors.length > 0 ? (
              profile.topDirectors.map((d, i) => (
                <div key={i} style={{ fontSize: "0.8rem", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80%" }}>
                    #{i + 1} {d.director}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#ff8a50", background: "rgba(255,138,80,0.15)", padding: "1px 6px", borderRadius: "6px" }}>
                    {d.count}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>—</span>
            )}
          </div>
        </div>

        {/* Top Actors */}
        <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "5px" }}>
            🎭 Актёры
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {profile.topActors && profile.topActors.length > 0 ? (
              profile.topActors.map((a, i) => (
                <div 
                  key={i} 
                  style={{ fontSize: "0.8rem", color: "#ff8a50", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onClick={() => window.dispatchEvent(new CustomEvent("show-actor-details", { detail: a.actor }))}
                  title="Нажмите, чтобы открыть профиль актера"
                >
                  <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80%", textDecoration: "underline dashed rgba(255,138,80,0.4)" }}>
                    #{i + 1} {a.actor}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#ff8a50", background: "rgba(255,138,80,0.15)", padding: "1px 6px", borderRadius: "6px" }}>
                    {a.count}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>—</span>
            )}
          </div>
        </div>
      </div>

      {/* Simple Taste Inference Output */}
      <div className="profile-insights" style={{ padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", marginTop: "12px" }}>
        <p style={{ margin: "0 0 8px 0", fontWeight: "600", fontSize: "0.95rem", color: "#fff" }}>💡 <strong>Простой вывод:</strong></p>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255,255,255,0.85)", lineHeight: "1.6" }}>
          {generateSimpleTasteInference({ likedMovies, favorites })}
        </p>
      </div>
    </div>
  );
}
