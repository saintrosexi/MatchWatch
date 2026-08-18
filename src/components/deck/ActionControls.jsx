import React from 'react';
import { RotateCcw, X, Star, Heart, Info } from 'lucide-react';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function ActionControls({
  onUndo,
  onPass,
  onSuperlike,
  onLike,
  onInfo,
  canUndo = false,
  disabled = false
}) {
  const handleAction = (actionFn, hapticType, soundType) => {
    if (disabled) return;
    triggerHaptic(hapticType);
    if (soundType) playSound(soundType);
    if (actionFn) actionFn();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '14px',
      padding: '16px 8px 8px',
      width: '100%',
      maxWidth: '400px',
      margin: '0 auto'
    }}>
      {/* 1. Undo Button */}
      <button
        onClick={() => handleAction(onUndo, 'light', 'tap')}
        disabled={!canUndo || disabled}
        title="Отменить последний свайп (Z)"
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: canUndo ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.04)',
          border: canUndo ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
          color: canUndo ? 'var(--accent-gold)' : 'var(--text-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: canUndo ? 'pointer' : 'default',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: canUndo ? '0 4px 12px rgba(245, 158, 11, 0.15)' : 'none'
        }}
      >
        <RotateCcw size={18} />
      </button>

      {/* 2. Pass Button (Coral ✕) */}
      <button
        onClick={() => handleAction(onPass, 'light', 'swipe_pass')}
        disabled={disabled}
        title="Пропустить (←)"
        style={{
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: 'rgba(255, 71, 87, 0.12)',
          border: '1.5px solid rgba(255, 71, 87, 0.4)',
          color: 'var(--accent-coral)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 6px 20px rgba(255, 71, 87, 0.2)'
        }}
      >
        <X size={26} strokeWidth={2.5} />
      </button>

      {/* 3. Superlike / Star Button (Sapphire ★) */}
      <button
        onClick={() => handleAction(onSuperlike, 'heavy', 'superlike')}
        disabled={disabled}
        title="Суперлайк / В избранное (↑)"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.14)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          color: '#60a5fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 4px 16px rgba(59, 130, 246, 0.2)'
        }}
      >
        <Star size={20} fill="currentColor" />
      </button>

      {/* 4. Like Button (Emerald ♥) */}
      <button
        onClick={() => handleAction(onLike, 'medium', 'swipe_like')}
        disabled={disabled}
        title="Нравится (→)"
        style={{
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.14)',
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
          color: 'var(--accent-emerald)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 6px 20px rgba(16, 185, 129, 0.25)'
        }}
      >
        <Heart size={26} fill="currentColor" />
      </button>

      {/* 5. Info Button (Gold ℹ) */}
      <button
        onClick={() => handleAction(onInfo, 'light', 'tap')}
        disabled={disabled}
        title="Подробнее о фильме (↓)"
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <Info size={19} />
      </button>
    </div>
  );
}
