import React, { useState, useRef } from 'react';
import { X, Play, RotateCw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getPosterUrl } from '../../engine/imagePrefetcher.js';
import { playSound } from '../../engine/soundEngine.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';

export function FortuneWheelModal({
  movies = [],
  onClose,
  onSelectMovie
}) {
  const candidateMovies = movies.length > 0 ? movies.slice(0, 8) : [];
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState(null);

  const numSlices = candidateMovies.length || 1;
  const sliceAngle = 360 / numSlices;

  const colors = [
    '#f59e0b', '#3b82f6', '#ff4757', '#10b981',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
  ];

  const handleSpin = () => {
    if (isSpinning || candidateMovies.length === 0) return;
    setIsSpinning(true);
    setWinner(null);
    triggerHaptic('medium');

    const extraSpins = 5 + Math.floor(Math.random() * 3); // 5 to 7 full rotations
    const winningIndex = Math.floor(Math.random() * candidateMovies.length);
    const targetSliceAngle = 360 - (winningIndex * sliceAngle + sliceAngle / 2);
    const targetRotation = rotation + (extraSpins * 360) + targetSliceAngle;

    // Simulate tick sounds
    let tickCount = 0;
    const interval = setInterval(() => {
      playSound('wheel_tick');
      triggerHaptic('light');
      tickCount++;
      if (tickCount > 24) clearInterval(interval);
    }, 120);

    setRotation(targetRotation);

    setTimeout(() => {
      setIsSpinning(false);
      const selected = candidateMovies[winningIndex];
      setWinner(selected);
      playSound('match_celebration');
      triggerHaptic('success');
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }, 3800);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <div className="sheet-handle" />

        <button
          onClick={onClose}
          className="btn-icon"
          style={{ position: 'absolute', top: '20px', right: '20px' }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={20} color="var(--accent-gold)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>Кино-рулетка фортуны</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Не можете определиться? Доверьте выбор колесу судьбы!
        </p>

        {/* Wheel Container */}
        <div style={{
          position: 'relative',
          width: '280px',
          height: '280px',
          margin: '0 auto 24px'
        }}>
          {/* Center Indicator Arrow */}
          <div style={{
            position: 'absolute',
            top: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            width: '0',
            height: '0',
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderTop: '20px solid var(--accent-gold)',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.8))'
          }} />

          {/* Rotating Wheel Canvas/SVG */}
          <svg
            width="280"
            height="280"
            viewBox="0 0 280 280"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? 'transform 3.8s cubic-bezier(0.12, 0.8, 0.18, 1)' : 'none',
              borderRadius: '50%',
              boxShadow: '0 0 40px rgba(0,0,0,0.9), 0 0 20px var(--accent-gold-glow)',
              border: '4px solid rgba(255, 255, 255, 0.15)'
            }}
          >
            {candidateMovies.map((m, idx) => {
              const startAngle = (idx * sliceAngle) * (Math.PI / 180);
              const endAngle = ((idx + 1) * sliceAngle) * (Math.PI / 180);
              const x1 = 140 + 140 * Math.cos(startAngle);
              const y1 = 140 + 140 * Math.sin(startAngle);
              const x2 = 140 + 140 * Math.cos(endAngle);
              const y2 = 140 + 140 * Math.sin(endAngle);
              const pathData = `M 140 140 L ${x1} ${y1} A 140 140 0 0 1 ${x2} ${y2} Z`;

              return (
                <path
                  key={m.id || idx}
                  d={pathData}
                  fill={colors[idx % colors.length]}
                  opacity="0.85"
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth="2"
                />
              );
            })}
            {/* Center Cap */}
            <circle cx="140" cy="140" r="28" fill="#0a0a0f" stroke="var(--accent-gold)" strokeWidth="3" />
          </svg>
        </div>

        {/* Winner Announcement or Spin Button */}
        {winner ? (
          <div style={{
            width: '100%',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid var(--accent-gold)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            marginBottom: '16px',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-gold)', fontWeight: '700', textTransform: 'uppercase' }}>
              Победитель рулетки:
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', fontFamily: 'Syne', margin: '4px 0 8px' }}>
              {winner.titleRu || winner.title}
            </div>
            <button
              onClick={() => {
                if (onSelectMovie) onSelectMovie(winner);
              }}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              <Play size={16} fill="currentColor" /> Открыть детали фильма
            </button>
          </div>
        ) : (
          <button
            onClick={handleSpin}
            disabled={isSpinning || candidateMovies.length === 0}
            className="btn-primary"
            style={{ width: '100%', maxWidth: '300px', fontSize: '1.05rem', padding: '16px 28px' }}
          >
            <RotateCw size={20} className={isSpinning ? 'anim-spin' : ''} />
            {isSpinning ? 'Крутим рулетку...' : 'Крутить колесо! 🎲'}
          </button>
        )}
      </div>
    </div>
  );
}
