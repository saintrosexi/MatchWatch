import { useState, useEffect } from "react";

export default function Header({ currentScreen, onTabClick, likedCount, friendRequestsCount = 0, invitesCount = 0, rightContent }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    <>
      <header className="header">
        <div className="header-content">
          {/* Desktop Left */}
          {!isMobile && (
            <div className="header-left">
              <div 
                className="header-logo" 
                onClick={() => handleTabClick("swipe")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTabClick("swipe");
                  }
                }}
              >
                <img src="/logo.png" alt="MatchWatch Logo" className="logo-img" />
              </div>
            </div>
          )}

          {/* Desktop Center */}
          {!isMobile && (
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
          )}

          {/* Mobile Top Header (iOS style) */}
          {isMobile && (
            <div className="mobile-header-top">
              <div className="mobile-header-left">
                {rightContent}
              </div>
              <div className="mobile-header-title">
                {currentScreen === "swipe" ? (
                  <img src="/logo.png" alt="MatchWatch Logo" style={{ height: "24px" }} />
                ) : (
                  getScreenName(currentScreen)
                )}
              </div>
              <div className="mobile-header-right">
                {/* Empty for balance */}
              </div>
            </div>
          )}

          {/* Desktop Right Nav Tabs */}
          {!isMobile && (
            <ul className="nav-tabs desktop-only">
              <li>
                <button className={`nav-tab ${currentScreen === "swipe" ? "active" : ""}`} onClick={() => handleTabClick("swipe")}>🎬 Выбрать фильм</button>
              </li>
              <li>
                <button className={`nav-tab ${currentScreen === "mood" ? "active" : ""}`} onClick={() => handleTabClick("mood")}>🎲 По настроению</button>
              </li>
              <li>
                <button className={`nav-tab ${currentScreen === "search" ? "active" : ""}`} onClick={() => handleTabClick("search")}>🔍 Поиск</button>
              </li>
              <li>
                <button className={`nav-tab ${currentScreen === "top" ? "active" : ""}`} onClick={() => handleTabClick("top")}>⭐ Топ фильмов</button>
              </li>
              <li>
                <button className={`nav-tab ${currentScreen === "liked" ? "active" : ""}`} onClick={() => handleTabClick("liked")}>❤️ Любимые ({likedCount})</button>
              </li>
              <li>
                <button className={`nav-tab ${currentScreen === "friends" ? "active" : ""}`} onClick={() => handleTabClick("friends")} style={{ position: 'relative' }}>
                  👥 Друзья
                  {friendRequestsCount > 0 && <span className="nav-badge">{friendRequestsCount}</span>}
                </button>
              </li>
              <li>
                <button className={`nav-tab ${currentScreen === "profile" ? "active" : ""}`} onClick={() => handleTabClick("profile")}>👤 Аккаунт</button>
              </li>
            </ul>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="mobile-bottom-nav">
          <button className={`bottom-nav-item ${currentScreen === "swipe" ? "active" : ""}`} onClick={() => handleTabClick("swipe")}>
            <span className="bottom-nav-icon">🎬</span>
            <span className="bottom-nav-label">Выбор</span>
          </button>
          <button className={`bottom-nav-item ${currentScreen === "matchwatch" ? "active" : ""}`} onClick={() => handleTabClick("matchwatch")} style={{ position: 'relative' }}>
            <span className="bottom-nav-icon">🍿</span>
            <span className="bottom-nav-label">Match</span>
            {invitesCount > 0 && <span className="nav-badge-bottom">{invitesCount}</span>}
          </button>
          <button className={`bottom-nav-item ${currentScreen === "search" ? "active" : ""}`} onClick={() => handleTabClick("search")}>
            <span className="bottom-nav-icon">🔍</span>
            <span className="bottom-nav-label">Поиск</span>
          </button>
          <button className={`bottom-nav-item ${currentScreen === "liked" ? "active" : ""}`} onClick={() => handleTabClick("liked")}>
            <span className="bottom-nav-icon">❤️</span>
            <span className="bottom-nav-label">Любимые</span>
          </button>
          <button className={`bottom-nav-item ${menuOpen ? "active" : ""}`} onClick={() => setMenuOpen(true)} style={{ position: 'relative' }}>
            <span className="bottom-nav-icon">≡</span>
            <span className="bottom-nav-label">Ещё</span>
            {friendRequestsCount > 0 && <span className="nav-badge-bottom">{friendRequestsCount}</span>}
          </button>
        </div>
      )}

      {/* iOS style Bottom Sheet for Menu */}
      {isMobile && (
        <>
          <div className={`bottom-sheet-overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)}></div>
          <div className={`bottom-sheet ${menuOpen ? "open" : ""}`}>
            <div className="bottom-sheet-drag-handle"></div>
            <h3 className="bottom-sheet-title">Меню</h3>
            <div className="bottom-sheet-menu">
              <button className="bottom-sheet-item" onClick={() => handleTabClick("mood")}>
                <span className="sheet-icon">🎲</span> По настроению
              </button>
              <button className="bottom-sheet-item" onClick={() => handleTabClick("top")}>
                <span className="sheet-icon">⭐</span> Топ фильмов
              </button>
              <button className="bottom-sheet-item" onClick={() => handleTabClick("friends")}>
                <span className="sheet-icon">👥</span> Друзья
                {friendRequestsCount > 0 && <span className="sheet-badge">{friendRequestsCount}</span>}
              </button>
              <button className="bottom-sheet-item" onClick={() => handleTabClick("profile")}>
                <span className="sheet-icon">👤</span> Аккаунт
              </button>
            </div>
            <button className="bottom-sheet-cancel" onClick={() => setMenuOpen(false)}>Отмена</button>
          </div>
        </>
      )}
    </>
  );
}
