import { useState } from "react";
import { motion } from "framer-motion";
import { createMatchRoom } from "../firebase";

export default function MatchWatch() {
  const [screen, setScreen] = useState("start"); // start, create, join, swiping
  const [roomCode, setRoomCode] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");

  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      alert("Пожалуйста, введите ваше имя");
      return;
    }
    const code = await createMatchRoom(userName);
    setRoomCode(code);
    setScreen("swiping");
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim() || !userName.trim()) {
      alert("Пожалуйста, введите код комнаты и ваше имя");
      return;
    }
    setScreen("swiping");
  };

  return (
    <div className="matchwwatch-container">
      {screen === "start" && (
        <motion.div
          className="matchwwatch-start"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h2 className="matchwwatch-title">
            <span style={{ fontSize: "3rem" }}>❤️</span>
            <br />
            MatchWatch
          </h2>
          <p className="matchwwatch-subtitle">
            Найдите фильм, который нравится вам обоим!
          </p>

          <div className="matchwwatch-buttons">
            <button
              className="btn-matchwwatch btn-create"
              onClick={() => setScreen("create")}
            >
              🎬 Создать комнату
            </button>
            <button
              className="btn-matchwwatch btn-join"
              onClick={() => setScreen("join")}
            >
              🔗 Присоединиться к комнате
            </button>
          </div>
        </motion.div>
      )}

      {screen === "create" && (
        <motion.div
          className="matchwwatch-form"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h2>Создайте комнату</h2>
          <div className="form-group">
            <label>Ваше имя:</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Введите ваше имя"
              className="form-input"
            />
          </div>

          <div className="form-buttons">
            <button className="btn-primary" onClick={handleCreateRoom}>
              Создать комнату
            </button>
            <button className="btn-secondary" onClick={() => setScreen("start")}>
              Назад
            </button>
          </div>
        </motion.div>
      )}

      {screen === "join" && (
        <motion.div
          className="matchwwatch-form"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h2>Присоединитесь к комнате</h2>
          <div className="form-group">
            <label>Код комнаты:</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Введите код"
              className="form-input code-input"
              maxLength="6"
            />
          </div>
          <div className="form-group">
            <label>Ваше имя:</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Введите ваше имя"
              className="form-input"
            />
          </div>

          <div className="form-buttons">
            <button className="btn-primary" onClick={handleJoinRoom}>
              Присоединиться
            </button>
            <button className="btn-secondary" onClick={() => setScreen("start")}>
              Назад
            </button>
          </div>
        </motion.div>
      )}

      {screen === "swiping" && (
        <motion.div
          className="matchwwatch-swiping"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="room-info">
            <h3>🔐 Код: {roomCode || "***"}</h3>
            <p>Пригласите друга, чтобы начать свайпить вместе!</p>
          </div>

          <div className="coming-soon">
            <p>🚀 Функция совместного свайпа будет доступна с интеграцией Firebase</p>
            <p>Вскоре вы сможете:</p>
            <ul>
              <li>Свайпить фильмы вместе в реальном времени</li>
              <li>Видеть, какие фильмы нравятся вам обоим</li>
              <li>Получить уведомление при совпадении лайков</li>
              <li>Создать список фильмов для совместного просмотра</li>
            </ul>
          </div>

          <button className="btn-secondary" onClick={() => setScreen("start")}>
            ← Назад
          </button>
        </motion.div>
      )}
    </div>
  );
}
