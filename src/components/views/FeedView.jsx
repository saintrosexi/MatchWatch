import React from 'react';
import { SwipeDeck } from '../deck/SwipeDeck.jsx';
import { Sparkles, Film, Flame } from 'lucide-react';
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
  onOpenAIPrompt
}) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Quick Mood & AI Selector Bar */}
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '0 16px 10px',
        scrollbarWidth: 'none'
      }}>
        {/* Gemini AI Concierge Trigger Chip */}
        <button
          onClick={() => {
            triggerHaptic('medium');
            playSound('tap');
            if (onOpenAIPrompt) onOpenAIPrompt();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 12px',
            borderRadius: '999px',
            border: '1px solid rgba(255, 94, 98, 0.55)',
            background: 'linear-gradient(135deg, rgba(255, 94, 98, 0.22), rgba(255, 153, 102, 0.12))',
            color: '#ff9966',
            fontSize: '0.75rem',
            fontWeight: '700',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(255, 94, 98, 0.2)'
          }}
        >
          <Sparkles size={13} />
          <span>✨ AI Подбор</span>
        </button>

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
          <span>🔥 Все вайбы</span>
        </button>

        {/* Dynamic Mood Chips */}
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
