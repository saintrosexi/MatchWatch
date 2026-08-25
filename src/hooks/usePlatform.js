/**
 * Определение платформы и виджета интерфейса.
 *
 * Выбор шелла — не только про ширину экрана: внутри Telegram на планшете
 * всё равно нужен мобильный шелл с доком и хаптикой.
 */

import { useEffect, useState } from 'react';
import { initTelegramShell, isTelegram, readTheme } from '../lib/telegram.js';
import { setTelemetryPlatform } from '../lib/telemetry.js';

const DESKTOP_MIN_WIDTH = 1024;
/** Ниже этой ширины сенсорный ввод решает спор в пользу мобильного шелла. */
const TOUCH_TIEBREAK_WIDTH = 1280;

const detect = () => {
  const width = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const coarse = Boolean(window?.matchMedia?.('(pointer: coarse)').matches);
  const tg = isTelegram();

  /*
   * Наличие сенсора само по себе НЕ повод показывать мобильный шелл:
   * ноутбук с тачскрином на 1440 пикселях — это десктоп. Сенсор лишь
   * разрешает спор в промежуточной полосе 1024–1280, где планшет
   * действительно удобнее листать пальцем.
   */
  const shell = tg || width < DESKTOP_MIN_WIDTH || (coarse && width < TOUCH_TIEBREAK_WIDTH)
    ? 'mobile'
    : 'desktop';

  return { telegram: tg, shell, width, theme: readTheme(), touch: coarse };
};

export function usePlatform() {
  const [platform, setPlatform] = useState(detect);

  useEffect(() => {
    const shell = initTelegramShell({
      onThemeChange: () => setPlatform(detect()),
      onViewportChange: () => setPlatform(detect()),
    });

    setTelemetryPlatform(shell.available ? `telegram-${shell.platform ?? 'unknown'}` : 'web');

    const onResize = () => setPlatform(detect());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return platform;
}
