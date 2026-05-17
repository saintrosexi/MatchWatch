import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { auth, database, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get } from "firebase/database";

export default function Friends({ onViewProfile }) {
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState({});
  const [friendRequests, setFriendRequests] = useState({});
  const [friendTagInput, setFriendTagInput] = useState("");
  const [friendError, setFriendError] = useState("");
  const [friendSuccess, setFriendSuccess] = useState("");
  const [friendAvatars, setFriendAvatars] = useState({});

  useEffect(() => {
    const fetchAvatars = async () => {
      const avatars = {};
      for (const uid of Object.keys(friends)) {
        try {
          const snap = await get(ref(database, `users/${uid}/profile/avatar`));
          if (snap.exists()) {
            avatars[uid] = snap.val();
          }
        } catch (e) {
          console.error(e);
        }
      }
      setFriendAvatars(avatars);
    };
    if (Object.keys(friends).length > 0) {
      fetchAvatars();
    }
  }, [friends]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        onValue(ref(database, `users/${currentUser.uid}/friends`), (snap) => {
          setFriends(snap.val() || {});
        });
        onValue(ref(database, `users/${currentUser.uid}/friendRequests`), (snap) => {
          setFriendRequests(snap.val() || {});
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setFriendError("");
    setFriendSuccess("");
    if (!friendTagInput.includes("#")) {
      return setFriendError("Тег должен содержать # (например Саша#1111)");
    }
    try {
      await sendFriendRequest(user.uid, user.displayName, friendTagInput);
      setFriendSuccess("Заявка отправлена!");
      setFriendTagInput("");
    } catch (err) {
      setFriendError(err.message);
    }
  };

  const handleAcceptFriend = async (uid, tag) => {
    try {
      await acceptFriendRequest(user.uid, user.displayName, uid, tag);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectFriend = async (uid) => {
    try {
      await rejectFriendRequest(user.uid, uid);
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return (
      <div className="friends-page">
        <div className="friends-empty-state">
          <div className="friends-empty-icon">🔒</div>
          <h2>Войдите в аккаунт</h2>
          <p>Чтобы добавлять друзей, нужно войти или зарегистрироваться во вкладке «Аккаунт».</p>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-page">
      <motion.div className="friends-page-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        
        {/* Left column: Add friend + Requests */}
        <div className="friends-left-col">
          <div className="friends-add-card">
            <h3>➕ Добавить друга</h3>
            <p className="friends-hint">Введите тег друга, чтобы отправить заявку</p>
            <form onSubmit={handleAddFriend} className="friends-add-form">
              <input 
                type="text" 
                value={friendTagInput} 
                onChange={e => setFriendTagInput(e.target.value)} 
                placeholder="Например: Саша#1111" 
                className="form-input"
              />
              <button type="submit" className="btn-primary">Отправить</button>
            </form>
            {friendError && <p className="error-text" style={{marginTop: "10px"}}>{friendError}</p>}
            {friendSuccess && <p className="success-text" style={{marginTop: "10px"}}>{friendSuccess}</p>}
          </div>

          {Object.keys(friendRequests).length > 0 && (
            <div className="friends-requests-card">
              <h3>📩 Входящие заявки</h3>
              {Object.entries(friendRequests).map(([uid, tag]) => (
                <div key={uid} className="friend-request-item">
                  <span>👤 {tag}</span>
                  <div className="request-actions">
                    <button className="btn-accept" onClick={() => handleAcceptFriend(uid, tag)}>Принять</button>
                    <button className="btn-reject" onClick={() => handleRejectFriend(uid)}>Отклонить</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Friends list */}
        <div className="friends-right-col">
          <div className="friends-list-card">
            <h3>👥 Мои друзья <span className="friends-count">{Object.keys(friends).length}</span></h3>
            {Object.keys(friends).length === 0 ? (
              <div className="friends-empty-list">
                <div style={{fontSize: "3rem", marginBottom: "15px"}}>🤝</div>
                <p>У вас пока нет друзей.</p>
                <p style={{color: "rgba(255,255,255,0.4)", fontSize: "0.9rem"}}>Отправьте заявку по тегу или поделитесь ссылкой из профиля!</p>
              </div>
            ) : (
              <div className="friends-grid">
                {Object.entries(friends).map(([uid, tag]) => {
                  const namePart = tag.includes('#') ? tag.split('#')[0] : tag;
                  const tagPart = tag.includes('#') ? '#' + tag.split('#')[1] : '';
                  return (
                    <div 
                      key={uid} 
                      className="friend-card clickable" 
                      onClick={() => onViewProfile(tag)}
                      title={`Посмотреть профиль ${namePart}`}
                    >
                      <div className="friend-card-avatar">
                        {(friendAvatars[uid] && (friendAvatars[uid].startsWith("data:image/") || friendAvatars[uid].startsWith("http"))) ? (
                          <img src={friendAvatars[uid]} alt="Avatar" />
                        ) : (
                          friendAvatars[uid] || "😎"
                        )}
                      </div>
                      <div className="friend-card-info">
                        <span className="friend-card-name">{namePart}</span>
                        <span className="friend-card-tag">{tagPart}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
