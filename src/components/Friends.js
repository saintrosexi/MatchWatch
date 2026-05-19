import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { auth, database, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get } from "firebase/database";

export default function Friends({ onViewProfile, onTabClick }) {
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState({});
  const [friendRequests, setFriendRequests] = useState({});
  const [friendTagInput, setFriendTagInput] = useState("");
  const [friendError, setFriendError] = useState("");
  const [friendSuccess, setFriendSuccess] = useState("");
  const [friendAvatars, setFriendAvatars] = useState({});

  useEffect(() => {
    const fetchAvatars = async () => {
      if (!database) return;
      const avatars = {};
      const fetchPromises = Object.keys(friends).map(async (uid) => {
        try {
          const snap = await get(ref(database, `users/${uid}/profile/avatar`));
          if (snap.exists()) {
            return { uid, val: snap.val() };
          }
        } catch (e) {
          console.error(e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const res of results) {
        if (res) {
          avatars[res.uid] = res.val;
        }
      }
      setFriendAvatars(avatars);
    };
    if (Object.keys(friends).length > 0) {
      fetchAvatars();
    }
  }, [friends]);

  useEffect(() => {
    if (!auth || !database) return;
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

  // Hardcoded friends list as per specification for when not logged in or as fallback
  const hardcodedFriends = [
    { id: 1, avatar: "😎", name: "Саша", tag: "#2222" },
    { id: 2, avatar: "😻", name: "НапримерИван", tag: "#1111" },
    { id: 3, avatar: "👻", name: "Соня", tag: "#3333" },
    { id: 4, avatar: "🛡️", name: "Рыцарь", tag: "#4444" },
  ];

  return (
    <div className="friends-activity-container">
      {/* Central Content: Activity Hub */}
      <main className="activity-hub">
        <h1 className="activity-hub-title">Activity Hub</h1>
        
        <div className="activity-hub-grid">
          {/* Container A: Добавить друга */}
          <div className="glass-panel add-friend-panel">
            <div className="panel-icon">👤+</div>
            <h2>Добавить друга</h2>
            <p>Введите тег друга (например: Саня#1234), чтобы отправить заявку.</p>

            <form onSubmit={handleAddFriend} className="add-friend-form">
              <input 
                type="text" 
                placeholder="например: Саня"
                className="add-friend-input"
                value={friendTagInput}
                onChange={e => setFriendTagInput(e.target.value)}
              />
              <button type="submit" className="btn-coral">Отправить</button>
            </form>
            {friendError && <p className="error-text" style={{marginTop: "10px", color: "#ff5252"}}>{friendError}</p>}
            {friendSuccess && <p className="success-text" style={{marginTop: "10px", color: "#4caf50"}}>{friendSuccess}</p>}
          </div>

          {/* Container B: Мои друзья */}
          <div className="glass-panel my-friends-panel">
            <div className="my-friends-header">
              <h2>Мои друзья</h2>
              <span className="friends-count-badge">
                {!user ? hardcodedFriends.length : Object.keys(friends).length > 0 ? Object.keys(friends).length : hardcodedFriends.length}
              </span>
            </div>

            <div className="friends-list">
              {(!user || Object.keys(friends).length === 0) ? (
                hardcodedFriends.map(friend => (
                  <div className="friend-card-detailed" key={friend.id}>
                    <div className="friend-avatar-wrapper">
                      <div className="friend-avatar">{friend.avatar}</div>
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">{friend.name}</span>
                      <span className="friend-tag">{friend.tag}</span>
                    </div>
                    <div className="friend-actions">
                      <button className="btn-options">⋮</button>
                    </div>
                  </div>
                ))
              ) : (
                Object.entries(friends).map(([uid, tag]) => {
                  const namePart = tag.includes('#') ? tag.split('#')[0] : tag;
                  const tagPart = tag.includes('#') ? '#' + tag.split('#')[1] : '';
                  return (
                    <div className="friend-card-detailed" key={uid} onClick={() => onViewProfile(tag)} style={{cursor: 'pointer'}}>
                      <div className="friend-avatar-wrapper">
                        <div className="friend-avatar">
                          {(friendAvatars[uid] && (friendAvatars[uid].startsWith("data:image/") || friendAvatars[uid].startsWith("http"))) ? (
                            <img src={friendAvatars[uid]} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}}/>
                          ) : (
                            friendAvatars[uid] || "😎"
                          )}
                        </div>
                      </div>
                      <div className="friend-info">
                        <span className="friend-name">{namePart}</span>
                        <span className="friend-tag">{tagPart}</span>
                      </div>
                      <div className="friend-actions">
                        <button className="btn-options">⋮</button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Decorative cross-star */}
            <div className="decorative-star">✦</div>
          </div>

          {user && Object.keys(friendRequests).length > 0 && (
            <div className="glass-panel requests-panel" style={{marginTop: "30px"}}>
              <h3>📩 Входящие заявки</h3>
              {Object.entries(friendRequests).map(([uid, tag]) => (
                <div key={uid} className="friend-request-item" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                  <span>👤 {tag}</span>
                  <div className="request-actions" style={{display: 'flex', gap: '10px'}}>
                    <button className="btn-accept" onClick={() => handleAcceptFriend(uid, tag)} style={{background: '#4caf50', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'}}>Принять</button>
                    <button className="btn-reject" onClick={() => handleRejectFriend(uid)} style={{background: '#ff5252', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'}}>Отклонить</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
