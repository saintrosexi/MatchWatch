import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Header({ currentScreen, onTabClick, likedCount, friendRequestsCount = 0, invitesCount = 0, rightContent, onUndo, history = [], matchWatchScreen = "start" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  const [navExpanded, setNavExpanded] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showPopcornToast, setShowPopcornToast] = useState(false);
  const expandTimeoutRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (expandTimeoutRef.current) {
        clearTimeout(expandTimeoutRef.current);
      }
    };
  }, []);

  const isSwipeScreen = currentScreen === "swipe" || (currentScreen === "matchwatch" && matchWatchScreen === "swiping");
  const showFullNav = !isSwipeScreen || navExpanded;

  const handleExpandClick = () => {
    if (!navExpanded) {
      setNavExpanded(true);
      if (expandTimeoutRef.current) {
        clearTimeout(expandTimeoutRef.current);
      }
      expandTimeoutRef.current = setTimeout(() => {
        setNavExpanded(false);
      }, 2000);
    } else {
      setMenuOpen(true);
      setNavExpanded(false);
      if (expandTimeoutRef.current) {
        clearTimeout(expandTimeoutRef.current);
      }
    }
  };

  const handleTabClickWithCollapse = (tab) => {
    handleTabClick(tab);
    setNavExpanded(false);
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
    }
  };

  const getScreenName = (screen) => {
    switch(screen) {
      case "swipe": return "Выбрать фильм";
      case "mood": return "По настроению";
      case "search": return "Поиск";
      case "top": return "Топ фильмов";
      case "popularActors": return "Лучшие актеры";
      case "liked": return "Любимые";
      case "friends": return "Друзья";
      case "profile": return "Аккаунт";
      case "matchwatch": return "MatchWatch";
      case "publicProfile": return "Профиль";
      case "settings": return "Параметры";
      default: return "";
    }
  };

  const handleTabClick = (tab) => {
    onTabClick(tab);
    setMenuOpen(false);
  };

  const menuItems = [
    { id: "mood", label: "По настроению", icon: "🎲" },
    { id: "top", label: "Топ фильмов", icon: "⭐" },
    { id: "popularActors", label: "Лучшие актеры", icon: "🌟" },
    { id: "friends", label: "Друзья", icon: "👥", badge: friendRequestsCount },
    { id: "profile", label: "Аккаунт", icon: "👤" },
    { id: "settings", label: "Параметры", icon: "⚙️" },
  ];

  return (
    <>
      {(!isMobile || currentScreen !== "swipe") && (
        <header className="header">
          <div className="header-content">
            {/* Desktop Left */}
            {!isMobile && (
              <div className="header-left">
                <div 
                  className="header-logo" 
                  onClick={() => {
                    handleTabClick("swipe");
                    setLogoClicks(prev => {
                      const next = prev + 1;
                      if (next >= 5) {
                        setShowPopcornToast(true);
                        setTimeout(() => setShowPopcornToast(false), 3000);
                        return 0;
                      }
                      return next;
                    });
                  }}
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
                {showPopcornToast && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{
                      position: "absolute",
                      top: "70px",
                      left: "20px",
                      background: "linear-gradient(135deg, #ff8a50 0%, #e91e63 100%)",
                      color: "#fff",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      boxShadow: "0 4px 15px rgba(233,30,99,0.4)",
                      zIndex: 9999,
                      pointerEvents: "none"
                    }}
                  >
                    🍿 Секретный режим супер-киномана!
                  </motion.div>
                )}
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
                    <img src="/logo.png" alt="MatchWatch Logo" style={{ height: "26px", filter: "drop-shadow(0 0 10px rgba(255,138,80,0.3))" }} />
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
                  <button className={`nav-tab ${currentScreen === "popularActors" ? "active" : ""}`} onClick={() => handleTabClick("popularActors")}>🌟 Актеры</button>
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
            )}
          </div>
        </header>
      )}

      {/* Mobile Bottom Navigation - Floating Premium Glass Capsule */}
      {isMobile && (
        <>
          {/* Full Navigation Capsule */}
          <div className={`mobile-bottom-nav ${isSwipeScreen && !navExpanded ? 'collapsed-hidden' : ''}`}>
            {/* Swipe Tab Button */}
            {currentScreen === "swipe" ? (
              <button 
                className="bottom-nav-item bottom-nav-item--undo" 
                onClick={() => {
                  onUndo?.();
                  setNavExpanded(false);
                  if (expandTimeoutRef.current) clearTimeout(expandTimeoutRef.current);
                }}
                style={{ 
                  opacity: (!history || history.length === 0) ? 0.35 : 1,
                  transform: (!history || history.length === 0) ? "none" : "scale(1)"
                }}
                disabled={!history || history.length === 0}
              >
                <span className="bottom-nav-icon">⏪</span>
                <span className="bottom-nav-label">Назад</span>
              </button>
            ) : (
              <button 
                className={`bottom-nav-item ${currentScreen === "swipe" ? "active" : ""}`} 
                onClick={() => handleTabClickWithCollapse("swipe")}
              >
                {currentScreen === "swipe" && (
                  <motion.div 
                    layoutId="mobileActiveTab" 
                    className="bottom-nav-item-bg"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="bottom-nav-icon">🎬</span>
                <span className="bottom-nav-label">Выбор</span>
              </button>
            )}

            {/* MatchWatch Tab Button */}
            <button 
              className={`bottom-nav-item ${currentScreen === "matchwatch" ? "active" : ""}`} 
              onClick={() => handleTabClickWithCollapse("matchwatch")}
            >
              {currentScreen === "matchwatch" && (
                <motion.div 
                  layoutId="mobileActiveTab" 
                  className="bottom-nav-item-bg"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="bottom-nav-icon">🍿</span>
              <span className="bottom-nav-label">Match</span>
              {invitesCount > 0 && <span className="nav-badge-bottom">{invitesCount}</span>}
            </button>

            {/* Search Tab Button */}
            <button 
              className={`bottom-nav-item ${currentScreen === "search" ? "active" : ""}`} 
              onClick={() => handleTabClickWithCollapse("search")}
            >
              {currentScreen === "search" && (
                <motion.div 
                  layoutId="mobileActiveTab" 
                  className="bottom-nav-item-bg"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="bottom-nav-icon">🔍</span>
              <span className="bottom-nav-label">Поиск</span>
            </button>

            {/* Liked Tab Button */}
            <button 
              className={`bottom-nav-item ${currentScreen === "liked" ? "active" : ""}`} 
              onClick={() => handleTabClickWithCollapse("liked")}
            >
              {currentScreen === "liked" && (
                <motion.div 
                  layoutId="mobileActiveTab" 
                  className="bottom-nav-item-bg"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="bottom-nav-icon">❤️</span>
              <span className="bottom-nav-label">Любимые</span>
            </button>

            {/* More Tab Button */}
            <button 
              className={`bottom-nav-item ${menuOpen ? "active" : ""}`} 
              onClick={handleExpandClick}
            >
              {menuOpen && (
                <motion.div 
                  layoutId="mobileActiveTab" 
                  className="bottom-nav-item-bg"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="bottom-nav-icon">≡</span>
              <span className="bottom-nav-label">Ещё</span>
              {friendRequestsCount > 0 && <span className="nav-badge-bottom">{friendRequestsCount}</span>}
            </button>
          </div>

          {/* Collapsed Corner Floating Buttons (Rendered only on swipe screens when collapsed) */}
          {isSwipeScreen && (
            <div className={`mobile-swipe-corner-buttons ${navExpanded ? 'hidden' : ''}`}>
              {/* Bottom-left corner button: Назад (Undo) */}
              <button 
                className="swipe-corner-btn swipe-corner-btn--left" 
                onClick={() => onUndo?.()}
                style={{ 
                  opacity: (!history || history.length === 0) ? 0.35 : 1,
                  transform: (!history || history.length === 0) ? "none" : "scale(1)"
                }}
                disabled={!history || history.length === 0}
                title="Назад"
              >
                <span className="corner-btn-icon">⏪</span>
              </button>

              {/* Bottom-right corner button: Раскрыть (Expand) */}
              <button 
                className="swipe-corner-btn swipe-corner-btn--right" 
                onClick={handleExpandClick}
                title="Раскрыть"
              >
                <span className="corner-btn-icon">▲</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* iOS style Bottom Sheet for Menu with AnimatePresence */}
      <AnimatePresence>
        {isMobile && menuOpen && (
          <>
            <motion.div 
              className="bottom-sheet-overlay open"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div 
              className="bottom-sheet open"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
            >
              <div className="bottom-sheet-drag-handle" />
              <h3 className="bottom-sheet-title">Разделы приложения</h3>
              
              <div className="bottom-sheet-menu">
                {menuItems.map((item) => (
                  <button 
                    key={item.id}
                    className={`bottom-sheet-item ${currentScreen === item.id ? "sheet-item-active" : ""}`} 
                    onClick={() => handleTabClick(item.id)}
                  >
                    <span className="sheet-icon">{item.icon}</span>
                    <span className="sheet-label">{item.label}</span>
                    {item.badge > 0 && <span className="sheet-badge">{item.badge}</span>}
                  </button>
                ))}
              </div>
              
              <button className="bottom-sheet-cancel" onClick={() => setMenuOpen(false)}>Отмена</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
