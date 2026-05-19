import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { auth, database, createMatchRoom, joinMatchRoom, swipeMovie, subscribeToRoom, inviteToMatchWatch, removeInvite, removeSwipe } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get } from "firebase/database";
import { movies, moviesById } from "../data";
import SwipeCard from "./SwipeCard";
import DetailedMovieModal from "./DetailedMovieModal";

const normalizeStopGenres = (sg) => {
  if (!sg) return [];
  let arr = [];
  if (Array.isArray(sg)) {
    arr = sg;
  } else if (typeof sg === 'object') {
    arr = Object.values(sg);
  } else if (typeof sg === 'string') {
    arr = [sg];
  }
  return arr.filter(item => typeof item === 'string' && item.trim() !== "");
};

const isMovieGenreStopped = (genresStr, stopGenres) => {
  if (!genresStr || !stopGenres) return false;
  const normalizedStop = normalizeStopGenres(stopGenres).map(g => g.toLowerCase().trim());
  if (normalizedStop.length === 0) return false;
  
  const mGenres = genresStr.split(",").map(g => g.trim().toLowerCase());
  
  const expandedStop = new Set();
  normalizedStop.forEach(sg => {
    expandedStop.add(sg);
    if (sg.includes("ужас") || sg.includes("хоррор") || sg.includes("ужастик")) {
      expandedStop.add("ужасы");
      expandedStop.add("ужастики");
      expandedStop.add("хоррор");
      expandedStop.add("horror");
      expandedStop.add("мистика");
    }
    if (sg.includes("комеди")) {
      expandedStop.add("комедия");
      expandedStop.add("комедии");
      expandedStop.add("comedy");
    }
    if (sg.includes("драм")) {
      expandedStop.add("драма");
      expandedStop.add("драмы");
      expandedStop.add("drama");
    }
    if (sg.includes("боевик") || sg.includes("экшен") || sg.includes("action")) {
      expandedStop.add("боевик");
      expandedStop.add("боевики");
      expandedStop.add("экшен");
      expandedStop.add("action");
    }
    if (sg.includes("триллер") || sg.includes("thriller")) {
      expandedStop.add("триллер");
      expandedStop.add("триллеры");
      expandedStop.add("thriller");
    }
    if (sg.includes("фантастик") || sg.includes("sci-fi")) {
      expandedStop.add("фантастика");
      expandedStop.add("фэнтези");
      expandedStop.add("fantasy");
      expandedStop.add("sci-fi");
    }
    if (sg.includes("документал") || sg.includes("doc")) {
      expandedStop.add("документальный");
      expandedStop.add("документалка");
      expandedStop.add("documentary");
    }
  });
  
  return mGenres.some(mg => {
    return Array.from(expandedStop).some(esg => 
      mg.includes(esg) || esg.includes(mg)
    );
  });
};

