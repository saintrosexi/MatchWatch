// MatchWatch 3 — Haptics Engine (Telegram TMA & Web Vibration API)

export const triggerHaptic = (style = "light") => {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      if (style === "light") tg.HapticFeedback.impactOccurred("light");
      else if (style === "medium") tg.HapticFeedback.impactOccurred("medium");
      else if (style === "heavy") tg.HapticFeedback.impactOccurred("heavy");
      else if (style === "success") tg.HapticFeedback.notificationOccurred("success");
      else if (style === "warning") tg.HapticFeedback.notificationOccurred("warning");
      else if (style === "selection") tg.HapticFeedback.selectionChanged();
      return;
    }

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (style === "light") navigator.vibrate(10);
      else if (style === "medium") navigator.vibrate(25);
      else if (style === "heavy") navigator.vibrate(50);
      else if (style === "success") navigator.vibrate([20, 60, 40]);
    }
  } catch (e) {}
};
