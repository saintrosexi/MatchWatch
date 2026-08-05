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
      </div>
    </nav>
  );
}
