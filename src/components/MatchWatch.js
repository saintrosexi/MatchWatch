import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { auth, database, createMatchRoom, joinMatchRoom, swipeMovie, subscribeToRoom, inviteToMatchWatch, removeInvite, removeSwipe, extendMatchRoomDeck } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get } from "firebase/database";
import { movies, moviesById } from "../data";
import SwipeCard from "./SwipeCard";
import DetailedMovieModal from "./DetailedMovieModal";
import SessionFiltersModal from "./SessionFiltersModal";
import MatchLobby from "./MatchLobby";
import { triggerHaptic, getTelegramStartParam, getTelegramUser, shareTelegramRoom, initTelegramWebApp } from "../tma";
import { getPosterCandidates, getBestPosterUrl } from "../posterResolver";
import { ChamaBanner } from "../chamaAssets";

export default function MatchWatch({ onLike, initialRoomCode, onClearInitialRoomCode, hostRoomCode, onClearHostRoomCode, invites = {}, decisions = {}, onToggleLike, disableOnboarding = false, favorites, onToggleFavorite, ratings, onSetRating, stopGenres = [], onScreenChange, isAuthReady = true }) {
  const [screen, setScreen] = useState("start");
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState(null); // 'host' or 'guest'
  const [roomData, setRoomData] = useState(null);

  // Dynamic Session Cap (+25 per continue)
  const [sessionCap, setSessionCap] = useState(25);
  const [sessionFilters, setSessionFilters] = useState(null);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selectedMovieRecap, setSelectedMovieRecap] = useState(null);

  // Initialize Telegram WebApp & auto-join on startapp parameter
  useEffect(() => {
    if (!isAuthReady) return;

    initTelegramWebApp();
    const tgUser = getTelegramUser();
    const startParam = getTelegramStartParam();
    const nameToUse = (tgUser && tgUser.name) || userName || auth?.currentUser?.displayName;

    if (tgUser && tgUser.name && !userName) {
      setUserName(tgUser.name);
    }

    if (startParam) {
      const code = startParam.toUpperCase();
      setRoomCode(code);
      setRole("guest");

      if (typeof window !== "undefined" && window.location.search.includes("startapp")) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("startapp");
          url.searchParams.delete("start_param");
          window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        } catch (_e) { /* fallthrough */ }
      }

      if (nameToUse) {
        joinMatchRoom(code, nameToUse, decisions, favorites, stopGenres).then((success) => {
          if (success) {
            setScreen("swiping");
          } else {
            setScreen("join");
          }
        }).catch(() => setScreen("join"));
      } else {
        setScreen("join");
      }
    }
  }, [isAuthReady]);

  useEffect(() => {
    onScreenChange?.(screen);
  }, [screen, onScreenChange]);
  
  // NO MORE CURSOR. We use a local swipe history to optimistically hide cards we just swiped.
  const [swipeHistory, setSwipeHistory] = useState([]);
  
  const [showDetails, setShowDetails] = useState(false);
  const [matchQueue, setMatchQueue] = useState([]);
  const notifiedMatchesRef = useRef(new Set());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!roomCode) {
      notifiedMatchesRef.current.clear();
      isInitializedRef.current = false;
      setMatchQueue([]);
    }
  }, [roomCode]);

  const [matchHistory, setMatchHistory] = useState(() => {
    const saved = localStorage.getItem("matchwatch_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [copied, setCopied] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [friends, setFriends] = useState({});
  const [friendAvatars, setFriendAvatars] = useState({});
  const [sessionTutorialSeen, setSessionTutorialSeen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("movie");

  // Refs to prevent stale closures in Firebase callbacks
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  
  const roleRef = useRef(role);
  useEffect(() => { roleRef.current = role; }, [role]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        if (user.displayName && !userName) {
          setUserName(user.displayName);
        }
      }
    });
    return () => unsubscribe();
  }, [userName]);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode);
      setScreen("join");
      onClearInitialRoomCode();
    }
    if (hostRoomCode) {
      setRoomCode(hostRoomCode);
      setRole("host");
      setScreen("waiting");
      onClearHostRoomCode();
    }
  }, [initialRoomCode, hostRoomCode, onClearInitialRoomCode, onClearHostRoomCode]);

  useEffect(() => {
    if (!roomCode) return;
    
    // Subscribe ONLY ONCE when roomCode is set. 
    // Do NOT depend on screen/role, as that caused constant resubscriptions and missed events.
    const unsubscribe = subscribeToRoom(roomCode, (data) => {
      if (!data) return;
      setRoomData(data);
      
      const currentScreen = screenRef.current;
      const currentRole = roleRef.current || role;
      const activeRole = currentRole || (userName && data.hostName && userName === data.hostName ? "host" : (userName && data.guestName && userName === data.guestName ? "guest" : "guest"));
      
      if (data.status === "active" && currentScreen === "waiting") {
        setScreen("swiping");
      }

      const hostLikes = data.hostLikes || {};
      const guestLikes = data.guestLikes || {};

      const deckIds = data.deck || [];
      const deckArray = Array.isArray(deckIds) ? deckIds : Object.values(deckIds);

      const allMatches = [];
      deckArray.forEach(id => {
        if (!id) return;
        const movieId = parseInt(id);
        const hostLiked = hostLikes[movieId] === true;
        const guestLiked = guestLikes[movieId] === true;

        if (hostLiked && guestLiked) {
          allMatches.push(movieId);
        }
      });

      // 1. Silent initialization on the very first load
      if (!isInitializedRef.current) {
        allMatches.forEach(movieId => notifiedMatchesRef.current.add(movieId));
        isInitializedRef.current = true;

        // Silently add any existing session matches to the history if not already present
        if (allMatches.length > 0) {
          setMatchHistory(prev => {
            const safePrev = Array.isArray(prev) ? prev : [];
            let updated = false;
            const newHistory = [...safePrev];
            const partner = activeRole === "host" ? (data.guestName || "Партнер") : (data.hostName || "Партнер");
            
            allMatches.forEach(matchId => {
              const exists = newHistory.find(h => h.movieId === matchId);
              if (!exists) {
                newHistory.push({
                  id: Date.now() + matchId,
                  movieId: matchId,
                  partner: partner,
                  date: new Date().toLocaleDateString()
                });
                updated = true;
              }
            });
            
            if (updated) {
              localStorage.setItem("matchwatch_history", JSON.stringify(newHistory));
              return newHistory;
            }
            return safePrev;
          });
        }
      } else {
        // 2. Subsequent updates: detect new matches not in notifiedMatchesRef
        const newMatches = allMatches.filter(movieId => !notifiedMatchesRef.current.has(movieId));

        if (newMatches.length > 0) {
          triggerHaptic("success");
          newMatches.forEach(id => notifiedMatchesRef.current.add(id));
          setMatchQueue(prev => {
            const filtered = newMatches.filter(id => !prev.includes(id));
            return [...prev, ...filtered];
          });

          setMatchHistory(prev => {
            const safePrev = Array.isArray(prev) ? [...prev] : [];
            const partner = activeRole === "host" ? (data.guestName || "Партнер") : (data.hostName || "Партнер");

            newMatches.forEach(matchId => {
              const exists = safePrev.find(h => h.movieId === matchId && h.date === new Date().toLocaleDateString());
              if (!exists) {
                safePrev.unshift({
                  id: Date.now() + Math.random(),
                  movieId: matchId,
                  partner: partner,
                  date: new Date().toLocaleDateString()
                });
              }
            });

            localStorage.setItem("matchwatch_history", JSON.stringify(safePrev));
            return safePrev;
          });
        }
      }
    });
    return () => unsubscribe();
  }, [roomCode]);

  const handleExtendDeck = async () => {
    setSessionCap(prev => prev + 25);
    if (roomCode) {
      try {
        await extendMatchRoomDeck(roomCode, 25);
      } catch (err) {
        console.error("Error extending deck:", err);
      }
    }
  };

  useEffect(() => {
    if (currentUser && database) {
      const friendsRef = ref(database, `users/${currentUser.uid}/friends`);
      const unsubscribe = onValue(friendsRef, (snap) => {
        setFriends(snap.val() || {});
      });
      return () => unsubscribe();
    } else {
      setFriends({});
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchAvatars = async () => {
      if (!database) return;
      const avatars = {};
      await Promise.all(
        Object.keys(friends).map(async (uid) => {
          try {
            const snap = await get(ref(database, `users/${uid}/profile/avatar`));
            if (snap.exists()) {
              avatars[uid] = snap.val();
            }
          } catch (e) {
            console.error(e);
          }
        })
      );
      setFriendAvatars(avatars);
    };
    if (Object.keys(friends).length > 0) {
      fetchAvatars();
    }
  }, [friends]);

  const [requireAuthModal, setRequireAuthModal] = useState(false);

  const handleCreateRoom = async () => {
    if (!auth?.currentUser) {
      setRequireAuthModal(true);
      return;
    }

    const tgUser = getTelegramUser();
    const finalUserName = userName.trim() || auth?.currentUser?.displayName || (auth?.currentUser?.email ? auth.currentUser.email.split('@')[0] : null) || (tgUser && tgUser.name) || "Пользователь";
    if (!userName.trim()) {
      setUserName(finalUserName);
    }
    
    // Фильтруем фильмы по активной категории и сессионным пре-фильтрам
    const categoryIds = movies.reduce((acc, m) => {
      // Check category
      const matchCat = activeCategory === 'all' || (m.type || "movie") === activeCategory;
      if (!matchCat) return acc;

      // Check sessionFilters if applied
      if (sessionFilters) {
        // Genres filter
        if (sessionFilters.genres && sessionFilters.genres.length > 0) {
          const mGenres = (m.genres || "").split(",").map(g => g.trim());
          const hasGenre = sessionFilters.genres.some(g => mGenres.includes(g));
          if (!hasGenre) return acc;
        }
        // Decade filter
        if (sessionFilters.decade && sessionFilters.decade !== "all") {
          const y = parseInt(m.year);
          if (sessionFilters.decade === "2020-2026" && (y < 2020 || y > 2026)) return acc;
          if (sessionFilters.decade === "2010-2019" && (y < 2010 || y > 2019)) return acc;
          if (sessionFilters.decade === "2000-2009" && (y < 2000 || y > 2009)) return acc;
          if (sessionFilters.decade === "vintage" && y >= 2000) return acc;
        }
        // Duration filter
        if (sessionFilters.maxDuration && sessionFilters.maxDuration > 0) {
          const durMatch = (m.duration || "").match(/\d+/);
          if (durMatch) {
            const dur = parseInt(durMatch[0]);
            if (dur > sessionFilters.maxDuration) return acc;
          }
        }
      }

      acc.push(m.id);
      return acc;
    }, []);
    
    if (categoryIds.length === 0) {
      return alert("По выбранным фильтрам не найдено фильмов! Попробуйте сбросить некоторые фильтры.");
    }
      
    try {
      const code = await createMatchRoom(finalUserName, categoryIds, decisions, favorites, stopGenres);
      if (!code) {
        alert("Не удалось подключиться к базе данных. Попробуйте ещё раз.");
        return;
      }
      setRoomCode(code);
      setRole("host");
      setSessionCap(25);
      setScreen("waiting");
      setSessionTutorialSeen(false);
    } catch (err) {
      console.error("Error creating match room:", err);
      alert("Ошибка при создании комнаты: " + err.message);
    }
  };

  const handleJoinRoom = async () => {
    if (!auth?.currentUser) {
      setRequireAuthModal(true);
      return;
    }

    if (!roomCode.trim() || !userName.trim()) return alert("Введите данные");
    try {
      const success = await joinMatchRoom(roomCode, userName, decisions, favorites, stopGenres);
      if (success) {
        setRole("guest");
        setScreen("swiping");
        setSessionTutorialSeen(false);
      } else {
        alert("Комната не найдена");
      }
    } catch (err) {
      console.error("Ошибка при подключении к комнате:", err);
      alert("Ошибка при подключении к комнате. Попробуйте ещё раз.");
    }
  };

  const handleSwipe = (direction, movie) => {
    const decision = direction === "right" ? "like" : "dislike";
    swipeMovie(roomCode, role, movie.id, decision);
    
    // Optimsitically add to local swipe history so it hides instantly
    setSwipeHistory((prev) => [...prev, movie.id]);
  };

  const handleUndo = async () => {
    if (swipeHistory.length === 0) return;
    const lastMovieId = swipeHistory[swipeHistory.length - 1];
    
    // Remove from local optimistic history
    setSwipeHistory(prev => prev.slice(0, -1));
    
    // Remove from Firebase
    await removeSwipe(roomCode, role, lastMovieId);
  };

  const unswipedDeck = useMemo(() => {
    if (!roomData || !roomData.deck) return [];

    const rawDeck = roomData.deck;
    let deckArray = [];
    if (Array.isArray(rawDeck)) {
      deckArray = rawDeck;
    } else if (rawDeck && typeof rawDeck === 'object') {
      deckArray = Object.values(rawDeck);
    }
    
    const cleanDeck = deckArray.filter(id => id !== null && id !== undefined).map(id => parseInt(id));

    // Находим лайки текущего пользователя в этой сессии
    const isHost = role === "host";
    const myLikes = isHost ? (roomData.hostLikes || {}) : (roomData.guestLikes || {});
    const myDislikes = isHost ? (roomData.hostDislikes || {}) : (roomData.guestDislikes || {});

    // Оставляем только те карточки, которые не были свайпнуты (ни в Firebase, ни в локальной истории)
    return cleanDeck.filter(movieId => 
      myLikes[movieId] == null && myDislikes[movieId] == null && !swipeHistory.includes(movieId)
    );
  }, [roomData, role, swipeHistory]);

  const currentMovieId = unswipedDeck.length > 0 ? unswipedDeck[0] : null;
  const currentMovie = currentMovieId ? moviesById[currentMovieId] : null;

  const nextMovieId = unswipedDeck.length > 1 ? unswipedDeck[1] : null;
  const nextMovie = nextMovieId ? moviesById[nextMovieId] : null;



  const showTutorial = !disableOnboarding && !sessionTutorialSeen;

  // Render Error Boundary Wrapper
  const renderSwipingScreen = () => {
    try {
      return (
        <div className="matchwatch-swiping" style={{ width: "100%", height: "100%", minHeight: "600px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: "120px" }}>
          <div className="room-header-compact matchwatch-swiping-header">
            <div className="room-info-item">Комната: <strong className="room-code-tag">{roomCode}</strong></div>
            <div className="room-info-item users-line">{roomData?.hostName} & {roomData?.guestName || '...'}</div>
          </div>
          
          <div className="swipe-wrapper">
            <div className="deck-container">
              {!roomData || !roomData.deck || (Array.isArray(roomData.deck) && roomData.deck.length === 0) ? (
                <div className="empty-profile flex flex-col items-center justify-center p-6" style={{ textAlign: "center", marginTop: "20px" }}>
                  <div className="premium-loader" style={{ margin: "0 auto 20px auto" }} />
                  <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "12px" }}>Подбираем 25 идеальных фильмов для вашей пары...</p>
                  <ChamaBanner 
                    type="WRAPPED_BLANKET"
                    title="Умный подбор вкусов"
                    text="Подбираем 25 идеальных фильмов для вашей пары на основе 5D-векторов вкусов..."
                    size="large"
                  />
                </div>
              ) : showTutorial ? (
                <div className="deck-card deck-position-0" style={{ zIndex: 100 }}>
                  <SwipeCard 
                    isTutorial={true} 
                    onSwipe={() => setSessionTutorialSeen(true)} 
                  />
                </div>
              ) : (
                <AnimatePresence>
                  {nextMovie && (
                    <motion.div 
                      key={`next-${nextMovie.id}`}
                      className="deck-card deck-position-1" 
                      style={{ zIndex: 0, position: "absolute", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="card-placeholder" style={{ width: "100%", height: "100%" }}>
                        <img 
                          src={getBestPosterUrl(nextMovie)} 
                          alt={nextMovie.titleRu || nextMovie.title} 
                          referrerPolicy="no-referrer"
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "24px" }} 
                        />
                        <div className="placeholder-overlay" />
                      </div>
                    </motion.div>
                  )}
                  
                  {currentMovie ? (
                    <motion.div 
                      key={currentMovie.id}
                      className="deck-card deck-position-0" 
                      style={{ zIndex: 1, position: "absolute", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                      exit={{ x: 1000, opacity: 0, rotate: 20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <SwipeCard
                        movie={currentMovie}
                        onSwipe={handleSwipe}
                        onShowDetails={() => setShowDetails(currentMovie.id)}
                      />
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      className="empty-profile" 
                      style={{ textAlign: "center", marginTop: "100px", width: "100%", zIndex: 10 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <h2>Карточки закончились!</h2>
                      <p>Ждем, пока партнер досмотрит свой список...</p>
                    </motion.div>
                  )}
                  </AnimatePresence>
                )}
            </div>


          </div>
          
          {true && (
            <div style={{ position: "fixed", bottom: 10, right: 10, background: "rgba(0,0,0,0.8)", padding: "10px", fontSize: "10px", color: "#0f0", zIndex: 9999, pointerEvents: "none" }}>
              <div>Screen: {screen}</div>
              <div>Role: {role}</div>
              <div>Deck Size: {unswipedDeck.length}</div>
              <div>Current Movie: {currentMovieId}</div>
              <div>Room Code: {roomCode}</div>
              <div>Raw Deck Size: {roomData?.deck ? (Array.isArray(roomData.deck) ? roomData.deck.length : Object.keys(roomData.deck).length) : 0}</div>
            </div>
          )}
        </div>
      );
    } catch (e) {
      console.error("MatchWatch render error:", e);
      return (
        <div style={{ color: "white", padding: "20px", textAlign: "center" }}>
          <h2>Ошибка рендеринга</h2>
          <p>Что-то пошло не так при отображении карточек. Пожалуйста, перезагрузите страницу.</p>
        </div>
      );
    }
  };

  return (
    <div className="matchwatch-container" style={{ minHeight: "calc(100vh - 100px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {screen === "start" && (
        <motion.div className="matchwatch-start" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="matchwatch-main-logo">
            <img src="/logo.png" alt="MatchWatch Logo" className="logo-img-large" />
          </div>
          <p className="matchwatch-subtitle">Синхронный поиск фильма для двоих!</p>
          <div className="matchwatch-buttons">
            <button className="btn-matchwatch btn-create" onClick={() => setScreen("create")}>🎬 Создать комнату</button>
            <button className="btn-matchwatch btn-join" onClick={() => setScreen("join")}>🔗 Присоединиться</button>
            <button className="btn-matchwatch btn-matchwatch-secondary" onClick={() => setScreen("history")}>📜 Вы выбирали</button>
          </div>
          {Object.keys(invites).length > 0 && (
            <div className="matchwatch-invites" style={{marginTop: "30px", background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)", padding: "15px", borderRadius: "14px"}}>
              <h3 style={{marginTop: 0, fontSize: "1.1rem", color: "#ff4757"}}>Входящие приглашения:</h3>
              <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
                {Object.entries(invites).map(([code, inviteData]) => (
                  <div key={code} style={{background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                    <div style={{fontSize: "0.95rem", fontWeight: "bold"}}>👤 {inviteData.from} зовет вас!</div>
                    <div style={{display: "flex", gap: "8px"}}>
                      <button className="btn-primary btn-small" onClick={() => {
                        setRoomCode(code);
                        setRole("guest");
                        joinMatchRoom(code, userName, decisions, favorites, stopGenres).then(success => {
                          if (success) {
                            setScreen("swiping");
                            removeInvite(auth.currentUser.uid, code);
                          } else {
                            alert("Комната уже закрыта или не найдена");
                            removeInvite(auth.currentUser.uid, code);
                          }
                        });
                      }}>✅ Принять</button>
                      <button className="btn-secondary btn-small" onClick={() => {
                        removeInvite(auth.currentUser.uid, code);
                      }}>❌</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {screen === "create" && (
        <motion.div className="matchwatch-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>Создайте комнату</h2>
          <p style={{ color: "#aaa", fontSize: "0.9rem", marginBottom: "15px" }}>Что будете выбирать вместе?</p>
          
          <div className="category-picker">
            <button 
              className={`category-btn ${activeCategory === 'movie' ? 'active' : ''}`}
              onClick={() => setActiveCategory('movie')}
            >
              Фильмы
            </button>
            <button 
              className={`category-btn ${activeCategory === 'series' ? 'active' : ''}`}
              onClick={() => setActiveCategory('series')}
            >
              Сериалы
            </button>
            <button 
              className={`category-btn ${activeCategory === 'anime' ? 'active' : ''}`}
              onClick={() => setActiveCategory('anime')}
            >
              Аниме
            </button>
            <button 
              className={`category-btn ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              Всё
            </button>
          </div>

          <div className="form-group">
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Ваше имя" className="form-input" />
          </div>

          <button
            type="button"
            className="btn-secondary"
            style={{ width: "100%", marginBottom: "15px", background: "rgba(255,255,255,0.08)", border: "1px dashed rgba(255,255,255,0.25)" }}
            onClick={() => setShowFiltersModal(true)}
          >
            ⚙️ Настроить фильтры сессии {sessionFilters ? "(Применены)" : "(По умолчанию)"}
          </button>

          <div className="form-buttons">
            <button className="btn-primary" onClick={handleCreateRoom}>Создать</button>
            <button className="btn-secondary" onClick={() => setScreen("start")}>Назад</button>
          </div>
        </motion.div>
      )}

      {screen === "join" && (
        <motion.div className="matchwatch-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>Присоединиться</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "15px" }}>Введите 6-значный цифровой код комнаты:</p>
          <div className="form-group">
            <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Например: 482910" className="form-input code-input" maxLength="6" style={{ letterSpacing: "4px", fontSize: "1.4rem", textAlign: "center", fontWeight: "bold" }} />
          </div>
          <div className="form-group">
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Ваше имя" className="form-input" />
          </div>
          <div className="form-buttons">
            <button className="btn-primary" onClick={handleJoinRoom}>Войти в лобби</button>
            <button className="btn-secondary" onClick={() => setScreen("start")}>Назад</button>
          </div>
        </motion.div>
      )}

      {(screen === "waiting" || screen === "lobby") && (
        <MatchLobby
          roomCode={roomCode}
          roomData={roomData}
          role={role}
          userName={userName}
          currentUser={currentUser}
          friends={friends}
          friendAvatars={friendAvatars}
          onCancel={() => setScreen("start")}
        />
      )}

      {screen === "swiping" && renderSwipingScreen()}

      {matchQueue.length > 0 && createPortal(
        <div className="match-screen-overlay">
          <motion.div className="matchwatch-form match-modal-content" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <h1 style={{ color: "#ff8a50", textAlign: "center", marginBottom: "15px" }}>У ВАС СОВПАДЕНИЕ! 🎉</h1>
            <ChamaBanner
              type="CROWN_CAPE"
              title="Королевский выбор!"
              text="Вы оба выбрали этот фильм! Чама аплодирует вашему совпадению 👑"
              size="large"
              className="mb-4"
            />
            <div className="match-movie" style={{ textAlign: "center" }}>
              <img 
                src={moviesById[matchQueue[0]]?.poster}
                alt="Match" 
                style={{ width: "200px", borderRadius: "12px", boxShadow: "0 10px 20px rgba(0,0,0,0.5)", margin: "0 auto", cursor: "pointer" }} 
                onClick={() => setShowDetails(matchQueue[0])}
              />
              <h2 style={{ marginTop: "15px" }}>{moviesById[matchQueue[0]]?.titleRu || moviesById[matchQueue[0]]?.title}</h2>
              <p>Приятного просмотра!</p>
            </div>
            <button className="btn-secondary" style={{ width: "100%", marginTop: "20px", marginBottom: "10px" }} onClick={() => setShowDetails(matchQueue[0])}>Подробнее о фильме</button>
            <button className="btn-primary" style={{ width: "100%", marginBottom: "10px" }} onClick={() => {
              handleExtendDeck();
              setMatchQueue(prev => prev.slice(1));
            }}>Продолжить выбор (+25 фильмов) 🚀</button>

            <button
              className="btn-secondary"
              onClick={() => {
                handleExtendDeck();
                setScreen("swiping");
              }}
            >
              ➕ Пролистать еще +25 фильмов
            </button>
            <button className="btn-secondary" style={{ width: "100%", background: "rgba(255,255,255,0.05)" }} onClick={() => { setMatchQueue([]); setScreen("recap"); }}>К итогам сессии 📊</button>
          </motion.div>
        </div>,
        document.body
      )}

      {screen === "recap" && (
        <motion.div className="matchwatch-form" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ maxWidth: "550px", width: "100%" }}>
          <h2 style={{ textAlign: "center", margin: "0 0 10px 0" }}>📊 Итоги вашей сессии</h2>
          <p style={{ textAlign: "center", color: "#aaa", fontSize: "0.9rem", margin: "0 0 20px 0" }}>
            {roomData?.hostName || "Вы"} & {roomData?.guestName || "Партнер"}
          </p>

          {/* Movie Chemistry Indicator */}
          <div className="recap-chemistry-card" style={{ background: "linear-gradient(135deg, rgba(255,71,87,0.2), rgba(59,130,246,0.2))", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "18px", padding: "20px", textAlign: "center", marginBottom: "20px" }}>
            <span style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "2px", color: "rgba(255,255,255,0.7)" }}>Совместимость вкусов</span>
            <div style={{ fontSize: "3rem", fontWeight: "900", background: "linear-gradient(90deg, #ff4757, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "5px 0" }}>
              {Math.min(99, Math.max(65, Math.round(((notifiedMatchesRef.current.size || 1) / Math.max(1, swipeHistory.length)) * 100 + 55)))}%
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#ddd" }}>
              Совпало <strong>{notifiedMatchesRef.current.size}</strong> из {swipeHistory.length || sessionCap} просмотренных фильмов!
            </p>
          </div>

          {/* Matched Movies list */}
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem" }}>Найденные совпадения:</h3>
          {notifiedMatchesRef.current.size === 0 ? (
            <p style={{ textAlign: "center", color: "#aaa", padding: "15px" }}>В этой сессии совпадений пока нет. Нажмите «Еще +25 фильмов», чтобы продолжить выбор!</p>
          ) : (
            <div className="recap-matches-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "12px", maxHeight: "250px", overflowY: "auto", marginBottom: "20px" }}>
              {Array.from(notifiedMatchesRef.current).map((mId) => {
                const m = moviesById[mId];
                if (!m) return null;
                const isSelected = selectedMovieRecap?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setShowDetails(m.id)}
                    style={{
                      position: "relative",
                      borderRadius: "12px",
                      overflow: "hidden",
                      cursor: "pointer",
                      border: isSelected ? "2px solid #ff4757" : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: isSelected ? "0 0 15px rgba(255,71,87,0.6)" : "none",
                      transform: isSelected ? "scale(1.05)" : "scale(1)",
                      transition: "all 0.2s"
                    }}
                  >
                    <img src={m.poster} alt={m.title} style={{ width: "100%", height: "140px", objectFit: "cover" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.9))", padding: "6px 4px", textAlign: "center" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{m.titleRu || m.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {notifiedMatchesRef.current.size > 0 && (
              <button
                className="btn-primary"
                onClick={() => {
                  const matchesArr = Array.from(notifiedMatchesRef.current).map(id => moviesById[id]).filter(Boolean);
                  const randomMovie = matchesArr[Math.floor(Math.random() * matchesArr.length)];
                  setSelectedMovieRecap(randomMovie);
                  triggerHaptic("medium");
                  setShowDetails(randomMovie.id);
                }}
              >
                🎲 Что смотрим сегодня? (Рулетка)
              </button>
            )}

            <button
              className="btn-secondary"
              onClick={() => {
                handleExtendDeck();
                setScreen("swiping");
              }}
            >
              ➕ Пролистать еще +25 фильмов
            </button>

            <button
              className="btn-secondary"
              onClick={() => shareTelegramRoom(roomCode)}
              style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)" }}
            >
              📱 Поделиться в Telegram
            </button>

            <button className="btn-secondary" style={{ opacity: 0.7 }} onClick={() => setScreen("start")}>
              В главное меню
            </button>
          </div>
        </motion.div>
      )}

      {screen === "history" && (
        <motion.div className="matchwatch-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Вы выбирали</h2>
          {matchHistory.length === 0 ? (
            <p style={{ textAlign: "center", color: "#aaa" }}>История совпадений пуста.</p>
          ) : (
            <div className="history-list" style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "400px", overflowY: "auto", paddingRight: "5px" }}>
              {matchHistory.map(item => {
                const m = moviesById[item.movieId];
                if (!m) return null;
                return (
                  <div key={item.id} className="history-item" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "12px", cursor: "pointer", transition: "background 0.2s" }} onClick={() => setShowDetails(item.movieId)} onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.05)"}>
                    <img src={m.poster} alt={m.title} style={{ width: "50px", height: "75px", objectFit: "cover", borderRadius: "6px", marginRight: "15px" }} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: "0 0 5px 0", fontSize: "1rem" }}>{m.titleRu || m.title}</h4>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#666", lineHeight: "1.25", overflow: "hidden", display: "-webkit-box", "-webkit-line-clamp": 3, "-webkit-box-orient": "vertical" }}>С кем: <strong>{item.partner}</strong> • {item.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button className="btn-secondary" style={{ width: "100%", marginTop: "20px" }} onClick={() => setScreen("start")}>Назад</button>
        </motion.div>
      )}

      {showDetails && (
        <DetailedMovieModal 
          movie={moviesById[(typeof showDetails === 'number' ? showDetails : matchQueue[0])]}
          onClose={() => setShowDetails(false)} 
          isLiked={decisions?.[typeof showDetails === 'number' ? showDetails : matchQueue[0]] === "like"}
          onToggleLike={onToggleLike}
          isFavorite={favorites?.[typeof showDetails === 'number' ? showDetails : matchQueue[0]]}
          onToggleFavorite={onToggleFavorite}
          rating={ratings?.[typeof showDetails === 'number' ? showDetails : matchQueue[0]]}
          onSetRating={onSetRating}
        />
      )}

      <SessionFiltersModal
        isOpen={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        initialFilters={sessionFilters}
        onApply={(filters) => setSessionFilters(filters)}
      />

      <AnimatePresence>
        {requireAuthModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} style={{ maxWidth: "440px", textAlign: "center" }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#ff8a50" }}>🔐 Вход в аккаунт обязателен</h3>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.95rem", lineHeight: "1.4", marginBottom: "20px" }}>
                Создание и подключение к совместным комнатам доступно только авторизованным пользователям. Пожалуйста, войдите в свой аккаунт в разделе <b>Профиль</b>!
              </p>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn-glass-secondary" style={{ flex: 1 }} onClick={() => setRequireAuthModal(false)}>
                  Отмена
                </button>
                <button 
                  className="btn-glass-primary" 
                  style={{ flex: 1 }} 
                  onClick={() => {
                    setRequireAuthModal(false);
                    window.dispatchEvent(new CustomEvent("switch-tab", { detail: "profile" }));
                  }}
                >
                  🔑 В Профиль
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
