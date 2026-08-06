import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  auth,
  database,
  searchUserByUsername,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  createMatchRoom,
  inviteToMatchWatch,
} from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get } from "firebase/database";
import { calculateUserCompatibility, calculateCompatibilityFromTags } from "../recommendations";
import { ChamaBanner, ChamaBackgroundArt } from "../chamaAssets";

export default function Friends({
  onViewProfile,
  onTabClick,
  onGoToMatchWatch,
  user: parentUser,
  friendRequests: parentFriendRequests,
  decisions,
  favorites,
  stopGenres,
}) {
  const [user, setUser] = useState(parentUser || null);
  const [friends, setFriends] = useState({});
  const [friendRequests, setFriendRequests] = useState(parentFriendRequests || {});
  const [demoRequests, setDemoRequests] = useState({
    "demo-req-1": "Мария#5555",
    "demo-req-2": "Алекс#7777",
  });
  const [friendTagInput, setFriendTagInput] = useState("");
  const [toast, setToast] = useState(null);
  const [friendAvatars, setFriendAvatars] = useState({});
  const [friendCompat, setFriendCompat] = useState({});

  useEffect(() => {
    if (parentUser !== undefined) {
      setUser(parentUser);
    }
  }, [parentUser]);

  useEffect(() => {
    if (parentFriendRequests !== undefined && Object.keys(parentFriendRequests).length > 0) {
      setFriendRequests(parentFriendRequests);
    }
  }, [parentFriendRequests]);

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

  useEffect(() => {
    const fetchAvatarsAndCompat = async () => {
      if (!database || !friends || Object.keys(friends).length === 0) return;
      const avatars = {};
      const compats = {};
      const currentTag = user ? (user.displayName || user.email || "Пользователь") : "";

      const fetchPromises = Object.entries(friends).map(async ([uid, tag]) => {
        try {
          const avatarSnap = await get(ref(database, `users/${uid}/profile/avatar`));
          if (avatarSnap.exists()) {
            avatars[uid] = avatarSnap.val();
          }

          const decisionsSnap = await get(ref(database, `users/${uid}/appData/decisions`));
          const friendLikes = decisionsSnap.exists() ? decisionsSnap.val() : [];
          compats[uid] = calculateUserCompatibility(decisions || [], friendLikes, currentTag, tag);
        } catch (e) {
          console.error(e);
          compats[uid] = calculateCompatibilityFromTags(currentTag, tag);
        }
      });

      await Promise.all(fetchPromises);
      setFriendAvatars(avatars);
      setFriendCompat(compats);
    };

    fetchAvatarsAndCompat();
  }, [friends, user, decisions]);

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchFriend = async (e) => {
    e.preventDefault();
    let rawInput = friendTagInput.trim();
    if (!rawInput) {
      showToast("error", "Укажите имя пользователя (например: @owner)");
      return;
    }

    const inputTag = rawInput.startsWith('@') || rawInput.includes('#') ? rawInput : `@${rawInput}`;
    setIsSearching(true);
    setSearchResult(null);

    try {
      const found = await searchUserByUsername(inputTag);
      if (!found) {
        showToast("error", "Активный профиль с таким именем не найден");
      } else {
        setSearchResult(found);
      }
    } catch (err) {
      showToast("error", err.message || "Ошибка при поиске профиля");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequestToFound = async () => {
    if (!searchResult) return;
    const currentTag = user ? (user.displayName || user.email) : null;
    const targetTag = searchResult.profile?.tag || searchResult.profile?.username || "Друг";

    if (user && searchResult.uid === user.uid) {
      showToast("error", "Нельзя добавить самого себя");
      return;
    }

    const isAlreadyFriend = Object.keys(friends).includes(searchResult.uid);
    if (isAlreadyFriend) {
      showToast("error", "Этот пользователь уже в вашем списке друзей");
      return;
    }

    if (user) {
      try {
        await sendFriendRequest(user.uid, currentTag, targetTag);
        showToast("success", `Заявка пользователю ${searchResult.profile.name || targetTag} успешно отправлена! 🚀`);
        setSearchResult(null);
        setFriendTagInput("");
      } catch (err) {
        showToast("error", err.message || "Ошибка при отправке заявки");
      }
    } else {
      showToast("success", `Заявка пользователю ${searchResult.profile.name || targetTag} успешно отправлена! 🚀`);
      setSearchResult(null);
      setFriendTagInput("");
    }
  };

  const handleAcceptFriend = async (targetUid, tag) => {
    if (user) {
      const currentTag = user.displayName || user.email || "Пользователь";
      try {
        await acceptFriendRequest(user.uid, currentTag, targetUid, tag);
        showToast("success", `Заявка от ${tag} принята! 🎉`);
      } catch (err) {
        console.error(err);
        showToast("error", err.message || "Ошибка при принятии заявки");
      }
    } else {
      setDemoRequests((prev) => {
        const next = { ...prev };
        delete next[targetUid];
        return next;
      });
      showToast("success", `Заявка от ${tag} принята! 🎉`);
    }
  };

  const handleRejectFriend = async (targetUid) => {
    if (user) {
      try {
        await rejectFriendRequest(user.uid, targetUid);
        showToast("info", "Заявка отклонена");
      } catch (err) {
        console.error(err);
        showToast("error", err.message || "Ошибка при отклонении заявки");
      }
    } else {
      setDemoRequests((prev) => {
        const next = { ...prev };
        delete next[targetUid];
        return next;
      });
      showToast("info", "Заявка отклонена");
    }
  };

  const handleInviteFriendToRoom = async (targetUid, tag) => {
    const hostName = user?.displayName || "Пользователь";
    const senderName = user?.displayName || "Друг";
    let roomCode = null;

    try {
      roomCode = await createMatchRoom(hostName, []);
    } catch (e) {
      console.error("Failed to create room:", e);
    }

    if (!roomCode) {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    if (user && targetUid) {
      try {
        await inviteToMatchWatch(targetUid, roomCode, senderName);
      } catch (e) {
        console.error("Failed to send invite:", e);
      }
    }

    const shortName = tag ? tag.split("#")[0] : "Друг";
    showToast("success", `Приглашение отправлено ${shortName}! 🍿`);

    if (onGoToMatchWatch) {
      onGoToMatchWatch(roomCode);
    }
  };

  const activeRequests = friendRequests || {};
  const requestsCount = Object.keys(activeRequests).length;

  return (
    <div className="friends-activity-container relative overflow-hidden">
      <ChamaBackgroundArt type="THUMBS_UP" opacity={0.06} />
      <main className="activity-hub">
        <motion.h1
          className="page-title"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          👥 Друзья
        </motion.h1>
        <motion.p
          className="mood-subtitle"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          Делись вкусом и выбирайте фильмы вместе
        </motion.p>

        <div className="activity-hub-grid">
          {/* Add Friend Form */}
          <motion.div
            className="glass-panel add-friend-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <h2 className="section-title">✨ Добавить друга</h2>
            <p className="add-friend-desc">
              Укажите имя пользователя друга (например: <strong>@owner</strong>), чтобы добавить его в контакты.
            </p>

            <form onSubmit={handleSearchFriend} className="add-friend-form">
              <div style={{ display: "flex", alignItems: "center", background: "rgba(255, 255, 255, 0.05)", border: "1px solid var(--border-glass)", borderRadius: "var(--radius-md)", overflow: "hidden", flex: 1 }}>
                <span style={{ padding: "0 12px", color: "var(--accent-coral)", fontWeight: "bold", fontSize: "1rem" }}>@</span>
                <input
                  type="text"
                  placeholder="owner"
                  className="add-friend-input"
                  value={friendTagInput.replace('@', '')}
                  onChange={(e) => {
                    setFriendTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9_#]/g, ''));
                    if (searchResult) setSearchResult(null);
                  }}
                  style={{ background: "transparent", border: "none", outline: "none", flex: 1, padding: "10px 14px 10px 0" }}
                />
              </div>
              <button type="submit" className="btn btn-coral" style={{ height: "42px" }} disabled={isSearching}>
                {isSearching ? "Поиск..." : "Найти 🔍"}
              </button>
            </form>

            {/* Found Active Profile Preview Card */}
            {searchResult && (
              <motion.div 
                className="found-user-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  borderRadius: "16px",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid var(--accent-coral)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "14px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                    {searchResult.profile.avatar || "😎"}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: "700", color: "#fff", fontSize: "1rem" }}>{searchResult.profile.name || searchResult.profile.username}</div>
                    <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)" }}>@{searchResult.profile.username || searchResult.profile.tag}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => onViewProfile && onViewProfile(searchResult.profile.username || searchResult.profile.tag)}
                  >
                    Профиль 👤
                  </button>
                  <button 
                    className="btn btn-coral btn-sm"
                    onClick={handleSendRequestToFound}
                  >
                    Добавить 🚀
                  </button>
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {toast && (
                <motion.div
                  key="toast"
                  className={`glass-toast glass-toast-${toast.type}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {toast.message}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Incoming Requests Section */}
          {requestsCount > 0 && (
            <motion.div
              className="glass-panel requests-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
            >
              <h2 className="section-title">📩 Входящие заявки ({requestsCount})</h2>
              <div className="requests-list">
                {Object.entries(activeRequests).map(([uid, tag]) => (
                  <motion.div
                    key={uid}
                    className="friend-card-detailed"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="friend-avatar-wrapper">👤</div>
                    <div className="friend-info">
                      <span className="friend-name">{tag}</span>
                      <span className="friend-tag">Хочет добавиться в друзья</span>
                    </div>
                    <div className="request-actions">
                      <button className="btn-success-glass" onClick={() => handleAcceptFriend(uid, tag)}>
                        Принять
                      </button>
                      <button className="btn-danger-glass" onClick={() => handleRejectFriend(uid)}>
                        Отклонить
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Friends List */}
          <motion.div
            className="glass-panel my-friends-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
          >
            <div className="friend-header-row">
              <h2 className="section-title">Мои друзья</h2>
              <span className="glass-count-badge">
                {Object.keys(friends).length}
              </span>
            </div>

            <div className="friends-list">
              {Object.keys(friends).length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "rgba(255,255,255,0.5)" }}>
                  <p style={{ fontSize: "2rem", margin: "0 0 10px 0" }}>👥</p>
                  <p style={{ margin: 0, fontSize: "0.95rem" }}>У вас пока нет друзей в списке</p>
                  <p style={{ margin: "5px 0 0 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>
                    Добавляйте их по нику#тегу выше или переходите по ссылкам профилей!
                  </p>
                </div>
              ) : (
                Object.entries(friends).map(([uid, tag]) => {
                  const namePart = tag.includes("#") ? tag.split("#")[0] : tag;
                  const tagPart = tag.includes("#") ? "#" + tag.split("#")[1] : "";
                  const avatar = friendAvatars[uid];
                  const compat = friendCompat[uid] ? `${friendCompat[uid]}%` : "85%";

                  return (
                    <motion.div
                      key={uid}
                      className="friend-card-detailed"
                      whileHover={{ scale: 1.01 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="friend-avatar-wrapper" onClick={() => onViewProfile?.(tag)} style={{ cursor: "pointer" }}>
                        {avatar && (avatar.startsWith("data:image/") || avatar.startsWith("http")) ? (
                          <img src={avatar} alt="Avatar" className="friend-avatar-img" />
                        ) : (
                          avatar || "😎"
                        )}
                      </div>
                      <div className="friend-info" onClick={() => onViewProfile?.(tag)} style={{ cursor: "pointer" }}>
                        <div className="friend-name-container">
                          <span className="friend-name">{namePart}</span>
                          <span className="compat-badge">Совместимость {compat}</span>
                        </div>
                        <span className="friend-tag">{tagPart}</span>
                      </div>
                      <button
                        className="btn-matchwatch-invite"
                        onClick={() => handleInviteFriendToRoom(uid, tag)}
                      >
                        Позвать в MatchWatch 🍿
                      </button>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
