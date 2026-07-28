// Telegram Mini App (TMA) Helper Module

export const getTelegramWebApp = () => {
  if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

export const initTelegramWebApp = () => {
  const tg = getTelegramWebApp();
  if (tg) {
    tg.ready();
    tg.expand();
    return true;
  }
  return false;
};

export const triggerHaptic = (type = "light") => {
  const tg = getTelegramWebApp();
  if (!tg || !tg.HapticFeedback) return;

  try {
    if (type === "success" || type === "error" || type === "warning") {
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      tg.HapticFeedback.impactOccurred(type); // 'light', 'medium', 'heavy', 'rigid', 'soft'
    }
  } catch (e) {
    console.warn("Haptic feedback error:", e);
  }
};

export const getTelegramStartParam = () => {
  const tg = getTelegramWebApp();
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
    return tg.initDataUnsafe.start_param;
  }
  // Fallback to URL query search params if running in standard browser
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    return params.get("startapp") || params.get("start_param") || params.get("room");
  }
  return null;
};

export const getTelegramUser = () => {
  const tg = getTelegramWebApp();
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const user = tg.initDataUnsafe.user;
    return {
      id: user.id,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      username: user.username || "",
      name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Пользователь",
      photoUrl: user.photo_url || null
    };
  }
  return null;
};

export const getBotUsername = () => {
  const envUser = process.env.REACT_APP_TELEGRAM_BOT_USERNAME;
  if (envUser && envUser.toLowerCase() !== "matchwatchbot") {
    return envUser;
  }
  return "matchwatch_together_bot";
};

export const shareTelegramRoom = (roomCode) => {
  const tg = getTelegramWebApp();
  const botUsername = getBotUsername();
  const inviteUrl = `https://t.me/${botUsername}/app?startapp=${roomCode}`;
  const text = `Давай выберем фильм вместе в MatchWatch! 🎬🍿\nКод комнаты: ${roomCode}`;

  if (tg && tg.openTelegramLink) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`);
  } else {
    // Fallback: Copy to clipboard or web share
    if (navigator.share) {
      navigator.share({
        title: "MatchWatch — Выбор фильма вместе",
        text: text,
        url: inviteUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
    }
  }
};
