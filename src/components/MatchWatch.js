import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createMatchRoom, joinMatchRoom, swipeMovie, subscribeToRoom } from "../firebase";
import { movies } from "../data";
import SwipeCard from "./SwipeCard";
import DetailedMovieModal from "./DetailedMovieModal";

export default function MatchWatch() {
  const [screen, setScreen] = useState("start");
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState(null); // 'host' or 'guest'
  const [roomData, setRoomData] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [swipeHint, setSwipeHint] = useState({ x: 0, active: false });

  // Подписка на изменения в комнате
  useEffect(() => {
    if (!roomCode || screen === "start" || screen === "create" || screen === "join") return;
    
    const unsubscribe = subscribeToRoom(roomCode, (data) => {
      if (data) {
        setRoomData(data);
        if (data.status === 'active' && screen === 'waiting') {
          setScreen('swiping');
        }
        if (data.match && screen !== 'match') {
          setScreen('match');
        }
      }
    });
    return () => unsubscribe();
  }, [roomCode, screen]);

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
          <h2 className="matchwatch-title">
            <span style={{ fontSize: "3rem" }}>❤️</span><br />MatchWatch
          </h2>
          <p className="matchwatch-subtitle">Синхронный поиск фильма для двоих!</p>
          <div className="matchwatch-buttons">
            <button className="btn-matchwatch btn-create" onClick={() => setScreen("create")}>🎬 Создать комнату</button>
            <button className="btn-matchwatch btn-join" onClick={() => setScreen("join")}>🔗 Присоединиться</button>
          </div>
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
            <h1 style={{ fontSize: "3rem", color: "#ff8a50", letterSpacing: "5px" }}>{roomCode}</h1>
          </div>
          <button className="btn-secondary" onClick={() => setScreen("start")}>Отмена</button>
        </motion.div>
      )}

      {screen === "swiping" && (
        <motion.div className="matchwatch-swiping" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="room-header" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Комната: <strong>{roomCode}</strong></span>
            <span>{roomData?.hostName} & {roomData?.guestName || '...'}</span>
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
        <>
          <motion.div className="matchwatch-form" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
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
        </>
      )}
    </div>
  );
}
