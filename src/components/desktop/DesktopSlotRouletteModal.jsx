import React, { useState, useEffect, useRef } from 'react';
import { X, Dices, Play, Sparkles, Star } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSound } from '../../engine/soundEngine.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { getPosterUrl } from '../../engine/imagePrefetcher.js';

export function DesktopSlotRouletteModal({
  movies = [],
  onClose,
  onSelectMovie
}) {
  const [spinning, setSpinning] = useState(false);
  const [reel1, setReel1] = useState('🎲 Жанр');
  const [reel2, setReel2] = useState('✨ Вайб');
  const [reel3, setReel3] = useState('🎬 Фильм');
  const [selectedMovie, setSelectedMovie] = useState(null);

  const genresPool = ['🔥 Боевик', '🧠 Триллер', '🌃 Нео-нуар', '⛩ Аниме', '🛸 Фантастика', '😂 Комедия', '🕵️ Детектив', '👑 Драма'];
  const vibesPool = ['⚡ Взрывной драйв', '🚬 Квентин Тарантино', '🧠 Кристофер Нолан', '🌌 Космос и тайны', '💔 До слёз', '🏆 Шедевр Оскара'];

  const handleSpin = () => {
    if (spinning || movies.length === 0) return;
    setSpinning(true);
    setSelectedMovie(null);
    triggerHaptic('heavy');

    const winner = movies[Math.floor(Math.random() * movies.length)];
    const winGenre = winner.genres ? `🎬 ${winner.genres.split(',')[0].trim()}` : genresPool[Math.floor(Math.random() * genresPool.length)];
    const winVibe = winner.director ? `🎥 ${winner.director}` : vibesPool[Math.floor(Math.random() * vibesPool.length)];

    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      setReel1(genresPool[Math.floor(Math.random() * genresPool.length)]);
      setReel2(vibesPool[Math.floor(Math.random() * vibesPool.length)]);
      const randM = movies[Math.floor(Math.random() * movies.length)];
      setReel3(randM.titleRu || randM.title);
      playSound('wheel_tick');

      if (ticks > 22) {
        clearInterval(interval);
        // Stop reel 1
        setReel1(winGenre);
        setTimeout(() => {
          // Stop reel 2
          setReel2(winVibe);
          setTimeout(() => {
            // Stop reel 3 (Winner!)
            setReel3(winner.titleRu || winner.title);
            setSelectedMovie(winner);
            setSpinning(false);
            triggerHaptic('success');
            playSound('match_celebration');

            try {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#ff5e62', '#ff9966', '#ffd60a', '#0a84ff']
              });
            } catch (e) {}
          }, 400);
        }, 350);
      }
    }, 90);
  };

  return (
    <div className="desktop-modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          padding: '32px',
          border: '1px solid rgba(255, 94, 98, 0.4)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 40px var(--accent-glow)',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn-icon"
          style={{ position: 'absolute', top: '16px', right: '16px' }}
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
          <Dices size={24} color="#ff9966" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'Syne', color: '#fff' }}>
            Кино-Слот Машина 🎰
          </h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Крутите 3 барабана и доверьте выбор идеального фильма искусственному интеллекту MatchWatch!
        </p>

        {/* 3 Reels Container */}
        <div className="slot-machine-container" style={{ marginBottom: '24px' }}>
          {/* Reel 1: Genre */}
          <div className={`slot-reel ${spinning ? 'slot-reel-spinning' : ''}`}>
            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffd60a', padding: '10px' }}>
              {reel1}
            </div>
          </div>

          {/* Reel 2: Vibe / Director */}
          <div className={`slot-reel ${spinning ? 'slot-reel-spinning' : ''}`}>
            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ff9966', padding: '10px' }}>
              {reel2}
            </div>
          </div>

          {/* Reel 3: Movie Winner */}
          <div className={`slot-reel ${spinning ? 'slot-reel-spinning' : ''}`} style={{ borderColor: selectedMovie ? 'var(--accent-coral)' : undefined }}>
            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#fff', padding: '10px' }}>
              {reel3}
            </div>
          </div>
        </div>

        {/* Spin Trigger Button */}
        <button
          onClick={handleSpin}
          disabled={spinning}
          className="btn-primary"
          style={{
            padding: '14px 36px',
            fontSize: '1.05rem',
            opacity: spinning ? 0.6 : 1,
            boxShadow: '0 0 30px var(--accent-glow)'
          }}
        >
          <Sparkles size={18} />
          <span>{spinning ? 'Барабаны крутятся...' : 'КРУТИТЬ БАРАБАНЫ 🎰'}</span>
        </button>

        {/* Winner Showcase Card */}
        {selectedMovie && (
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(255, 94, 98, 0.12)',
            border: '1px solid rgba(255, 94, 98, 0.4)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src={getPosterUrl(selectedMovie)}
                alt={selectedMovie.titleRu || selectedMovie.title}
                style={{ width: '48px', height: '68px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
              />
              <div>
                <div style={{ fontSize: '0.72rem', color: '#ffd60a', fontWeight: '700', textTransform: 'uppercase' }}>
                  ★ ВЫБОР ФОРТУНЫ
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '2px' }}>
                  {selectedMovie.titleRu || selectedMovie.title}
                </h4>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {selectedMovie.year} • {selectedMovie.genres}
                </div>
              </div>
            </div>

            <button
              onClick={() => onSelectMovie(selectedMovie)}
              className="btn-primary"
              style={{ padding: '9px 18px', fontSize: '0.825rem' }}
            >
              <Play size={14} fill="currentColor" /> Открыть фильм
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
