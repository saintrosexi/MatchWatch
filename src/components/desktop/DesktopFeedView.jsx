import React, { useState, useEffect } from 'react';
import { SwipeDeck } from '../deck/SwipeDeck.jsx';
import { Sparkles, Film, Tv, Flame, Info, Heart, X, Star, RotateCcw } from 'lucide-react';
import { cineMoods } from '../../data/moods.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';
import { getPosterUrl } from '../../engine/imagePrefetcher.js';

export function DesktopFeedView({
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
  const currentMovie = deck[currentIndex];
  const currentPoster = currentMovie ? getPosterUrl(currentMovie) : '';

  const categories = [
    { id: 'all', label: 'Всё подряд', icon: '✨' },
    { id: 'movie', label: 'Фильмы', icon: '🎬' },
    { id: 'series', label: 'Сериалы', icon: '📺' },
    { id: 'anime', label: 'Аниме', icon: '⛩' }
  ];

  return (
    <div className="desktop-theatre-stage">
      {/* Dynamic Ambient Poster Glow */}
      {currentPoster && (
        <div
          className="desktop-ambient-glow"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255, 94, 98, 0.4) 0%, rgba(255, 153, 102, 0.2) 50%, transparent 80%)`
          }}
        />
      )}

      {/* Top Cine-Moods Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
        zIndex: 20
      }}>

        {/* Cine-Mood Presets */}
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          maxWidth: '850px',
          paddingBottom: '4px',
          scrollbarWidth: 'none'
        }}>
          <button
            onClick={() => {
              triggerHaptic('light');
              playSound('tap');
              onSelectMood(null);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              border: !selectedMood ? '1px solid rgba(255, 94, 98, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
              background: !selectedMood ? 'rgba(255, 94, 98, 0.16)' : 'rgba(255, 255, 255, 0.03)',
              color: !selectedMood ? '#ff9966' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            ✨ Все вайбы
          </button>

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
                  padding: '4px 12px',
                  borderRadius: '999px',
                  border: isSelected ? `1px solid ${mood.accentColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isSelected ? `${mood.accentColor}24` : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: isSelected ? '700' : '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{mood.icon}</span>
                <span>{mood.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 3D Card Stack (Cinema Pro Stage) */}
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
