// MatchWatch v2 — Telegram Mini App Helper Module

export const getTelegramWebApp = () => {
  if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

export const initTelegramWebApp = () => {
  const tg = getTelegramWebApp();
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (typeof tg.enableClosingConfirmation === "function") {
        tg.enableClosingConfirmation();
      }
      if (typeof tg.setHeaderColor === "function") {
        tg.setHeaderColor('#0d0d0d');
      }
      if (typeof tg.setBackgroundColor === "function") {
        tg.setBackgroundColor('#0d0d0d');
      }
    } catch (e) {
      console.warn("initTelegramWebApp error:", e);
    }
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
      tg.HapticFeedback.impactOccurred(type);
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
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    let param = params.get("startapp") || params.get("start_param") || params.get("room");
    if (param) return param;

    if (window.location.hash) {
      try {
        const hashClean = window.location.hash.replace(/^#/, "");
        const hashParams = new URLSearchParams(hashClean);
        param = hashParams.get("startapp") || hashParams.get("start_param") || hashParams.get("room");
        if (param) return param;

        const tgWebAppData = hashParams.get("tgWebAppData");
        if (tgWebAppData) {
          const innerParams = new URLSearchParams(tgWebAppData);
          param = innerParams.get("start_param") || innerParams.get("startapp");
          if (param) return param;
        }
      } catch (_e) { /* fallthrough */ }
    }
  }
  return null;
};

export const getTelegramUser = () => {
  const tg = getTelegramWebApp();

  // Primary: initDataUnsafe
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

  // Fallback 1: parse initData string
  if (tg && tg.initData) {
    try {
      const searchParams = new URLSearchParams(tg.initData);
      const userStr = searchParams.get("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          id: user.id,
          firstName: user.first_name || "",
          lastName: user.last_name || "",
          username: user.username || "",
          name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Пользователь",
          photoUrl: user.photo_url || null
        };
      }
    } catch (_e) { /* fallthrough */ }
  }

  // Fallback 2: URL hash/search params
  if (typeof window !== "undefined") {
    try {
      const hashOrSearch = window.location.hash || window.location.search;
      const cleanParams = new URLSearchParams(hashOrSearch.replace(/^#/, "").replace(/^\?/, ""));
      const tgWebAppData = cleanParams.get("tgWebAppData") || cleanParams.get("initData");
      if (tgWebAppData) {
        const innerParams = new URLSearchParams(tgWebAppData);
        const userStr = innerParams.get("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          return {
            id: user.id,
            firstName: user.first_name || "",
            lastName: user.last_name || "",
            username: user.username || "",
            name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Пользователь",
            photoUrl: user.photo_url || null
          };
        }
      }
    } catch (_e) { /* fallthrough */ }
  }

  return null;
};

export const getBotUsername = () => {
  const envUser = (typeof process !== 'undefined' && process.env ? (process.env.REACT_APP_TELEGRAM_BOT_USERNAME || process.env.VITE_TELEGRAM_BOT_USERNAME) : '');
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
  } else if (navigator.share) {
    navigator.share({
      title: "MatchWatch — Выбор фильма вместе",
      text,
      url: inviteUrl
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
  }
};
