import React, { useState, useEffect } from 'react';
import { Maximize, Minimize, Dices, Users, Sparkles, SlidersHorizontal } from 'lucide-react';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function DesktopHeaderHUD({
  activeTab,
  activeRoom,
  onOpenRoulette,
  onOpenFilters
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    triggerHaptic('light');
    playSound('tap');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const getSectionTitle = () => {
    switch (activeTab) {
      case 'feed':
        return { title: 'Лента свайпов', sub: 'Персональный 5D-подбор кино' };
      case 'movies':
        return { title: 'Каталог фильмов', sub: 'Шедевры мирового кинематографа' };
      case 'actors':
        return { title: 'Звёзды кино', sub: 'Культовые актёры и их лучшие роли' };
      case 'vault':
        return { title: 'Ваша фильмотека', sub: 'Лайки, избранное и история просмотров' };
      case 'rooms':
        return { title: 'Совместный выбор', sub: 'Синхронный выбор кино в реальном времени' };
      case 'profile':
        return { title: 'Кино-паспорт & ДНК', sub: 'Ваш уникальный киноманский профиль' };
      default:
        return { title: 'MatchWatch', sub: 'Киностудия' };
    }
  };

  const { title, sub } = getSectionTitle();

  return (
    <header className="desktop-header-hud">
      {/* Left: Section Title */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: '800', fontFamily: 'Syne', color: 'var(--text-primary)' }}>
          {title}
        </h1>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {sub}
        </span>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Room Connection Pill */}
        {activeRoom && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            background: 'rgba(255, 94, 98, 0.15)',
            border: '1px solid rgba(255, 94, 98, 0.4)',
            borderRadius: '999px',
            fontSize: '0.8rem',
            color: '#ff9966',
            fontWeight: '700',
            fontFamily: 'Space Grotesk'
          }}>
            <Users size={14} />
            <span>Комната {activeRoom.code}</span>
            <span style={{ opacity: 0.7 }}>• {activeRoom.members?.length || 1} участников</span>
          </div>
        )}

        {/* Filters Button (strictly on feed swipe menu) */}
        {activeTab === 'feed' && onOpenFilters && (
          <button
            onClick={() => {
              triggerHaptic('light');
              playSound('tap');
              onOpenFilters();
            }}
            title="Настройка фильтров колоды"
            className="btn-secondary"
            style={{ padding: '7px 14px', fontSize: '0.8rem' }}
          >
            <SlidersHorizontal size={14} />
            <span>Фильтры</span>
          </button>
        )}

        {/* 3-Reel Slot Machine Roulette */}
        {onOpenRoulette && (
          <button
            onClick={() => {
              triggerHaptic('medium');
              playSound('tap');
              onOpenRoulette();
            }}
            title="Кино-рулетка 🎰 (Случайный выбор)"
            className="btn-primary"
            style={{ padding: '7px 16px', fontSize: '0.825rem' }}
          >
            <Dices size={15} />
            <span>Слот-Рулетка 🎰</span>
          </button>
        )}

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}
          className="btn-icon"
          style={{ width: '36px', height: '36px' }}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>
    </header>
  );
}
