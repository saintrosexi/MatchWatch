import { useMemo, useState, useEffect } from "react";
import { movies } from "./data";
import { auth, database } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, set, onValue, remove } from "firebase/database";
import { AnimatePresence, motion } from "framer-motion";
import SwipeCard from "./components/SwipeCard";
import LikedGrid from "./components/LikedGrid";
import TopMovies from "./components/TopMovies";
import SearchMovies from "./components/SearchMovies";
import MoodPicker from "./components/MoodPicker";
import MatchWatch from "./components/MatchWatch";
import FinalScreen from "./components/FinalScreen";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Profile from "./components/Profile";
import Settings from "./components/Settings";
import Friends from "./components/Friends";
import PublicProfile from "./components/PublicProfile";
import DetailedMovieModal from "./components/DetailedMovieModal";
import "./styles.css";

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [language, setLanguage] = useState("ru");
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentUserAvatar, setCurrentUserAvatar] = useState("😎");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (theme === "light") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
  }, [theme]);

  const [deck, setDeck] = useState(() => shuffle(movies));
  const [cursor, setCursor] = useState(0);
  const [decisions, setDecisions] = useState(() => ({})); // { [movieId]: 'like' | 'dislike' }
  const [history, setHistory] = useState(() => []); // swiped movie ids in order
  const [favorites, setFavorites] = useState(() => ({})); // { [movieId]: true }
  const [ratings, setRatings] = useState(() => ({})); // { [movieId]: number (1-10) }
  const [screen, setScreen] = useState("matchwatch");
  const [swipeHint, setSwipeHint] = useState({ x: 0, active: false, swiped: false });
  const [user, setUser] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [stopGenres, setStopGenres] = useState([]);
  const [invites, setInvites] = useState({});
  const [friendRequests, setFriendRequests] = useState({});
  const [disableOnboarding, setDisableOnboarding] = useState(false);
  const [sessionTutorialSeen, setSessionTutorialSeen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("movie"); // movie, series, anime

  const [showPwaPrompt, setShowPwaPrompt] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true;
    const dismissed = sessionStorage.getItem("pwa_prompt_dismissed");
    if (isIOS && !isStandalone && !dismissed && screen === "swipe") {
      setShowPwaPrompt(true);
    } else {
      setShowPwaPrompt(false);
    }
  }, [screen]);

  useEffect(() => {
    if (!auth) {
      setDataLoaded(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = ref(database, `users/${currentUser.uid}/appData`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data && !dataLoaded) {
            if (data.decisions) {
              setDecisions(prev => ({ ...prev, ...data.decisions }));
            }
            if (data.history) {
              setHistory(prev => {
                const combined = [...prev, ...data.history];
                return Array.from(new Set(combined));
              });
            }
            if (data.favorites) {
              setFavorites(prev => ({ ...prev, ...data.favorites }));
            }
            if (data.ratings) {
              setRatings(prev => ({ ...prev, ...data.ratings }));
            }
          }
          setDataLoaded(true);
        }, { onlyOnce: true });
        
        onValue(ref(database, `users/${currentUser.uid}/profile/stopGenres`), (snap) => {
          setStopGenres(snap.val() || []);
        });

        onValue(ref(database, `users/${currentUser.uid}/profile/disableOnboarding`), (snap) => {
          setDisableOnboarding(snap.val() || false);
        });
        
        onValue(ref(database, `users/${currentUser.uid}/invites`), (snap) => {
          setInvites(snap.val() || {});
        });
        
        onValue(ref(database, `users/${currentUser.uid}/friendRequests`), (snap) => {
          setFriendRequests(snap.val() || {});
        });

        onValue(ref(database, `users/${currentUser.uid}/profile/avatar`), (snap) => {
          setCurrentUserAvatar(snap.val() || "😎");
        });
      } else {
        setDataLoaded(true);
      }
    });
    return () => unsubscribe();
  }, [dataLoaded]);

  const [publicProfileTag, setPublicProfileTag] = useState(null);
  const [initialRoomCode, setInitialRoomCode] = useState(null);
  const [hostRoomCode, setHostRoomCode] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const addTag = urlParams.get('add');
    if (addTag) {
      setPublicProfileTag(addTag);
      setScreen("publicProfile");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [selectedMovieForDetails, setSelectedMovieForDetails] = useState(null);

  useEffect(() => {
    if (user && dataLoaded && database) {
      set(ref(database, `users/${user.uid}/appData`), {
        decisions,
        history,
        favorites,
        ratings
      });
    }
  }, [decisions, history, favorites, ratings, user, dataLoaded]);

  const liked = useMemo(
    () => deck.filter(m => decisions[m.id] === "like"),
    [deck, decisions]
  );

  const filteredDeck = useMemo(() => {
    let filtered = deck;
    
    // Filter by category
    filtered = filtered.filter(m => {
      const type = m.type || "movie";
      return type === activeCategory;
    });

    if (stopGenres.length === 0) return filtered;
    return filtered.filter(m => {
      if (!m.genres) return true;
      return !stopGenres.some(g => m.genres.includes(g));
    });
  }, [deck, stopGenres, activeCategory]);

  const isDecided = (movie) => Boolean(decisions[movie.id]);

  const nextUndecidedFrom = (startIndex) => {
    for (let i = startIndex; i < filteredDeck.length; i++) {
      if (!isDecided(filteredDeck[i])) return i;
    }
    return filteredDeck.length;
  };

  useEffect(() => {
    const isSwipeScreen = screen === "swipe" || screen === "matchwatch";
    if (isSwipeScreen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    };
  }, [screen]);

  useEffect(() => {
    if (screen === "swipe") {
      if (filteredDeck.length === 0 || cursor >= filteredDeck.length) {
        setScreen("final");
        return;
      }
      if (Boolean(decisions[filteredDeck[cursor].id])) {
        let next = cursor;
        while (next < filteredDeck.length && Boolean(decisions[filteredDeck[next].id])) {
          next++;
        }
        setCursor(next);
        if (next >= filteredDeck.length) {
          setScreen("final");
        }
      }
    }
  }, [cursor, filteredDeck, decisions, screen]);

  const handleSwipe = (dir, movie) => {
    const decision = dir === "right" ? "like" : "dislike";
    setDecisions(prev => ({ ...prev, [movie.id]: decision }));
    setHistory(prev => [...prev, movie.id]);

    const next = nextUndecidedFrom(cursor + 1);
    if (next >= filteredDeck.length) {
      setTimeout(() => setScreen("final"), 400);
    }
    setCursor(next);
  };

  const handleReset = () => {
    setDeck(shuffle(movies));
    setDecisions({});
    setHistory([]);
    setCursor(0);
    setScreen("swipe");
    setSessionTutorialSeen(false);
  };

  const handleWatchNew = () => {
    setDecisions(prev => {
      const next = {};
      Object.entries(prev).forEach(([id, decision]) => {
        if (decision === "like") next[id] = "like";
      });
      return next;
    });
    setHistory(prev => prev.filter(id => decisions[id] === "like"));
    setDeck(shuffle(movies));
    setCursor(0);
    setScreen("swipe");
  };

  const handleUndo = () => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const lastId = prev[prev.length - 1];
      setDecisions(d => {
        const next = { ...d };
        delete next[lastId];
        return next;
      });
      const idx = filteredDeck.findIndex(m => m.id === lastId);
      setCursor(idx >= 0 ? idx : 0);
      setSwipeHint({ x: 0, active: false, swiped: false });
      return prev.slice(0, -1);
    });
  };

  const toggleLike = (movie) => {
    setDecisions(prev => {
      const current = prev[movie.id];
      const next = { ...prev };
      if (current === "like") {
        delete next[movie.id];
        // Also remove from favorites if it was there
        setFavorites(f => {
          const nextF = { ...f };
          delete nextF[movie.id];
          return nextF;
        });
      } else {
        next[movie.id] = "like";
      }
      return next;
    });
  };

  const toggleFavorite = (movie) => {
    setFavorites(prev => {
      const next = { ...prev };
      if (next[movie.id]) {
        delete next[movie.id];
      } else {
        next[movie.id] = true;
        // Also make sure it is added to Decisions (liked)
        setDecisions(d => {
          const nextD = { ...d };
          if (nextD[movie.id] !== "like") {
            nextD[movie.id] = "like";
            // Append to history as well
            setHistory(h => {
              if (!h.includes(movie.id)) {
                return [...h, movie.id];
              }
              return h;
            });
          }
          return nextD;
        });
      }
      return next;
    });
  };

  const handleSetRating = (movie, rating) => {
    setRatings(prev => {
      const next = { ...prev };
      if (rating === null || next[movie.id] === rating) {
        delete next[movie.id];
      } else {
        next[movie.id] = rating;
      }
      return next;
    });
  };

  const handleTabClick = (tab) => {
    if (tab === "swipe") {
      setScreen("swipe");
      setCursor(nextUndecidedFrom(0));
    } else {
      setScreen(tab);
    }
  };

  const CategoryPicker = () => (
    <div className="category-picker">
      <button 
        className={`category-btn ${activeCategory === 'movie' ? 'active' : ''}`}
        onClick={() => { setActiveCategory('movie'); setCursor(0); }}
      >
        Фильмы
      </button>
      <button 
        className={`category-btn ${activeCategory === 'series' ? 'active' : ''}`}
        onClick={() => { setActiveCategory('series'); setCursor(0); }}
      >
        Сериалы
      </button>
      <button 
        className={`category-btn ${activeCategory === 'anime' ? 'active' : ''}`}
        onClick={() => { setActiveCategory('anime'); setCursor(0); }}
      >
        Аниме
      </button>
    </div>
  );

  const handleAcceptInvite = (code) => {
    setInitialRoomCode(code);
    setScreen("matchwatch");
    if (user) {
      remove(ref(database, `users/${user.uid}/invites/${code}`));
    }
  };

  const handleRejectInvite = (code) => {
    if (user) {
      remove(ref(database, `users/${user.uid}/invites/${code}`));
    }
  };

  const currentScreen = (() => {
    if (screen === "final") {
      return (
        <FinalScreen 
          activeCategory={activeCategory}
          onChangeCategory={(cat) => {
            setActiveCategory(cat);
            setCursor(0);
            setScreen("swipe");
          }}
          onOpenLiked={() => setScreen("liked")} 
          onWatchNew={handleWatchNew} 
        />
      );
    }
    if (screen === "liked") {
      return <LikedGrid liked={liked} decisions={decisions} onToggleLike={toggleLike} favorites={favorites} onToggleFavorite={toggleFavorite} ratings={ratings} onSetRating={handleSetRating} />;
    }
    if (screen === "top") {
      return <TopMovies stopGenres={stopGenres} decisions={decisions} onToggleLike={toggleLike} favorites={favorites} onToggleFavorite={toggleFavorite} ratings={ratings} onSetRating={handleSetRating} />;
    }
    if (screen === "search") {
      return <SearchMovies stopGenres={stopGenres} decisions={decisions} onToggleLike={toggleLike} favorites={favorites} onToggleFavorite={toggleFavorite} ratings={ratings} onSetRating={handleSetRating} />;
    }
    if (screen === "mood") {
      return <MoodPicker stopGenres={stopGenres} decisions={decisions} onToggleLike={toggleLike} favorites={favorites} onToggleFavorite={toggleFavorite} ratings={ratings} onSetRating={handleSetRating} />;
    }
    if (screen === "matchwatch") {
      return <MatchWatch 
        onLike={(movieId) => setDecisions(prev => ({ ...prev, [movieId]: "like" }))} 
        decisions={decisions}
        onToggleLike={toggleLike}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        ratings={ratings}
        onSetRating={handleSetRating}
        initialRoomCode={initialRoomCode}
        onClearInitialRoomCode={() => setInitialRoomCode(null)}
        hostRoomCode={hostRoomCode}
        onClearHostRoomCode={() => setHostRoomCode(null)}
        invites={invites}
        disableOnboarding={disableOnboarding}
        stopGenres={stopGenres}
      />;
    }
    if (screen === "profile") {
      return <Profile />;
    }
    if (screen === "settings") {
      return <Settings theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} />;
    }
    if (screen === "friends") {
      return <Friends
        onViewProfile={(tag) => {
          setPublicProfileTag(tag);
          setScreen("publicProfile");
        }}
        onTabClick={handleTabClick}
      />;
    }
    if (screen === "publicProfile") {
      return <PublicProfile 
        tag={publicProfileTag} 
        onBackToApp={() => setScreen("swipe")} 
        onGoToMatchWatch={(roomCode) => {
          setHostRoomCode(roomCode);
          setScreen("matchwatch");
        }}
      />;
    }

    const showTutorial = !disableOnboarding && !sessionTutorialSeen;

    return (
      <div className="screen screen--center swipe-screen">
        {!isMobile && <CategoryPicker />}
        <div className="swipe-wrapper">
          <div className="swipe-hints" aria-hidden="true">
            <div
              className={`swipe-hint-icon swipe-hint-icon--dislike ${swipeHint.active && swipeHint.x < -50 ? 'active' : ''}`}
              style={{
                opacity: swipeHint.active ? Math.min(1, Math.max(0, -swipeHint.x / 120)) : 0,
                transform: `translateY(-50%) scale(${0.95 + Math.min(0.15, Math.max(0, -swipeHint.x / 600))})`
              }}
            >
              ✕
            </div>
            <div
              className={`swipe-hint-icon swipe-hint-icon--like ${swipeHint.active && swipeHint.x > 50 ? 'active' : ''}`}
              style={{
                opacity: swipeHint.active ? Math.min(1, Math.max(0, swipeHint.x / 120)) : 0,
                transform: `translateY(-50%) scale(${0.95 + Math.min(0.15, Math.max(0, swipeHint.x / 600))})`
              }}
            >
              ❤️
            </div>
          </div>

          <div className="deck-container">
            <AnimatePresence initial={false}>
              {showTutorial ? (
                <motion.div 
                  key="tutorial"
                  className="deck-card" 
                  style={{ zIndex: 500, position: "absolute", width: "100%", height: "100%" }}
                  exit={{ y: 1200, rotate: -20, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <SwipeCard 
                    isTutorial={true} 
                    onShowDetails={() => {}}
                    onSwipe={() => {
                      setSwipeHint({ x: 0, active: false, swiped: false });
                      setSessionTutorialSeen(true);
                    }} 
                    onDragProgress={(x, active) => {
                       setSwipeHint({ x, active, swiped: false });
                    }}
                  />
                </motion.div>
              ) : (
                [cursor + 2, cursor + 1, cursor].map((cardIndex, position) => (
                  cardIndex < filteredDeck.length && !isDecided(filteredDeck[cardIndex]) && (
                    <motion.div
                      key={filteredDeck[cardIndex].id}
                      className="deck-card"
                      style={{ 
                        zIndex: 100 + position,
                        position: "absolute",
                        width: "100%",
                        height: "100%"
                      }}
                      initial={{ scale: 0.9, opacity: 0, y: 30 }}
                      animate={{ 
                        scale: position === 2 ? 1 : (position === 1 ? 0.96 : 0.92), 
                        opacity: 1, 
                        y: position === 2 ? 0 : (position === 1 ? 12 : 24) 
                      }}
                      exit={{ 
                        y: 1200, 
                        rotate: swipeHint.x > 0 ? 25 : -25, 
                        opacity: 0,
                        transition: { duration: 0.5, ease: "easeIn" }
                      }}
                    >
                      {cardIndex === cursor ? (
                        <SwipeCard
                          movie={filteredDeck[cardIndex]}
                          onShowDetails={(m) => setSelectedMovieForDetails(m)}
                          onSwipe={(dir, movie) => {
                            handleSwipe(dir, movie);
                          }}
                          onDragProgress={(x, active) => {
                            setSwipeHint({ x, active, swiped: false });
                          }}
                        />
                      ) : (
                        <div className="card-placeholder">
                          <img src={filteredDeck[cardIndex].poster} alt={filteredDeck[cardIndex].title} />
                          <div className="placeholder-overlay" />
                        </div>
                      )}
                    </motion.div>
                  )
                ))
              )}
            </AnimatePresence>
            
            {cursor >= filteredDeck.length && (
              <div className="no-more-cards">
                <h2>Конец категории!</h2>
                <p>Вы просмотрели всё в этом разделе.</p>
                <button onClick={handleReset} className="reset-btn">Начать сначала</button>
              </div>
            )}
          </div>

          {!showTutorial && (
            <button 
              className="btn-floating-undo desktop-only" 
              onClick={handleUndo} 
              disabled={history.length === 0}
              title="Отменить последний выбор"
            >
              ↩️
            </button>
          )}
        </div>
        {isMobile && <CategoryPicker />}
      </div>
    );
  })();

  const undoHeaderButton = screen === "swipe" ? (
    <button 
      className="btn-header-undo" 
      onClick={handleUndo} 
      disabled={history.length === 0}
      style={{ opacity: history.length === 0 ? 0.5 : 1 }}
    >
      ↩️ Назад
    </button>
  ) : null;

  return (
    <div className={`app ${!isMobile ? "desktop-layout-mode" : ""}`}>
      {/* Bloom background effect rendered globally on desktop */}
      {!isMobile && <div className="bloom-effect" />}

      {isMobile ? (
        <>
          <Header
            currentScreen={screen}
            onTabClick={handleTabClick}
            likedCount={liked.length}
            friendRequestsCount={Object.keys(friendRequests).length}
            invitesCount={Object.keys(invites).length}
            rightContent={undoHeaderButton}
            onUndo={handleUndo}
            history={history}
          />
          <div className={`app-container ${(screen === "swipe" || screen === "matchwatch") ? "no-scroll" : ""} ${screen === "swipe" ? "swipe-layout" : ""}`}>
            {currentScreen}
          </div>
        </>
      ) : (
        <div className="app-desktop-wrapper">
          <Sidebar
            currentScreen={screen}
            onTabClick={handleTabClick}
            likedCount={liked.length}
            friendRequestsCount={Object.keys(friendRequests).length}
            invitesCount={Object.keys(invites).length}
            user={user}
            currentUserAvatar={currentUserAvatar}
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
          />
          <div className={`app-container-desktop ${(screen === "swipe" || screen === "matchwatch") ? "no-scroll" : ""}`}>
            {screen === "swipe" && undoHeaderButton && (
              <div className="desktop-floating-header-actions">
                {undoHeaderButton}
              </div>
            )}
            {currentScreen}
          </div>
        </div>
      )}

      {selectedMovieForDetails && (
        <DetailedMovieModal 
          movie={selectedMovieForDetails} 
          onClose={() => setSelectedMovieForDetails(null)}
          isLiked={decisions[selectedMovieForDetails.id] === "like"}
          onToggleLike={toggleLike}
          isFavorite={!!favorites[selectedMovieForDetails.id]}
          onToggleFavorite={toggleFavorite}
          rating={ratings[selectedMovieForDetails.id]}
          onSetRating={handleSetRating}
        />
      )}
      
      {Object.keys(invites).length > 0 && (
        <div className="global-invites-overlay">
          {Object.entries(invites).map(([code, info]) => (
            <div key={code} className="invite-toast">
              <div>
                <strong>👤 {info.from}</strong> зовет вас выбрать фильм!
              </div>
              <div className="invite-actions">
                <button className="btn-accept" onClick={() => handleAcceptInvite(code)}>Присоединиться</button>
                <button className="btn-reject" onClick={() => handleRejectInvite(code)}>Скрыть</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showPwaPrompt && (
        <div className="pwa-prompt-toast">
          <div className="pwa-prompt-content">
            <span className="pwa-prompt-icon">💡</span>
            <div className="pwa-prompt-text">
              <strong>Установите приложение!</strong><br />
              Нажмите кнопку <strong>«Поделиться»</strong> (квадрат со стрелкой вверх) в Safari и выберите <strong>«На экран "Домой"»</strong> для полноэкранного режима без рамок.
            </div>
          </div>
          <button className="pwa-prompt-close" onClick={() => {
            setShowPwaPrompt(false);
            sessionStorage.setItem("pwa_prompt_dismissed", "true");
          }}>✕</button>
        </div>
      )}
    </div>
  );
}
