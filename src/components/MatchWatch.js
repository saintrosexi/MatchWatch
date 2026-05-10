import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { auth, database, createMatchRoom, joinMatchRoom, swipeMovie, subscribeToRoom, inviteToMatchWatch, removeInvite } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, set, onValue } from "firebase/database";
import { movies } from "../data";
import SwipeCard from "./SwipeCard";
import DetailedMovieModal from "./DetailedMovieModal";

export default function MatchWatch({ onLike, initialRoomCode, onClearInitialRoomCode, hostRoomCode, onClearHostRoomCode, invites = {} }) {
  const [screen, setScreen] = useState("start");
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState(null); // 'host' or 'guest'
  const [roomData, setRoomData] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [swipeHint, setSwipeHint] = useState({ x: 0, active: false });
  const [matchHistory, setMatchHistory] = useState(() => {
    const saved = localStorage.getItem("matchwatch_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [copied, setCopied] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (user.displayName && !userName) {
          setUserName(user.displayName);
        }
        const userRef = ref(database, `users/${user.uid}/matchHistory`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setMatchHistory(data);
          }
        }, { onlyOnce: true });
      }
    });
    return () => unsubscribe();
  }, [userName]);

  const [friends, setFriends] = useState({});

  useEffect(() => {
    if (auth.currentUser && database) {
      set(ref(database, `users/${auth.currentUser.uid}/matchHistory`), matchHistory);
    }
  }, [matchHistory]);

  useEffect(() => {
    if (auth.currentUser && database) {
      const unsubscribe = onValue(ref(database, `users/${auth.currentUser.uid}/friends`), snap => {
        setFriends(snap.val() || {});
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (initialRoomCode && userName) {
      setRoomCode(initialRoomCode);
      setRole("guest");
      joinMatchRoom(initialRoomCode, userName).then(success => {
        if (success) {
          setScreen("swiping");
        } else {
          alert("Не удалось присоединиться");
          setScreen("start");
        }
        if (onClearInitialRoomCode) onClearInitialRoomCode();
      });
    }
  }, [initialRoomCode, userName, onClearInitialRoomCode]);

  useEffect(() => {
    if (hostRoomCode && userName) {
      setRoomCode(hostRoomCode);
      setRole("host");
      setScreen("waiting");
      if (onClearHostRoomCode) onClearHostRoomCode();
    }
  }, [hostRoomCode, userName, onClearHostRoomCode]);

  // Подписка на изменения в комнате
  useEffect(() => {
    if (!roomCode || screen === "start" || screen === "create" || screen === "join" || screen === "history") return;
    
    const unsubscribe = subscribeToRoom(roomCode, (data) => {
      if (data) {
        setRoomData(data);
        if (data.status === 'active' && screen === 'waiting') {
          setScreen('swiping');
        }
        if (data.match && screen !== 'match') {
          setScreen('match');
          
          // Сохраняем в историю
          const partnerName = role === 'host' ? data.guestName : data.hostName;
          const newMatch = {
            id: Date.now(),
            movieId: data.match,
            partner: partnerName || 'Неизвестный',
            date: new Date().toLocaleDateString()
          };
          
          setMatchHistory(prev => {
            // Проверяем, нет ли уже такого совпадения в этой сессии (по roomCode или времени)
            if (prev.some(m => m.movieId === data.match && m.partner === partnerName)) return prev;
            const updated = [newMatch, ...prev];
            localStorage.setItem("matchwatch_history", JSON.stringify(updated));
            return updated;
          });
        }
      }
    });
    return () => unsubscribe();
  }, [roomCode, screen, role]);

  const handleCreateRoom = async () => {
    if (!userName.trim()) return alert("Введите ваше имя");
    const code = await createMatchRoom(userName, movies.length);
    if (code) {
      setRoomCode(code);
      setRole("host");
      setScreen("waiting");
    } else {
      alert("Ошибка подключения к базе данных. Проверьте настройки Firebase.");
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim() || !userName.trim()) return alert("Введите код и имя");
    const success = await joinMatchRoom(roomCode, userName);
    if (success) {
      setRole("guest");
      setScreen("swiping");
    } else {
      alert("Комната не найдена или ошибка подключения.");
    }
  };

  const handleSwipe = (dir, movie) => {
    const decision = dir === "right" ? "like" : "dislike";
    swipeMovie(roomCode, role, movie.id, decision);
    if (decision === "like" && onLike) {
      onLike(movie.id);
    }
    setSwipeHint({ x: 0, active: false });
    setCursor(prev => prev + 1);
  };

  // deck хранит movie IDs — находим фильм по ID
  const currentMovieId = roomData && roomData.deck && cursor < roomData.deck.length
    ? roomData.deck[cursor]
    : null;
  const currentMovie = currentMovieId ? movies.find(m => m.id === currentMovieId) : null;

  // Следующий фильм для стопки
  const nextMovieId = roomData && roomData.deck && cursor + 1 < roomData.deck.length
    ? roomData.deck[cursor + 1]
    : null;
  const nextMovie = nextMovieId ? movies.find(m => m.id === nextMovieId) : null;

  return (
    <div className="matchwatch-container">
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
                        joinMatchRoom(code, userName).then(success => {
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
              <h1 style={{ fontSize: "3rem", color: "#ff8a50", letterSpacing: "5px", margin: 0 }}>{roomCode}</h1>
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

          {/* Friends Invite Modal */}
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
                          <div className="friend-avatar-mini">{tag[0].toUpperCase()}</div>
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
        <motion.div className="matchwatch-swiping" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="room-header-compact matchwatch-swiping-header">
            <div className="room-info-item">Комната: <strong className="room-code-tag">{roomCode}</strong></div>
            <div className="room-info-item users-line">{roomData?.hostName} & {roomData?.guestName || '...'}</div>
          </div>
          
          <div className="swipe-wrapper">
            {/* Подсказки лайк/дизлайк */}
            <div className="swipe-hints" aria-hidden="true">
              <div
                className="swipe-hint-icon swipe-hint-icon--dislike"
                style={{
                  opacity: swipeHint.active ? Math.min(1, Math.max(0, -swipeHint.x / 120)) : 0,
                  transform: `translateY(-50%) scale(${0.95 + Math.min(0.15, Math.max(0, -swipeHint.x / 600))})`
                }}
              >
                ✕
              </div>
              <div
                className="swipe-hint-icon swipe-hint-icon--like"
                style={{
                  opacity: swipeHint.active ? Math.min(1, Math.max(0, swipeHint.x / 120)) : 0,
                  transform: `translateY(-50%) scale(${0.95 + Math.min(0.15, Math.max(0, swipeHint.x / 600))})`
                }}
              >
                ❤️
              </div>
            </div>

            <div className="deck-container">
              {/* Следующая карточка (фон) */}
              {nextMovie && (
                <div className="deck-card deck-position-1" style={{ zIndex: 0 }}>
                  <div className="card-placeholder">
                    <img src={nextMovie.poster} alt={nextMovie.titleRu || nextMovie.title} />
                    <div className="placeholder-overlay" />
                  </div>
                </div>
              )}
              
              {/* Текущая карточка */}
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
                  <h2>Фильмы закончились!</h2>
                  <p>Ждем, пока партнер досмотрит свой список...</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {screen === "match" && roomData?.match && (
        <div className="match-screen-overlay">
          <motion.div className="matchwatch-form match-modal-content" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <h1 style={{ color: "#ff8a50", textAlign: "center", marginBottom: "20px" }}>У ВАС СОВПАДЕНИЕ! 🎉</h1>
            <div className="match-movie" style={{ textAlign: "center" }}>
              <img 
                src={movies.find(m => m.id === roomData.match)?.poster} 
                alt="Match" 
                style={{ width: "200px", borderRadius: "12px", boxShadow: "0 10px 20px rgba(0,0,0,0.5)", margin: "0 auto", cursor: "pointer" }} 
                onClick={() => setShowDetails(true)}
              />
              <h2 style={{ marginTop: "15px" }}>{movies.find(m => m.id === roomData.match)?.titleRu || movies.find(m => m.id === roomData.match)?.title}</h2>
              <p>Приятного просмотра!</p>
            </div>
            <button className="btn-secondary" style={{ width: "100%", marginTop: "20px", marginBottom: "10px" }} onClick={() => setShowDetails(true)}>Подробнее о фильме</button>
            <button className="btn-primary" style={{ width: "100%" }} onClick={() => setScreen("start")}>Завершить</button>
          </motion.div>
          {showDetails && (
            <DetailedMovieModal 
              movie={movies.find(m => m.id === roomData.match)} 
              onClose={() => setShowDetails(false)} 
            />
          )}
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
                const m = movies.find(x => x.id === item.movieId);
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

      {showDetails && typeof showDetails === 'number' && (
        <DetailedMovieModal 
          movie={movies.find(m => m.id === showDetails)} 
          onClose={() => setShowDetails(false)} 
        />
      )}
    </div>
  );
}
