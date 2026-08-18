import { useState, useEffect } from 'react';

export function useTelegramAuth() {
  const [user, setUser] = useState({
    id: 'guest_user',
    name: 'Киноман',
    username: 'cinephile',
    avatar: '🍿',
    isTelegram: false
  });

  useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        // Enable closing confirmation to prevent accidental swipes closing TMA
        if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();

        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser) {
          setUser({
            id: String(tgUser.id),
            name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || tgUser.username || 'Киноман',
            username: tgUser.username || `user_${tgUser.id}`,
            avatar: tgUser.photo_url || '🍿',
            isTelegram: true
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Telegram WebApp init error:', e);
    }

    // Local storage guest fallback
    try {
      const storedGuest = localStorage.getItem('mw3_guest_profile');
      if (storedGuest) {
        setUser(JSON.parse(storedGuest));
      } else {
        const defaultGuest = {
          id: `guest_${Math.floor(1000 + Math.random() * 9000)}`,
          name: 'Гость-Киноман',
          username: 'cinephile_guest',
          avatar: '🍿',
          isTelegram: false
        };
        setUser(defaultGuest);
        localStorage.setItem('mw3_guest_profile', JSON.stringify(defaultGuest));
      }
    } catch (e) {}
  }, []);

  const updateProfile = (updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('mw3_guest_profile', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  return { user, updateProfile };
}
