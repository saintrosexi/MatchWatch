import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { auth, database, createMatchRoom, joinMatchRoom, swipeMovie, subscribeToRoom, inviteToMatchWatch, removeInvite, removeSwipe } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get } from "firebase/database";
import { movies, moviesById } from "../data";
import SwipeCard from "./SwipeCard";
import DetailedMovieModal from "./DetailedMovieModal";

export default function MatchWatch({ onLike, initialRoomCode, onClearInitialRoomCode, hostRoomCode, onClearHostRoomCode, invites = {}, decisions = {}, onToggleLike, disableOnboarding = false, favorites, onToggleFavorite, ratings, onSetRating, stopGenres = [] }) {
  const [screen, setScreen] = useState("start");
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState(null); // 'host' or 'guest'
  const [roomData, setRoomData] = useState(null);
  
  // NO MORE CURSOR. We use a local swipe history to optimistically hide cards we just swiped.
  const [swipeHistory, setSwipeHistory] = useState([]);
  
  const [showDetails, setShowDetails] = useState(false);
  const [swipeHint, setSwipeHint] = useState({ x: 0, active: false });
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
      const currentRole = roleRef.current;
      
      if (data.status === "active" && currentScreen === "waiting") {
        setScreen("swiping");
      }

      const hostLikes = data.hostLikes || {};
      const guestLikes = data.guestLikes || {};
      const hostDecisions = data.hostDecisions || {};
      const guestDecisions = data.guestDecisions || {};

      const deckIds = data.deck || [];
      const deckArray = Array.isArray(deckIds) ? deckIds : Object.values(deckIds);

      const allMatches = [];
      deckArray.forEach(id => {
        if (!id) return;
        const movieId = parseInt(id);
        const hostLiked = hostLikes[movieId] === true || hostDecisions[movieId] === "like";
        const guestLiked = guestLikes[movieId] === true || guestDecisions[movieId] === "like";

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
            const partner = currentRole === "host" ? (data.guestName || "Партнер") : (data.hostName || "Партнер");
            
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
          newMatches.forEach(id => notifiedMatchesRef.current.add(id));
          setMatchQueue(prev => {
            const filtered = newMatches.filter(id => !prev.includes(id));
            return [...prev, ...filtered];
          });

          setMatchHistory(prev => {
            const safePrev = Array.isArray(prev) ? [...prev] : [];
            const partner = currentRole === "host" ? (data.guestName || "Партнер") : (data.hostName || "Партнер");

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

  const handleCreateRoom = async () => {
    if (!userName.trim()) return alert("Введите имя");
    
    // Фильтруем ID только для выбранной категории
    const categoryIds = movies.reduce((acc, m) => {
      if (activeCategory === 'all' || (m.type || "movie") === activeCategory) {
        acc.push(m.id);
      }
      return acc;
    }, []);
    
    if (categoryIds.length === 0) {
      return alert("В этой категории пока нет фильмов! Пожалуйста, выберите другую.");
    }
      
    const code = await createMatchRoom(userName, categoryIds, decisions, favorites, stopGenres);
    setRoomCode(code);
    setRole("host");
    setScreen("waiting");
    setSessionTutorialSeen(false);
  };

  const handleJoinRoom = async () => {
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
    setSwipeHint({ x: 0, active: false });
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
        <div className="matchwatch-swiping" style={{ width: "100%", height: "100%", minHeight: "600px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: "80px" }}>
          <div className="room-header-compact matchwatch-swiping-header">
            <div className="room-info-item">Комната: <strong className="room-code-tag">{roomCode}</strong></div>
            <div className="room-info-item users-line">{roomData?.hostName} & {roomData?.guestName || '...'}</div>
          </div>
          
          <div className="swipe-wrapper">
            <div className="swipe-hints" aria-hidden="true">
              <div
                className="swipe-hint-icon swipe-hint-icon--dislike"
                style={{
                  opacity: swipeHint.active ? Math.min(1, Math.max(0, -swipeHint.x / 120)) : 0,
                  transform: `translateY(-50%) scale(${0.95 + Math.min(0.15, Math.max(0, -swipeHint.x / 600))})`
                }}
              >
                ✕
                <span className="swipe-hint-text">Пропустить</span>
              </div>
              <div
                className="swipe-hint-icon swipe-hint-icon--like"
                style={{
                  opacity: swipeHint.active ? Math.min(1, Math.max(0, swipeHint.x / 120)) : 0,
                  transform: `translateY(-50%) scale(${0.95 + Math.min(0.15, Math.max(0, swipeHint.x / 600))})`
                }}
              >
                ❤️
                <span className="swipe-hint-text">Нравится</span>
              </div>
            </div>

            <div className="deck-container">
              {!roomData || !roomData.deck ? (
                <div className="empty-profile" style={{ textAlign: "center", marginTop: "40px" }}>
                  <div className="premium-loader" style={{ margin: "0 auto 20px auto" }} />
                  <p style={{ color: "rgba(255,255,255,0.6)" }}>Загрузка карточек комнаты...</p>
                </div>
              ) : showTutorial ? (
                <div className="deck-card deck-position-0" style={{ zIndex: 100 }}>
                  <SwipeCard 
                    isTutorial={true} 
                    onSwipe={() => setSessionTutorialSeen(true)} 
                    onDragProgress={(x, active) => setSwipeHint({ x, active })}
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
                        <img src={nextMovie.poster} alt={nextMovie.titleRu || nextMovie.title} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "24px" }} />
                        <div className="placeholder-overlay" />
                      </div>
                    </motion.div>
                  )}
                  
                  {currentMovie ? (
                    <motion.div 
                      key={currentMovie.id}
                      className="deck-card deck-position-0" 
                      style={{ zIndex: 1, position: "absolute", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                      exit={{ x: swipeHint.x > 0 ? 1000 : -1000, opacity: 0, rotate: swipeHint.x > 0 ? 20 : -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <SwipeCard
                        movie={currentMovie}
                        onSwipe={handleSwipe}
                        onDragProgress={(x, active) => setSwipeHint({ x, active })}
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

            {!showTutorial && (
              <button 
                className="btn-floating-undo desktop-only" 
                onClick={handleUndo} 
                disabled={swipeHistory.length === 0}
                title="Отменить последний выбор"
              >
                ↩️
              </button>
            )}
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
            <button className="btn-matchwatch" onClick={() => setScreen("history")} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff" }}>📜 Вы выбирали</button>
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
          <div className="form-buttons">
            <button className="btn-primary" onClick={handleCreateRoom}>Создать</button>
            <button className="btn-secondary" onClick={() => setScreen("start")}>Назад</button>
          </div>
        </motion.div>
      )}

      {screen === "join" && (
        <motion.div className="matchwatch-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>Присоединиться</h2>
          <div className="form-group">
            <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="Код комнаты" className="form-input code-input" maxLength="6" />
          </div>
          <div className="form-group">
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Ваше имя" className="form-input" />
          </div>
          <div className="form-buttons">
            <button className="btn-primary" onClick={handleJoinRoom}>Войти</button>
            <button className="btn-secondary" onClick={() => setScreen("start")}>Назад</button>
          </div>
        </motion.div>
      )}

      {screen === "waiting" && (
        <motion.div className="matchwatch-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>Ожидание партнера...</h2>
          <div className="room-info" style={{ textAlign: "center", margin: "20px 0" }}>
            <p>Отправьте этот код другу:</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "15px", margin: "10px 0" }}>
              <h1 className="room-code-header" style={{ color: "#ff8a50", letterSpacing: "5px", margin: 0 }}>{roomCode}</h1>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(roomCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{ 
                  background: "rgba(255,255,255,0.1)", border: "none", color: "white", 
                  padding: "12px", borderRadius: "50%", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", width: "48px", height: "48px"
                }}
                title="Скопировать"
              >
                {copied ? "✅" : "📋"}
              </button>
            </div>
            {copied && <p style={{ color: "#4caf50", fontSize: "0.9rem", margin: "5px 0" }}>Код скопирован!</p>}
            
            <button 
              className="btn-primary" 
              style={{ marginTop: "20px", width: "100%" }}
              onClick={() => setShowInviteModal(true)}
            >
              ➕ Пригласить друга
            </button>
          </div>
          <button className="btn-secondary" style={{ width: "100%" }} onClick={() => setScreen("start")}>Отмена</button>

          {showInviteModal && (
            <div className="invite-modal-overlay" onClick={() => setShowInviteModal(false)}>
              <div className="invite-modal-content" onClick={e => e.stopPropagation()}>
                <div className="invite-modal-header">
                  <h3>Ваши друзья</h3>
                  <button className="close-modal" onClick={() => setShowInviteModal(false)}>✕</button>
                </div>
                <div className="friends-invite-list-scroll">
                  {Object.keys(friends).length === 0 ? (
                    <p style={{textAlign: "center", padding: "20px", color: "#aaa"}}>Список друзей пуст</p>
                  ) : (
                    Object.entries(friends).map(([uid, tag]) => (
                      <div key={uid} className="invite-friend-row">
                        <div className="friend-info-mini">
                          <div className="friend-avatar-mini">
                            {(friendAvatars[uid] && (friendAvatars[uid].startsWith("data:image/") || friendAvatars[uid].startsWith("http"))) ? (
                              <img src={friendAvatars[uid]} alt="Avatar" />
                            ) : (
                              friendAvatars[uid] || "😎"
                            )}
                          </div>
                          <span>{tag}</span>
                        </div>
                        <button 
                          className="btn-invite-action"
                          onClick={async () => {
                            try {
                              await inviteToMatchWatch(uid, roomCode, auth.currentUser.displayName || auth.currentUser.email);
                              alert(`Приглашение отправлено ${tag}!`);
                            } catch (e) {
                              alert(e.message);
                            }
                          }}
                        >
                          Позвать
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {screen === "swiping" && renderSwipingScreen()}

      {matchQueue.length > 0 && createPortal(
        <div className="match-screen-overlay">
          <motion.div className="matchwatch-form match-modal-content" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <h1 style={{ color: "#ff8a50", textAlign: "center", marginBottom: "20px" }}>У ВАС СОВПАДЕНИЕ! 🎉</h1>
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
            <button className="btn-primary" style={{ width: "100%", marginBottom: "10px" }} onClick={() => setMatchQueue(prev => prev.slice(1))}>Продолжить выбор</button>
            <button className="btn-secondary" style={{ width: "100%", background: "rgba(255,255,255,0.05)" }} onClick={() => { setMatchQueue([]); setScreen("start"); }}>Завершить</button>
          </motion.div>
        </div>,
        document.body
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
    </div>
  );
}
