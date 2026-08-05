import { useMemo, useState, useEffect, useRef } from "react";
import { movies } from "./data";
import { auth, database, signInWithTelegram } from "./firebase";
import { initTelegramWebApp, getTelegramUser } from "./tma";
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
import ActorProfilePage from "./components/ActorProfilePage";
import PopularActorsPage from "./components/PopularActorsPage";
import { rankMoviesForUser } from "./recommendations";
import "./styles/index.css";

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
  const [decisions, setDecisions] = useState(() => {
    try {
      const saved = localStorage.getItem("mw_decisions");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  }); // { [movieId]: 'like' | 'dislike' }
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("mw_history");
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  }); // swiped movie ids in order
  const [lastSwipeDir, setLastSwipeDir] = useState("like");
  const swipeDirRef = useRef("like");
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("mw_favorites");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  }); // { [movieId]: true }
  const [ratings, setRatings] = useState(() => {
    try {
      const saved = localStorage.getItem("mw_ratings");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  }); // { [movieId]: number (1-10) }
  const [screen, setScreen] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetScreen = params.get("screen") || params.get("startapp");
      if (targetScreen === "profile") return "profile";
      if (targetScreen === "liked") return "liked";
      if (targetScreen === "popularActors") return "popularActors";
    }
    return "matchwatch";
  });
  const [matchWatchScreen, setMatchWatchScreen] = useState("start");
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
    // Disabled automatic PWA prompt trigger to keep the movie-swiping screen clean and focus-oriented.
    setShowPwaPrompt(false);
  }, [screen]);

  useEffect(() => {
    initTelegramWebApp();

    const tryTgAuth = async () => {
      try {
        const tgUser = getTelegramUser();
        if (!tgUser) return;
        const tgId = tgUser.id || tgUser.tgId;
        const expectedEmail = `tg_${tgId}@matchwatch.internal`;
        if (auth?.currentUser && auth.currentUser.email === expectedEmail) {
          return;
        }
        await signInWithTelegram(tgUser);
      } catch (err) {
        console.error("TMA Auto-auth error:", err);
      }
    };

    tryTgAuth();
    const timer1 = setTimeout(tryTgAuth, 300);
    const timer2 = setTimeout(tryTgAuth, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mw_decisions", JSON.stringify(decisions));
      localStorage.setItem("mw_favorites", JSON.stringify(favorites));
      localStorage.setItem("mw_ratings", JSON.stringify(ratings));
      localStorage.setItem("mw_history", JSON.stringify(history));
    } catch (e) {}
  }, [decisions, favorites, ratings, history]);

  useEffect(() => {
    if (!auth || !database) {
      setDataLoaded(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = ref(database, `users/${currentUser.uid}/appData`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            if (data.decisions) {
              setDecisions(prev => ({ ...data.decisions, ...prev }));
            }
            if (data.history) {
              setHistory(prev => Array.from(new Set([...(data.history || []), ...prev])));
            }
            if (data.favorites) {
              setFavorites(prev => ({ ...data.favorites, ...prev }));
            }
            if (data.ratings) {
              setRatings(prev => ({ ...data.ratings, ...prev }));
            }
          }
          setDataLoaded(true);
        }, { onlyOnce: true });
        
        onValue(ref(database, `users/${currentUser.uid}/profile/stopGenres`), (snap) => {
          const val = snap.val();
          let arr = [];
          if (Array.isArray(val)) {
            arr = val;
          } else if (val && typeof val === 'object') {
            arr = Object.values(val);
          } else if (typeof val === 'string') {
            arr = [val];
          }
          const clean = arr.filter(item => typeof item === 'string' && item.trim() !== "");
          setStopGenres(clean);
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
  }, []);

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
  const [selectedActorName, setSelectedActorName] = useState(null);
  const [previousScreen, setPreviousScreen] = useState("swipe");

  useEffect(() => {
    const handleShowActor = (e) => {
      setPreviousScreen(prev => screen !== "actorProfile" ? screen : prev);
      setSelectedActorName(e.detail);
      setScreen("actorProfile");
    };
    const handleSwitchTab = (e) => {
      if (e.detail) setScreen(e.detail);
    };
    window.addEventListener("show-actor-details", handleShowActor);
    window.addEventListener("switch-tab", handleSwitchTab);
    return () => {
      window.removeEventListener("show-actor-details", handleShowActor);
      window.removeEventListener("switch-tab", handleSwitchTab);
    };
  }, [screen]);

  useEffect(() => {
    if (user && dataLoaded && database) {
      update(ref(database, `users/${user.uid}/appData`), {
        decisions,
        history,
        favorites,
        ratings
      }).catch(err => console.warn("AppData sync update failed:", err));
    }
  }, [decisions, history, favorites, ratings, user, dataLoaded]);

  const liked = useMemo(
    () => movies.filter(m => decisions[m.id] === "like" || favorites[m.id]),
    [decisions, favorites]
  );

  const filteredDeck = useMemo(() => {
    let filtered = deck;
    
    // Strictly filter out all movies that have an existing decision (like or dislike)
    filtered = filtered.filter(m => !decisions[m.id]);

    // Filter by active category (movie, series, anime)
    filtered = filtered.filter(m => {
      const type = m.type || "movie";
      return type === activeCategory;
    });

    if (stopGenres.length > 0) {
      filtered = filtered.filter(m => {
        if (!m.genres) return true;
        return !stopGenres.some(g => m.genres.includes(g));
      });
    }

    // Smart Recommendation Ranking based on Liked Taste Profile
    return rankMoviesForUser(filtered, liked);
  }, [deck, decisions, stopGenres, activeCategory, liked]);

  const currentMoviePoster = useMemo(() => {
    if (screen === "swipe" && filteredDeck && cursor < filteredDeck.length) {
      return filteredDeck[cursor].poster;
    }
    return null;
  }, [screen, filteredDeck, cursor]);

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
      if (filteredDeck.length === 0) {
        setScreen("final");
      }
    }
  }, [filteredDeck, screen]);

  const handleSwipe = (dir, movie) => {
    const decision = (dir === "like" || dir === "right") ? "like" : "dislike";
    swipeDirRef.current = decision;
    setLastSwipeDir(decision);
    setDecisions(prev => ({ ...prev, [movie.id]: decision }));
    setHistory(prev => [...prev, movie.id]);
    setCursor(0);

    if (filteredDeck.length <= 1) {
      setTimeout(() => setScreen("final"), 450);
    }
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
    if (history.length === 0) return;
    
    // Pick the last swiped movie ID from history
    const lastId = history[history.length - 1];

    // 1. Pop from history
    setHistory(prev => prev.slice(0, -1));

    // 2. Remove decision (restores movie to filteredDeck at top)
    setDecisions(d => {
      const next = { ...d };
      delete next[lastId];
      return next;
    });

    setCursor(0);

    // 3. Return from final screen if needed
    if (screen === "final") {
      setScreen("swipe");
    }
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
    if (user && database) {
      remove(ref(database, `users/${user.uid}/invites/${code}`));
    }
  };

  const handleRejectInvite = (code) => {
    if (user && database) {
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
        onScreenChange={setMatchWatchScreen}
      />;
    }
    if (screen === "profile") {
      return <Profile 
        user={user}
        currentUserDecisions={decisions}
        favorites={favorites}
        ratings={ratings}
      />;
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
        onGoToMatchWatch={(code) => {
          setHostRoomCode(code);
          setScreen("matchwatch");
        }}
        user={user}
        decisions={decisions}
        favorites={favorites}
        stopGenres={stopGenres}
        friendRequests={friendRequests}
      />;
    }
    if (screen === "publicProfile") {
      return <PublicProfile 
        tag={publicProfileTag} 
        user={user}
        currentUserDecisions={decisions}
        favorites={favorites}
        ratings={ratings}
        onBackToApp={() => setScreen("swipe")} 
        onGoToMatchWatch={(roomCode) => {
          setHostRoomCode(roomCode);
          setScreen("matchwatch");
        }}
      />;
    }
    if (screen === "actorProfile") {
      return <ActorProfilePage 
        actorName={selectedActorName} 
        onBack={() => setScreen(previousScreen || "swipe")} 
        onMovieSelect={(m) => setSelectedMovieForDetails(m)}
        userAppData={{ decisions, favorites, ratings }}
      />;
    }
    if (screen === "popularActors") {
      return <PopularActorsPage 
        onActorSelect={(name) => {
          setPreviousScreen("popularActors");
          setSelectedActorName(name);
          setScreen("actorProfile");
        }}
        userAppData={{ decisions, favorites, ratings }}
      />;
    }

    return (
      <div className="screen screen--center swipe-screen">
        <CategoryPicker />
        <div className="swipe-wrapper">
          <div className="deck-container">
            <AnimatePresence custom={lastSwipeDir} initial={false}>
              {[cursor + 2, cursor + 1, cursor].map((cardIndex, position) => (
                cardIndex < filteredDeck.length && (
                    <motion.div
                      key={filteredDeck[cardIndex].id}
                      className="deck-card"
                      style={{ 
                        zIndex: 100 + position,
                        position: "absolute",
                        width: "100%",
                        height: "100%"
                      }}
                      custom={lastSwipeDir}
                      initial={{ scale: 0.94 + position * 0.03, y: position === 2 ? 0 : (2 - position) * 8, opacity: position === 2 ? 1 : 0.6 }}
                      animate={{ scale: position === 2 ? 1 : 0.94 + position * 0.03, y: position === 2 ? 0 : (2 - position) * 8, opacity: position === 2 ? 1 : 0.6 }}
                      exit={() => ({
                        x: swipeDirRef.current === "like" ? 750 : -750,
                        rotate: swipeDirRef.current === "like" ? 28 : -28,
                        opacity: 0
                      })}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    >
                      <SwipeCard 
                        movie={filteredDeck[cardIndex]} 
                        onSwipe={handleSwipe}
                        onShowDetails={(m) => setSelectedMovieForDetails(m)}
                        onUndo={handleUndo}
                        onToggleFavorite={toggleFavorite}
                        isFavorite={!!favorites[filteredDeck[cardIndex].id]}
                      />
                    </motion.div>
                  )
                ))
              }
            </AnimatePresence>
            
            {cursor >= filteredDeck.length && (
              <div className="no-more-cards">
                <h2>Конец категории!</h2>
                <p>Вы просмотрели всё в этом разделе.</p>
                <button onClick={handleReset} className="reset-btn">Начать сначала</button>
              </div>
            )}
          </div>

          {/* 5-Button Control Dock placed cleanly below 500px card */}
          {cursor < filteredDeck.length && (
            <div className="swipe-controls-dock">
              <button
                className="swipe-control-btn btn-dislike"
                onClick={() => {
                  const currentMovie = filteredDeck[cursor];
                  if (currentMovie) handleSwipe("dislike", currentMovie);
                }}
                title="Пропустить (Мимо)"
              >
                👎
              </button>
              <button
                className="swipe-control-btn btn-undo"
                onClick={handleUndo}
                disabled={history.length === 0}
                title="Вернуть последний фильм"
              >
                ↩️
              </button>
              <button
                className="swipe-control-btn btn-info"
                onClick={() => {
                  const currentMovie = filteredDeck[cursor];
                  if (currentMovie) setSelectedMovieForDetails(currentMovie);
                }}
                title="Подробная информация"
              >
                ℹ️
              </button>
              <button
                className={`swipe-control-btn btn-fav ${filteredDeck[cursor] && favorites[filteredDeck[cursor].id] ? "active" : ""}`}
                onClick={() => {
                  const currentMovie = filteredDeck[cursor];
                  if (currentMovie) toggleFavorite(currentMovie.id);
                }}
                title="В избранное"
              >
                ⭐
              </button>
              <button
                className="swipe-control-btn btn-like"
                onClick={() => {
                  const currentMovie = filteredDeck[cursor];
                  if (currentMovie) handleSwipe("like", currentMovie);
                }}
                title="Сохранить (Лайк)"
              >
                ❤️
              </button>
            </div>
          )}
        </div>
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
      {/* Dynamic blurred poster background for premium mobile swipe screen */}
      {isMobile && currentMoviePoster && (
        <div 
          className="mobile-ambient-backdrop" 
          style={{ backgroundImage: `url(${currentMoviePoster})` }} 
        />
      )}

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
            matchWatchScreen={matchWatchScreen}
          />
          <div className={`app-container ${(screen === "swipe" || (screen === "matchwatch" && matchWatchScreen === "swiping")) ? "no-scroll" : ""} ${screen === "swipe" ? "swipe-layout" : ""}`}>
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
          <div className={`app-container-desktop ${(screen === "swipe" || (screen === "matchwatch" && matchWatchScreen === "swiping")) ? "no-scroll" : ""}`}>
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
