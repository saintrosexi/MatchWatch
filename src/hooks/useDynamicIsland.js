import { useState, useCallback } from 'react';

export function useDynamicIsland() {
  const [islandState, setIslandState] = useState({
    mode: 'idle', // 'idle' | 'room' | 'match' | 'alert' | 'sound'
    message: '',
    subMessage: '',
    icon: null,
    timeoutId: null
  });

  const showIslandAlert = useCallback((message, subMessage = '', icon = '🍿', duration = 3000) => {
    setIslandState((prev) => {
      if (prev.timeoutId) clearTimeout(prev.timeoutId);
      const tid = setTimeout(() => {
        setIslandState((cur) => ({ ...cur, mode: 'idle', message: '', subMessage: '', icon: null }));
      }, duration);

      return {
        mode: 'alert',
        message,
        subMessage,
        icon,
        timeoutId: tid
      };
    });
  }, []);

  const setRoomStatus = useCallback((roomCode, membersCount = 2) => {
    setIslandState({
      mode: 'room',
      message: `Комната ${roomCode}`,
      subMessage: `Участников: ${membersCount}`,
      icon: '👥',
      timeoutId: null
    });
  }, []);

  const resetIsland = useCallback(() => {
    setIslandState((prev) => {
      if (prev.timeoutId) clearTimeout(prev.timeoutId);
      return { mode: 'idle', message: '', subMessage: '', icon: null, timeoutId: null };
    });
  }, []);

  return { islandState, showIslandAlert, setRoomStatus, resetIsland };
}
