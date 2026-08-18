import React from 'react';
import { SwipeDeck } from '../deck/SwipeDeck.jsx';
import { Sparkles, Film, Tv, Flame } from 'lucide-react';
import { cineMoods } from '../../data/moods.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function FeedView({
  deck = [],
  currentIndex = 0,
  onSwipe,
  onUndo,
  canUndo = false,
  onOpenDetails,
  onResetDeck,
  selectedMood = null,
  onSelectMood,
  selectedCategory = 'all',
  onSelectCategory
}) {
  const categories = [
    { id: 'all', label: 'Всё подряд', icon: '✨' },
    { id: 'movie', label: 'Фильмы', icon: '🎬' },
    { id: 'series', label: 'Сериалы', icon: '📺' },
    { id: 'anime', label: 'Аниме', icon: '⛩' }
  ];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Quick Mood Selector Bar */}
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '0 16px 10px',
        scrollbarWidth: 'none'
      }}>
        {/* All Moods Chip */}
        <button
          onClick={() => {
            triggerHaptic('light');
            playSound('tap');
            onSelectMood(null);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 11px',
            borderRadius: '999px',
            border: !selectedMood ? '1px solid rgba(255, 94, 98, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
            background: !selectedMood ? 'rgba(255, 94, 98, 0.16)' : 'rgba(255, 255, 255, 0.03)',
            color: !selectedMood ? '#ff9966' : 'var(--text-secondary)',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          <Sparkles size={12} /> Все вайбы
        </button>

        {/* Quick Mood Chips */}
        {cineMoods.map((mood) => {
          const isSelected = selectedMood?.id === mood.id;
          return (
            <button
              key={mood.id}
              onClick={() => {
                triggerHaptic('light');
                playSound('tap');
                onSelectMood(isSelected ? null : mood);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 11px',
                borderRadius: '999px',
                border: isSelected ? `1px solid ${mood.accentColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                background: isSelected ? `${mood.accentColor}26` : 'rgba(255, 255, 255, 0.03)',
                color: isSelected ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: isSelected ? '700' : '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <span>{mood.icon}</span>
              <span>{mood.title}</span>
            </button>
          );
        })}
      </div>

      {/* Main 3D Card Stack */}
      <SwipeDeck
        movies={deck}
        currentIndex={currentIndex}
        onSwipe={onSwipe}
        onUndo={onUndo}
        canUndo={canUndo}
        onOpenDetails={onOpenDetails}
        onResetDeck={onResetDeck}
      />
    </div>
  );
}
