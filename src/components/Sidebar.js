import React, { useState } from "react";
import { useTransparentImage, CHAMA_IMAGES } from "../chamaAssets";

export default function Sidebar({
  currentScreen,
  onTabClick,
  likedCount,
  friendRequestsCount = 0,
  invitesCount = 0,
  user,
  currentUserAvatar = "😎",
}) {
  const [showChamaTip, setShowChamaTip] = useState(false);
  const chamaTransparent = useTransparentImage(CHAMA_IMAGES.WAVING);

  const handleTabClick = (tab) => {
    if (onTabClick) {
      onTabClick(tab);
    }
  };

  const namePart = user && user.displayName ? user.displayName.split('#')[0] : "Гость";
  const tagPart = user && user.displayName && user.displayName.includes('#') ? '#' + user.displayName.split('#')[1] : "";

  return (
    <nav className="apple-side-rail">
      {/* Brand Icon */}
      <div 
        className="side-rail-brand" 
        onClick={() => handleTabClick("swipe")} 
        title="MatchWatch"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTabClick("swipe");
          }
        }}
      >
        <img src="/logo-icon.png" alt="MatchWatch" className="side-rail-logo" />
      </div>

      {/* Main Navigation Icons */}
      <div className="side-rail-menu">
        <button
          className={`side-rail-item ${currentScreen === "swipe" ? "active" : ""}`}
          onClick={() => handleTabClick("swipe")}
          data-tooltip="Выбрать фильм"
        >
          <span className="side-rail-icon">🎬</span>
        </button>

        <button
          className={`side-rail-item ${currentScreen === "matchwatch" ? "active" : ""}`}
          onClick={() => handleTabClick("matchwatch")}
          data-tooltip="MatchWatch (Вдвоём)"
        >
          <span className="side-rail-icon">🍿</span>
          {invitesCount > 0 && <span className="side-rail-badge">{invitesCount}</span>}
        </button>

        <button
          className={`side-rail-item ${currentScreen === "mood" ? "active" : ""}`}
          onClick={() => handleTabClick("mood")}
          data-tooltip="По настроению"
        >
          <span className="side-rail-icon">🎲</span>
        </button>

        <button
          className={`side-rail-item ${currentScreen === "search" ? "active" : ""}`}
          onClick={() => handleTabClick("search")}
          data-tooltip="Поиск"
        >
          <span className="side-rail-icon">🔍</span>
        </button>

        <button
          className={`side-rail-item ${currentScreen === "top" ? "active" : ""}`}
          onClick={() => handleTabClick("top")}
          data-tooltip="Топ фильмов"
        >
          <span className="side-rail-icon">⭐</span>
        </button>

        <button
          className={`side-rail-item ${currentScreen === "popularActors" ? "active" : ""}`}
          onClick={() => handleTabClick("popularActors")}
          data-tooltip="Актёры"
        >
          <span className="side-rail-icon">🌟</span>
        </button>

        <button
          className={`side-rail-item ${currentScreen === "liked" ? "active" : ""}`}
          onClick={() => handleTabClick("liked")}
          data-tooltip={`Любимые (${likedCount})`}
        >
          <span className="side-rail-icon">❤️</span>
          {likedCount > 0 && <span className="side-rail-count-tag">{likedCount}</span>}
        </button>
      </div>

      {/* Bottom Profile & Settings */}
      <div className="side-rail-footer">
        <div style={{ position: "relative" }}>
          <button
            className="side-rail-item chama-mini-helper"
            onClick={() => setShowChamaTip(!showChamaTip)}
            data-tooltip="Помощник Чама 🐾"
          >
            <img src={chamaTransparent} alt="Чама" style={{ width: 32, height: 32, objectFit: "contain", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }} />
          </button>
          {showChamaTip && (
            <div className="glass-panel" style={{ position: "absolute", left: "60px", bottom: "0px", width: "240px", padding: "12px", zIndex: 100, fontSize: "0.82rem" }}>
              <div style={{ fontWeight: "bold", color: "#fbbf24", marginBottom: "4px" }}>🐾 Совет от Чамы</div>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.85)" }}>
                Выбирай фильмы свайпами вправо или организуй совместный MatchWatch сеанс с другом!
              </p>
            </div>
          )}
        </div>

        <button
          className={`side-rail-item ${currentScreen === "friends" ? "active" : ""}`}
          onClick={() => handleTabClick("friends")}
          data-tooltip="Друзья"
        >
          <span className="side-rail-icon">👥</span>
          {friendRequestsCount > 0 && <span className="side-rail-badge">{friendRequestsCount}</span>}
        </button>

        <button
          className={`side-rail-user-avatar ${currentScreen === "profile" ? "active" : ""}`}
          onClick={() => handleTabClick("profile")}
          data-tooltip={`${namePart}${tagPart}`}
        >
          {currentUserAvatar && (currentUserAvatar.startsWith("data:image/") || currentUserAvatar.startsWith("http")) ? (
            <img src={currentUserAvatar} alt="User Avatar" className="avatar-img" />
          ) : (
            <span className="avatar-emoji">{currentUserAvatar || "😎"}</span>
          )}
        </button>

        <button
          className={`side-rail-item ${currentScreen === "settings" ? "active" : ""}`}
          onClick={() => handleTabClick("settings")}
          data-tooltip="Настройки"
        >
          <span className="side-rail-icon">⚙️</span>
        </button>
      </div>
    </nav>
  );
}
