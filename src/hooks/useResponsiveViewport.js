import { useState, useEffect } from 'react';

export function useResponsiveViewport() {
  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem('mw_viewport_mode') || 'auto';
    } catch (e) {
      return 'auto';
    }
  });

  const [windowWidth, setWindowWidth] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1200;
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setMode = (newMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem('mw_viewport_mode', newMode);
    } catch (e) {}
  };

  const isDesktop = mode === 'desktop' ? true : mode === 'mobile' ? false : windowWidth >= 1024;

  return {
    isDesktop,
    mode,
    setMode,
    windowWidth
  };
}