export default function MatchWatch({ onLike, initialRoomCode, onClearInitialRoomCode, hostRoomCode, onClearHostRoomCode, invites = {}, decisions = {}, onToggleLike, disableOnboarding = false, favorites, onToggleFavorite, ratings, onSetRating, stopGenres = [] }) {
  const [screen, setScreen] = useState("start");
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState(null); // 'host' or 'guest'
  const [roomData, setRoomData] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [swipeHint, setSwipeHint] = useState({ x: 0, active: false });
  const [swipeHistory, setSwipeHistory] = useState([]);
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

  useEffect(() => {
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
    if (roomCode && (screen === "swiping" || screen === "waiting")) {
      const unsubscribe = subscribeToRoom(roomCode, (data) => {
        if (!data) return;
        setRoomData(data);
        
        if (data.status === "active" && screen === "waiting") {
          setScreen("swiping");
        }

        // Внедряем проверку на пересечение лайков (match) с учетом профильных решений и сессионных лайков
        const hostLikes = data.hostLikes || {};
        const guestLikes = data.guestLikes || {};
        const hostDecisions = data.hostDecisions || {};
        const guestDecisions = data.guestDecisions || {};

        const allLikedIds = new Set([
          ...Object.keys(hostLikes).filter(id => hostLikes[id] === true),
          ...Object.keys(hostDecisions).filter(id => hostDecisions[id] === "like"),
          ...Object.keys(guestLikes).filter(id => guestLikes[id] === true),
          ...Object.keys(guestDecisions).filter(id => guestDecisions[id] === "like")
        ]);

        const intersectionId = Array.from(allLikedIds).find(id => {
          const hostLiked = hostLikes[id] === true || hostDecisions[id] === "like";
          const guestLiked = guestLikes[id] === true || guestDecisions[id] === "like";
          return hostLiked && guestLiked;
        });

        const effectiveMatch = data.match || (intersectionId ? parseInt(intersectionId) : null);

        if (effectiveMatch && screen !== "match") {
          setScreen("match");
          setMatchHistory(prev => {
            const safePrev = Array.isArray(prev) ? prev : [];
            const exists = safePrev.find(h => h.movieId === effectiveMatch && h.date === new Date().toLocaleDateString());
            if (exists) return safePrev;
            const partner = role === "host" ? (data.guestName || "Партнер") : (data.hostName || "Партнер");
            const newHistory = [{
              id: Date.now(),
              movieId: effectiveMatch,
              partner: partner,
              date: new Date().toLocaleDateString()
            }, ...safePrev];
            localStorage.setItem("matchwatch_history", JSON.stringify(newHistory));
            return newHistory;
          });
        }
      });
      return () => unsubscribe();
    }
  }, [roomCode, screen, role]);

  useEffect(() => {
    if (currentUser) {
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
      
    const code = await createMatchRoom(userName, categoryIds, decisions, favorites);
    setRoomCode(code);
    setRole("host");
    setScreen("waiting");
    setSessionTutorialSeen(false);
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim() || !userName.trim()) return alert("Введите данные");
    const success = await joinMatchRoom(roomCode, userName, decisions, favorites);
    if (success) {
      setRole("guest");
      setScreen("swiping");
      setSessionTutorialSeen(false);
    } else {
      alert("Комната не найдена");
    }
  };

  const handleSwipe = (direction, movie) => {
    const decision = direction === "right" ? "like" : "dislike";
    swipeMovie(roomCode, role, movie.id, decision);
    setSwipeHistory((prev) => [...prev, movie.id]);
    setSwipeHint({ x: 0, active: false });
    setCursor((prev) => prev + 1);
  };

  useEffect(() => {
    // Reset hints whenever cursor changes (new card)
    setSwipeHint({ x: 0, active: false });
  }, [cursor]);

  const handleUndo = async () => {
    if (swipeHistory.length === 0) return;
    const lastMovieId = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory(prev => prev.slice(0, -1));
    setCursor(prev => Math.max(0, prev - 1));
    await removeSwipe(roomCode, role, lastMovieId);
  };

  const optimizedDeck = useMemo(() => {
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

    // Фильтруем только те карточки, которые текущий пользователь уже свайпнул в этой сессии
    const unswipedIds = cleanDeck.filter(movieId => myLikes[movieId] === undefined);

    // Объединяем историю и невыбранные для сохранения стабильности курсора
    return [...swipeHistory, ...unswipedIds];
  }, [roomData, role, swipeHistory]);

  const currentMovieId = cursor < optimizedDeck.length
    ? optimizedDeck[cursor]
    : null;
  const currentMovie = currentMovieId ? moviesById[currentMovieId] : null;

  const nextMovieId = cursor + 1 < optimizedDeck.length
    ? optimizedDeck[cursor + 1]
    : null;
  const nextMovie = nextMovieId ? moviesById[nextMovieId] : null;

  // Рассчитываем ID совпадения для отображения
  const matchId = roomData?.match || (roomData ? Object.keys(roomData.hostLikes || {}).find(id => 
    roomData.hostLikes[id] === true && (roomData.guestLikes || {})[id] === true
  ) : null);

  const showTutorial = !disableOnboarding && !sessionTutorialSeen;

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
                        joinMatchRoom(code, userName, decisions, favorites).then(success => {
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

      {screen === "swiping" && (
        <motion.div className="matchwatch-swiping" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: "80px" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
                <>
                  {nextMovie && (
                    <div className="deck-card deck-position-1" style={{ zIndex: 0 }}>
                      <div className="card-placeholder">
                        <img src={nextMovie.poster} alt={nextMovie.titleRu || nextMovie.title} />
                        <div className="placeholder-overlay" />
                      </div>
                    </div>
                  )}
                  
                  {currentMovie ? (
                    <div className="deck-card deck-position-0" style={{ zIndex: 1 }}>
                      <SwipeCard
                        key={currentMovie.id}
                        movie={currentMovie}
                        onSwipe={handleSwipe}
                        onDragProgress={(x, active) => setSwipeHint({ x, active })}
                      />
                    </div>
                  ) : (
                    <div className="empty-profile" style={{ textAlign: "center", marginTop: "100px" }}>
                      <h2>Карточки закончились!</h2>
                      <p>Ждем, пока партнер досмотрит свой список...</p>
                    </div>
                  )}
                </>
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
        </motion.div>
      )}

      {screen === "match" && matchId && (
        <div className="match-screen-overlay">
          <motion.div className="matchwatch-form match-modal-content" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <h1 style={{ color: "#ff8a50", textAlign: "center", marginBottom: "20px" }}>У ВАС СОВПАДЕНИЕ! 🎉</h1>
            <div className="match-movie" style={{ textAlign: "center" }}>
              <img 
                src={moviesById[parseInt(matchId)]?.poster} 
                alt="Match" 
                style={{ width: "200px", borderRadius: "12px", boxShadow: "0 10px 20px rgba(0,0,0,0.5)", margin: "0 auto", cursor: "pointer" }} 
                onClick={() => setShowDetails(parseInt(matchId))}
              />
              <h2 style={{ marginTop: "15px" }}>{moviesById[parseInt(matchId)]?.titleRu || moviesById[parseInt(matchId)]?.title}</h2>
              <p>Приятного просмотра!</p>
            </div>
            <button className="btn-secondary" style={{ width: "100%", marginTop: "20px", marginBottom: "10px" }} onClick={() => setShowDetails(parseInt(matchId))}>Подробнее о фильме</button>
            <button className="btn-primary" style={{ width: "100%" }} onClick={() => setScreen("start")}>Завершить</button>
          </motion.div>
        </div>
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
          movie={moviesById[(typeof showDetails === 'number' ? showDetails : parseInt(matchId))]} 
          onClose={() => setShowDetails(false)} 
          isLiked={decisions?.[typeof showDetails === 'number' ? showDetails : parseInt(matchId)] === "like"}
          onToggleLike={onToggleLike}
          isFavorite={favorites?.[typeof showDetails === 'number' ? showDetails : parseInt(matchId)]}
          onToggleFavorite={onToggleFavorite}
          rating={ratings?.[typeof showDetails === 'number' ? showDetails : parseInt(matchId)]}
          onSetRating={onSetRating}
        />
      )}
    </div>
  );
}
