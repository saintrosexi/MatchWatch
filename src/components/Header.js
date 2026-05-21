import { useState, useEffect } from "react";

export default function Header({ 
  currentScreen, 
  onTabClick, 
  likedCount, 
  friendRequestsCount = 0, 
  invitesCount = 0, 
  rightContent, 
  onUndo, 
  history = [],
  isTabSwitcherOpen,
  setIsTabSwitcherOpen,
  tabHistory = [],
  goBackTab,
  changeScreen
}) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getScreenPath = (screen) => {
    switch(screen) {
      case "swipe": return "swipe";
      case "mood": return "mood";
      case "search": return "search";
      case "top": return "top-movies";
      case "liked": return "favorites";
      case "friends": return "friends";
      case "profile": return "profile";
      case "matchwatch": return "matchwatch-room";
      case "publicProfile": return "user-profile";
      case "settings": return "settings";
      case "final": return "final-screen";
      default: return "";
    }
  };

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
      case "settings": return "Параметры";
      default: return "Браузер";
    }
  };

  const handleTabClick = (tab) => {
    onTabClick(tab);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 2000);
  };

  const handleReload = () => {
    if (isReloading) return;
    setIsReloading(true);
    showToast("Страница обновлена");
    setTimeout(() => {
      setIsReloading(false);
    }, 600);
  };

  const copyAppAddress = () => {
    const link = `${window.location.origin}?ref=safari`;
    navigator.clipboard.writeText(link).then(() => {
      showToast("Ссылка скопирована!");
      setShareSheetOpen(false);
    });
  };

  // Back action in footer
  const canGoBack = currentScreen === "swipe" ? history.length > 0 : tabHistory.length > 1;
  const handleBackAction = () => {
    if (currentScreen === "swipe") {
      if (onUndo && history.length > 0) {
        onUndo();
      }
    } else {
      if (goBackTab) goBackTab();
    }
  };

  return (
    <>
      {toastMessage && <div className="safari-toast">{toastMessage}</div>}

      {/* 1. DESKTOP HEADER (Unchanged) */}
      {!isMobile && (
        <header className="header">
          <div className="header-content">
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
              <li>
                <button className={`nav-tab ${currentScreen === "settings" ? "active" : ""}`} onClick={() => handleTabClick("settings")}>⚙️ Параметры</button>
              </li>
            </ul>
          </div>
        </header>
      )}

      {/* 2. MOBILE iOS SAFARI HEADER (Address Bar) */}
      {isMobile && (
        <header className="mobile-safari-header">
          <div className="safari-header-left">
            <span className="safari-text-action">Aa</span>
          </div>
          
          <div className="safari-address-bar" onClick={() => onTabClick("search")}>
            <span className="safari-ssl-lock">🔒</span>
            <span className="safari-domain-text">
              matchwatch.app
              <span className="safari-path-text">/{getScreenPath(currentScreen)}</span>
            </span>
          </div>
          
          <div className="safari-header-right" onClick={handleReload}>
            <span className={`safari-reload-btn ${isReloading ? "spinning" : ""}`}>🔄</span>
          </div>
        </header>
      )}

      {/* 3. MOBILE iOS SAFARI FOOTER (Controls Bar) */}
      {isMobile && (
        <div className="mobile-safari-footer">
          {/* Back arrow */}
          <button 
            className="safari-footer-item"
            disabled={!canGoBack}
            onClick={handleBackAction}
            title={currentScreen === "swipe" ? "Отменить свайп" : "Назад"}
          >
            <span className="safari-footer-icon">◀</span>
          </button>

          {/* Forward arrow */}
          <button 
            className="safari-footer-item"
            disabled={true} // standard for simple single line web views
            onClick={() => {}}
          >
            <span className="safari-footer-icon">▶</span>
          </button>

          {/* Share/Actions icon */}
          <button 
            className="safari-footer-item"
            onClick={() => setShareSheetOpen(true)}
            title="Поделиться"
          >
            <span className="safari-footer-icon font-large">📤</span>
          </button>

          {/* Favorites Bookmark icon */}
          <button 
            className={`safari-footer-item ${currentScreen === "liked" ? "active" : ""}`}
            onClick={() => onTabClick("liked")}
            title="Закладки"
          >
            <span className="safari-footer-icon font-large">📖</span>
          </button>

          {/* Tab Switcher icon */}
          <button 
            className="safari-footer-item"
            onClick={() => setIsTabSwitcherOpen(true)}
            title="Вкладки"
            style={{ position: "relative" }}
          >
            <div className="safari-tab-icon">
              <span className="tab-count-badge">9</span>
            </div>
          </button>
        </div>
      )}

      {/* 4. iOS SHARE SHEET MODAL */}
      {isMobile && (
        <>
          <div 
            className={`share-sheet-overlay ${shareSheetOpen ? "open" : ""}`} 
            onClick={() => setShareSheetOpen(false)}
          />
          <div className={`share-sheet ${shareSheetOpen ? "open" : ""}`}>
            <div className="share-sheet-drag-handle"></div>
            
            <div className="share-sheet-meta">
              <div className="share-sheet-favicon">🍿</div>
              <div className="share-sheet-info">
                <h4>MatchWatch Web</h4>
                <p>matchwatch.app</p>
              </div>
            </div>

            <div className="share-sheet-grid-contacts">
              <div className="contact-item" onClick={() => showToast("Отправлено в Telegram (эмуляция)") || setShareSheetOpen(false)}>
                <div className="contact-icon tg">✈️</div>
                <span className="contact-label">Telegram</span>
              </div>
              <div className="contact-item" onClick={() => showToast("Отправлено в WhatsApp (эмуляция)") || setShareSheetOpen(false)}>
                <div className="contact-icon wa">💬</div>
                <span className="contact-label">WhatsApp</span>
              </div>
              <div className="contact-item" onClick={copyAppAddress}>
                <div className="contact-icon mail">✉️</div>
                <span className="contact-label">Почта</span>
              </div>
              <div className="contact-item" onClick={() => showToast("Открыто в Сообщениях (эмуляция)") || setShareSheetOpen(false)}>
                <div className="contact-icon msg">💬</div>
                <span className="contact-label">Сообщения</span>
              </div>
            </div>

            <div className="share-sheet-actions-list">
              <button className="share-sheet-action" onClick={copyAppAddress}>
                <span className="action-icon">🔗</span>
                <span className="action-text">Скопировать ссылку</span>
              </button>
              <button className="share-sheet-action" onClick={() => onTabClick("matchwatch") || setShareSheetOpen(false)}>
                <span className="action-icon">🍿</span>
                <span className="action-text">Пригласить в MatchWatch-комнату</span>
              </button>
              <button className="share-sheet-action" onClick={() => onTabClick("friends") || setShareSheetOpen(false)}>
                <span className="action-icon">👥</span>
                <span className="action-text">Добавить в друзья</span>
              </button>
              <button className="share-sheet-action" onClick={() => {
                setShareSheetOpen(false);
                // Trigger PWA Alert
                showToast("Используйте Поделиться > На экран Домой в Safari");
              }}>
                <span className="action-icon">📲</span>
                <span className="action-text">Установить на экран «Домой»</span>
              </button>
            </div>

            <button className="share-sheet-cancel" onClick={() => setShareSheetOpen(false)}>Отмена</button>
          </div>
        </>
      )}
    </>
  );
}
