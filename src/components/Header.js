import { useState } from "react";

export default function Header({ currentScreen, onTabClick, likedCount, friendRequestsCount = 0, invitesCount = 0, rightContent }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const getScreenName = (screen) => {
    switch(screen) {
      case "swipe": return "Выбрать фильм";
      case "mood": return "По настроению";
      case "search": return "Поиск";
      case "top": return "Топ фильмов";
      case "liked": return "Любимые";
      case "friends": return "Друзья";
      case "profile": return "Аккаунт";
      case "matchwatch": return "MatchWatch";
      case "publicProfile": return "Профиль";
      default: return "";
    }
  };

  const handleTabClick = (tab) => {
    onTabClick(tab);
    setMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <button className="mobile-menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? "✕" : "☰"}
          </button>
          
          <div className="header-logo" onClick={() => handleTabClick("swipe")}>
            <img src="/logo.png" alt="MatchWatch Logo" className="logo-img" />
          </div>

          {/* Desktop Undo Button */}
          {rightContent && (
            <div className="desktop-only" style={{ marginLeft: "10px" }}>
              {rightContent}
            </div>
          )}
        </div>

        {/* Desktop MatchWatch Tab */}
        <div className="header-center desktop-only">
          <button 
            className={`nav-tab tab-matchwatch ${currentScreen === "matchwatch" ? "active" : ""}`}
            onClick={() => handleTabClick("matchwatch")}
            style={{ position: 'relative' }}
          >
            🍿 MatchWatch
            {invitesCount > 0 && <span className="nav-badge">{invitesCount}</span>}
          </button>
        </div>

        {/* Mobile active tab name or custom content */}
        <div className="mobile-only active-tab-name">
          {rightContent ? rightContent : getScreenName(currentScreen)}
        </div>

        <ul className={`nav-tabs ${menuOpen ? "open" : ""}`}>
          <li className="mobile-only menu-header">Меню</li>
          <li className="mobile-only">
            <button 
              className={`nav-tab tab-matchwatch-mobile ${currentScreen === "matchwatch" ? "active" : ""}`}
              onClick={() => handleTabClick("matchwatch")}
            >
              🍿 MatchWatch {invitesCount > 0 && <span className="nav-badge">{invitesCount}</span>}
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "swipe" ? "active" : ""}`}
              onClick={() => handleTabClick("swipe")}
            >
              🎬 Выбрать фильм
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "mood" ? "active" : ""}`}
              onClick={() => handleTabClick("mood")}
            >
              🎲 По настроению
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "search" ? "active" : ""}`}
              onClick={() => handleTabClick("search")}
            >
              🔍 Поиск
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "top" ? "active" : ""}`}
              onClick={() => handleTabClick("top")}
            >
              ⭐ Топ фильмов
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "liked" ? "active" : ""}`}
              onClick={() => handleTabClick("liked")}
            >
              ❤️ Любимые ({likedCount})
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "friends" ? "active" : ""}`}
              onClick={() => handleTabClick("friends")}
              style={{ position: 'relative' }}
            >
              👥 Друзья
              {friendRequestsCount > 0 && <span className="nav-badge">{friendRequestsCount}</span>}
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "profile" ? "active" : ""}`}
              onClick={() => handleTabClick("profile")}
            >
              👤 Аккаунт
            </button>
          </li>
        </ul>
      </div>
      
      {/* Overlay for mobile menu */}
      {menuOpen && <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}></div>}
    </header>
  );
}
