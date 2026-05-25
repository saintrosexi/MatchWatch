import React from "react";

export default function Sidebar({
  currentScreen,
  onTabClick,
  likedCount,
  friendRequestsCount = 0,
  invitesCount = 0,
  user,
  currentUserAvatar = "😎",
  sidebarCollapsed,
  setSidebarCollapsed
}) {
  const getScreenName = (screen) => {
    switch(screen) {
      case "swipe": return "Выбрать фильм";
      case "mood": return "По настроению";
      case "search": return "Поиск";
      case "top": return "Топ фильмов";
      case "liked": return `Любимые`;
      case "friends": return "Друзья";
      case "profile": return "Аккаунт";
      case "matchwatch": return "MatchWatch";
      case "settings": return "Параметры";
      default: return "";
    }
  };

  const handleTabClick = (tab) => {
    if (onTabClick) {
      onTabClick(tab);
    }
  };

  const namePart = user && user.displayName ? user.displayName.split('#')[0] : "Гость";
  const tagPart = user && user.displayName && user.displayName.includes('#') ? '#' + user.displayName.split('#')[1] : "";

  return (
    <nav className={`sidebar-layout ${sidebarCollapsed ? "collapsed" : ""}`}>
      {/* Sidebar Header: Logo & Collapse Button */}
      <div className="sidebar-header">
        <div className="sidebar-logo-container" onClick={() => handleTabClick("swipe")}>
          <img 
            src={sidebarCollapsed ? "/logo-icon.png" : "/logo.png"} 
            alt="MatchWatch Logo" 
            className="sidebar-logo-img" 
          />
        </div>
        <button 
          className="sidebar-toggle-btn" 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          {sidebarCollapsed ? "»" : "«"}
        </button>
      </div>

      {/* Sidebar Menu - Upper Part */}
      <ul className="sidebar-menu-list upper-menu">
        <li 
          className={currentScreen === "swipe" ? "active" : ""} 
          onClick={() => handleTabClick("swipe")}
          title={sidebarCollapsed ? getScreenName("swipe") : ""}
        >
          <span className="sidebar-menu-icon">🎬</span>
          {!sidebarCollapsed && <span className="sidebar-menu-label">Выбрать фильм</span>}
        </li>

        <li 
          className={currentScreen === "matchwatch" ? "active" : ""} 
          onClick={() => handleTabClick("matchwatch")}
          title={sidebarCollapsed ? getScreenName("matchwatch") : ""}
          style={{ position: 'relative' }}
        >
          <span className="sidebar-menu-icon">🍿</span>
          {!sidebarCollapsed && <span className="sidebar-menu-label">MatchWatch</span>}
          {invitesCount > 0 && <span className="sidebar-badge">{invitesCount}</span>}
        </li>

        <li 
          className={currentScreen === "mood" ? "active" : ""} 
          onClick={() => handleTabClick("mood")}
          title={sidebarCollapsed ? getScreenName("mood") : ""}
        >
          <span className="sidebar-menu-icon">🎲</span>
          {!sidebarCollapsed && <span className="sidebar-menu-label">По настроению</span>}
        </li>

        <li 
          className={currentScreen === "search" ? "active" : ""} 
          onClick={() => handleTabClick("search")}
          title={sidebarCollapsed ? getScreenName("search") : ""}
        >
          <span className="sidebar-menu-icon">🔍</span>
          {!sidebarCollapsed && <span className="sidebar-menu-label">Поиск</span>}
        </li>

        <li 
          className={currentScreen === "top" ? "active" : ""} 
          onClick={() => handleTabClick("top")}
          title={sidebarCollapsed ? getScreenName("top") : ""}
        >
          <span className="sidebar-menu-icon">⭐</span>
          {!sidebarCollapsed && <span className="sidebar-menu-label">Топ фильмов</span>}
        </li>

        <li 
          className={currentScreen === "liked" ? "active" : ""} 
          onClick={() => handleTabClick("liked")}
          title={sidebarCollapsed ? `${getScreenName("liked")} (${likedCount})` : ""}
          style={{ position: 'relative' }}
        >
          <span className="sidebar-menu-icon">❤️</span>
          {!sidebarCollapsed && <span className="sidebar-menu-label">Любимые ({likedCount})</span>}
        </li>
      
        <li 
          className={currentScreen === "popularActors" ? "active" : ""} 
          onClick={() => handleTabClick("popularActors")} 
          title={sidebarCollapsed ? "Популярные актеры" : ""}
          style={{ position: 'relative' }}
        >
          <span className="sidebar-menu-icon">⭐</span>
          {!sidebarCollapsed && <span className="sidebar-menu-label">Популярные актеры</span>}
        </li>
      </ul>

      {/* Sidebar Menu - Lower Part (Friends, Account/Avatar, Settings) */}
      <ul className="sidebar-menu-list lower-menu">
        <li 
          className={currentScreen === "friends" ? "active" : ""} 
          onClick={() => handleTabClick("friends")}
          title={sidebarCollapsed ? getScreenName("friends") : ""}
          style={{ position: 'relative' }}
        >
          <span className="sidebar-menu-icon">👥</span>
          {!sidebarCollapsed && <span className="sidebar-menu-label">Друзья</span>}
          {friendRequestsCount > 0 && <span className="sidebar-badge">{friendRequestsCount}</span>}
        </li>

        {/* User Account / Profile Section */}
        <li 
          className={`sidebar-user-section ${currentScreen === "profile" ? "active" : ""}`}
          onClick={() => handleTabClick("profile")}
          title={sidebarCollapsed ? `${namePart}${tagPart}` : ""}
        >
          <div className="sidebar-user-avatar-wrapper">
            {currentUserAvatar && (currentUserAvatar.startsWith("data:image/") || currentUserAvatar.startsWith("http")) ? (
              <img src={currentUserAvatar} alt="User Avatar" className="sidebar-user-avatar-img" />
            ) : (
              <div className="sidebar-user-avatar-emoji">{currentUserAvatar || "😎"}</div>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{namePart}</span>
              <span className="sidebar-user-tag">{tagPart}</span>
            </div>
          )}
        </li>

        <li 
          className={currentScreen === "settings" ? "active" : ""} 
          onClick={() => handleTabClick("settings")}
          title={sidebarCollapsed ? getScreenName("settings") : ""}
        >
          <span className="sidebar-menu-icon">⚙️</span>
          {!sidebarCollapsed && <span className="sidebar-menu-label">Параметры</span>}
        </li>
      </ul>
    </nav>
  );
}
