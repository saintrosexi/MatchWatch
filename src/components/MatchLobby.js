import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { setParticipantReady, startMatchRoomSession, inviteToMatchWatch } from "../firebase";
import { shareTelegramRoom, triggerHaptic } from "../tma";
import { ChamaBanner } from "../chamaAssets";

export default function MatchLobby({
  roomCode,
  roomData,
  role,
  userName,
  currentUser,
  friends = {},
  friendAvatars = {},
  onCancel
}) {
  const [copied, setCopied] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const isHost = role === "host";
  const hostName = roomData?.hostName || userName || "Хост";
  const guestName = roomData?.guestName || null;

  const hostReady = !!roomData?.hostReady;
  const guestReady = !!roomData?.guestReady;

  const myReady = isHost ? hostReady : guestReady;
  const partnerReady = isHost ? guestReady : hostReady;
  const bothReady = hostReady && guestReady && !!guestName;

  const handleToggleReady = async () => {
    triggerHaptic("light");
    const nextState = !myReady;
    await setParticipantReady(roomCode, role, nextState);
  };

  const handleStartSession = async () => {
    if (!isHost || !bothReady || isStarting) return;
    setIsStarting(true);
    triggerHaptic("heavy");
    try {
      await startMatchRoomSession(roomCode);
    } catch (err) {
      console.error("Error starting match session:", err);
      setIsStarting(false);
    }
  };

  return (
    <motion.div
      className="matchwatch-form match-lobby-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ maxWidth: "520px", width: "100%", margin: "0 auto" }}
    >
      <div style={{ textAlign: "center", marginBottom: "15px" }}>
        <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "1.5px" }}>
          Лобби ожидания
        </span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "6px" }}>
          <h1 className="room-code-header" style={{ color: "#ff8a50", letterSpacing: "6px", margin: 0, fontSize: "2.5rem" }}>
            {roomCode}
          </h1>
          <button
            className="btn-matchwatch-secondary"
            onClick={() => {
              navigator.clipboard.writeText(roomCode);
              setCopied(true);
              triggerHaptic("medium");
              setTimeout(() => setCopied(false), 2000);
            }}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "white",
              padding: "10px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px"
            }}
            title="Скопировать 6-значный код"
          >
            {copied ? "✅" : "📋"}
          </button>
        </div>
        {copied && <p style={{ color: "#4caf50", fontSize: "0.85rem", margin: "4px 0" }}>Код скопирован!</p>}
      </div>

      <ChamaBanner
        type="FILM_REEL"
        title="Ожидание участников..."
        text="Когда оба нажмут «Готов», хост сможет запустить совместный выбор карточек!"
        size="small"
        className="mb-4"
      />

      {/* Participants Card */}
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "16px", padding: "16px", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.1)" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", color: "rgba(255,255,255,0.8)" }}>Участники:</h3>
        
        {/* Host row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: "12px", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.2rem" }}>👑</span>
            <div>
              <div style={{ fontWeight: "bold" }}>{hostName} <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>(Хост)</span></div>
            </div>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold", background: hostReady ? "rgba(76, 175, 80, 0.2)" : "rgba(255, 255, 255, 0.1)", color: hostReady ? "#4caf50" : "#aaa", border: hostReady ? "1px solid rgba(76, 175, 80, 0.4)" : "none" }}>
            {hostReady ? "ГОТОВ ✅" : "НЕ ГОТОВ ⏳"}
          </div>
        </div>

        {/* Guest row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.2rem" }}>🍿</span>
            <div>
              {guestName ? (
                <div style={{ fontWeight: "bold" }}>{guestName}</div>
              ) : (
                <div style={{ color: "#aaa", fontStyle: "italic" }}>Ожидание подключения...</div>
              )}
            </div>
          </div>
          {guestName ? (
            <div style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold", background: guestReady ? "rgba(76, 175, 80, 0.2)" : "rgba(255, 255, 255, 0.1)", color: guestReady ? "#4caf50" : "#aaa", border: guestReady ? "1px solid rgba(76, 175, 80, 0.4)" : "none" }}>
              {guestReady ? "ГОТОВ ✅" : "НЕ ГОТОВ ⏳"}
            </div>
          ) : (
            <div style={{ fontSize: "0.8rem", color: "#aaa" }}>Ждём...</div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <button
          className={myReady ? "btn-secondary" : "btn-primary"}
          onClick={handleToggleReady}
          style={{ width: "100%", padding: "14px", fontSize: "1rem", borderRadius: "14px" }}
        >
          {myReady ? "❌ Снять статус готовности" : "✅ Я готов!"}
        </button>

        {isHost && (
          <button
            className="btn-primary"
            disabled={!bothReady || isStarting}
            onClick={handleStartSession}
            style={{
              width: "100%",
              padding: "16px",
              fontSize: "1.1rem",
              borderRadius: "14px",
              background: bothReady ? "linear-gradient(135deg, #ff8a50, #ff5e62)" : "rgba(255,255,255,0.1)",
              color: bothReady ? "#fff" : "rgba(255,255,255,0.4)",
              cursor: bothReady ? "pointer" : "not-allowed",
              boxShadow: bothReady ? "0 8px 25px rgba(255,138,80,0.4)" : "none"
            }}
          >
            {isStarting ? "Запуск сессии..." : bothReady ? "🚀 Начать свайпать!" : "Ожидайте готовности обоих..."}
          </button>
        )}

        {!guestName && (
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              className="btn-secondary"
              style={{ flex: 1, padding: "10px" }}
              onClick={() => setShowInviteModal(true)}
            >
              ➕ Позвать друга
            </button>
            <button
              className="btn-telegram-glass"
              style={{ flex: 1, padding: "10px" }}
              onClick={() => shareTelegramRoom(roomCode)}
            >
              ✈️ В Telegram
            </button>
          </div>
        )}

        <button className="btn-secondary" style={{ width: "100%", marginTop: "10px" }} onClick={onCancel}>
          Выйти из комнаты
        </button>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="invite-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="invite-modal-content" onClick={e => e.stopPropagation()}>
            <div className="invite-modal-header">
              <h3>Ваши друзья</h3>
              <button className="close-btn modal-close-btn" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>
            <div className="friends-invite-list-scroll">
              {Object.keys(friends).length === 0 ? (
                <p style={{ textAlign: "center", padding: "20px", color: "#aaa" }}>Список друзей пуст</p>
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
                      className="btn btn-primary btn-small"
                      onClick={async () => {
                        try {
                          await inviteToMatchWatch(uid, roomCode, currentUser?.displayName || currentUser?.email);
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
  );
}
