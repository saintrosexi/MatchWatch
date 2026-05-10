export default function Header({ currentScreen, onTabClick, likedCount }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-logo" onClick={() => onTabClick("swipe")}>
          <div className="logo-icon">🎬❤️</div>
          <div className="logo-text">
            <span className="logo-match">Match</span>
            <span className="logo-watch">Watch</span>
          </div>
        </div>

        <div className="header-center">
          <button
            className={`nav-tab tab-matchwatch ${currentScreen === "matchwatch" ? "active" : ""}`}
            onClick={() => onTabClick("matchwatch")}
          >
            💑 MatchWatch
          </button>
        </div>

        <ul className="nav-tabs">
          <li>
            <button
              className={`nav-tab ${currentScreen === "swipe" ? "active" : ""}`}
              onClick={() => onTabClick("swipe")}
            >
              🎬 Выбрать фильм
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "mood" ? "active" : ""}`}
              onClick={() => onTabClick("mood")}
            >
              🎲 По настроению
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "search" ? "active" : ""}`}
              onClick={() => onTabClick("search")}
            >
              🔍 Поиск
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "top" ? "active" : ""}`}
              onClick={() => onTabClick("top")}
            >
              ⭐ Топ фильмов
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "liked" ? "active" : ""}`}
              onClick={() => onTabClick("liked")}
            >
              ❤️ Любимые ({likedCount})
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "friends" ? "active" : ""}`}
              onClick={() => onTabClick("friends")}
            >
              👥 Друзья
            </button>
          </li>
          <li>
            <button
              className={`nav-tab ${currentScreen === "profile" ? "active" : ""}`}
              onClick={() => onTabClick("profile")}
            >
              👤 Аккаунт
            </button>
          </li>
        </ul>
      </div>
    </header>
  );
}
