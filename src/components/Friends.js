import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  auth,
  database,
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

  const handleAddFriend = async (e) => {
    e.preventDefault();
    const inputTag = friendTagInput.trim();

    if (!inputTag) {
      showToast("error", "Введите тег пользователя (например: Саня#1234)");
      return;
    }

    const tagRegex = /^.+#\d{4}$/;
    if (!tagRegex.test(inputTag)) {
      showToast("error", "Неверный формат тега. Введите тег в формате Имя#1234");
      return;
    }

    const currentTag = user ? (user.displayName || user.email) : null;
    if (currentTag && inputTag.toLowerCase() === currentTag.toLowerCase()) {
      showToast("error", "Нельзя добавить самого себя");
      return;
    }

    const isAlreadyFriend = Object.values(friends).some(
      (t) => typeof t === "string" && t.toLowerCase() === inputTag.toLowerCase()
    );
    if (isAlreadyFriend) {
      showToast("error", "Этот пользователь уже в вашем списке друзей");
      return;
    }

    if (user) {
      try {
        await sendFriendRequest(user.uid, currentTag, inputTag);
        showToast("success", "Заявка успешно отправлена! 🚀");
        setFriendTagInput("");
      } catch (err) {
        showToast("error", err.message || "Ошибка при отправке заявки");
      }
    } else {
      showToast("success", "Заявка успешно отправлена! 🚀");
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

  const demoFriends = [
    { uid: "demo-1", tag: "Саша#2222", avatar: "😎", compat: "94%" },
    { uid: "demo-2", tag: "Иван#1111", avatar: "😻", compat: "88%" },
    { uid: "demo-3", tag: "Соня#3333", avatar: "👻", compat: "91%" },
    { uid: "demo-4", tag: "Рыцарь#4444", avatar: "🛡️", compat: "82%" },
  ];

  const getFriendCompat = (uid, tag) => {
    const demo = demoFriends.find((f) => f.uid === uid);
    if (demo) return demo.compat;
    if (friendCompat[uid]) return `${friendCompat[uid]}%`;
    const currentTag = user ? (user.displayName || user.email || "Пользователь") : "";
    const score = calculateUserCompatibility(decisions || [], [], currentTag, tag);
    return `${score}%`;
  };

  const activeRequests = user ? friendRequests : demoRequests;
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
          👥 Социальный хаб
        </motion.h1>
        <motion.p
          className="mood-subtitle"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          Делись вкусом и выбирайте фильмы вместе
        </motion.p>

        <ChamaBanner
          type="POINTER_STICK"
          title="Социальный хаб Чамы"
          text="Добавляй друзей по тегу и зови их в парные сессии свайпов MatchWatch! Чама поможет выявить общие предпочтения."
          size="medium"
          className="mb-6"
        />

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
              Введите тег друга (например: <strong>Саня#1234</strong>), чтобы добавить его в контакты.
            </p>

            <form onSubmit={handleAddFriend} className="add-friend-form">
              <input
                type="text"
                placeholder="например: Саня#1234"
                className="add-friend-input"
                value={friendTagInput}
                onChange={(e) => setFriendTagInput(e.target.value)}
              />
              <button type="submit" className="btn btn-coral">
                Отправить 🚀
              </button>
            </form>

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
                {!user ? demoFriends.length : Object.keys(friends).length || demoFriends.length}
              </span>
            </div>

            <div className="friends-list">
              {!user || Object.keys(friends).length === 0
                ? demoFriends.map((f) => (
                    <motion.div
                      key={f.uid}
                      className="friend-card-detailed"
                      whileHover={{ scale: 1.01 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="friend-avatar-wrapper">{f.avatar}</div>
                      <div className="friend-info">
                        <div className="friend-name-container">
                          <span className="friend-name">{f.tag.split("#")[0]}</span>
                          <span className="compat-badge">Совместимость {f.compat}</span>
                        </div>
                        <span className="friend-tag">#{f.tag.split("#")[1]}</span>
                      </div>
                      <button
                        className="btn-matchwatch-invite"
                        onClick={() => handleInviteFriendToRoom(f.uid, f.tag)}
                      >
                        Позвать в MatchWatch 🍿
                      </button>
                    </motion.div>
                  ))
                : Object.entries(friends).map(([uid, tag]) => {
                    const namePart = tag.includes("#") ? tag.split("#")[0] : tag;
                    const tagPart = tag.includes("#") ? "#" + tag.split("#")[1] : "";
                    const avatar = friendAvatars[uid];
                    const compat = getFriendCompat(uid, tag);

                    return (
                      <motion.div
                        key={uid}
                        className="friend-card-detailed"
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className="friend-avatar-wrapper">
                          {avatar && (avatar.startsWith("data:image/") || avatar.startsWith("http")) ? (
                            <img src={avatar} alt="Avatar" className="friend-avatar-img" />
                          ) : (
                            avatar || "😎"
                          )}
                        </div>
                        <div className="friend-info" onClick={() => onViewProfile?.(tag)}>
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
                  })}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
