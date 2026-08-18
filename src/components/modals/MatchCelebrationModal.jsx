import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Heart, Play, ArrowRight, Dice5, Share2 } from 'lucide-react';
import { getPosterUrl } from '../../engine/imagePrefetcher.js';
import { playSound } from '../../engine/soundEngine.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';

export function MatchCelebrationModal({
  match,
  onContinue,
  onOpenDetails,
  onOpenRoulette
}) {
  useEffect(() => {
    playSound('match_celebration');
    triggerHaptic('success');

    // Confetti fireworks burst
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#f59e0b', '#fbbf24', '#ff4757', '#3b82f6', '#ffffff']
    };

    function fire(particleRatio, opts) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, []);

  if (!match || !match.movie) return null;
  const movie = match.movie;
  const poster = getPosterUrl(movie);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(7, 7, 9, 0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 1300,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Radiant Spotlight Glow */}
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '320px',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, rgba(255, 71, 87, 0.15) 50%, transparent 70%)',
        filter: 'blur(40px)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Triumphant Header */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '16px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '999px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid var(--accent-gold)',
          color: 'var(--accent-gold-light)',
          fontFamily: 'Syne',
          fontWeight: '800',
          fontSize: '0.9rem',
          letterSpacing: '0.05em',
          marginBottom: '12px'
        }}>
          <Sparkles size={16} /> ИДЕАЛЬНОЕ СОВПАДЕНИЕ!
        </div>

        <h1 style={{
          fontSize: '2.4rem',
          lineHeight: '1.1',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #ffffff 0%, #fbbf24 60%, #ff4757 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          IT'S A MATCH!
        </h1>
      </div>

      {/* Connected Avatars Connection */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        position: 'relative',
        zIndex: 1,
        marginBottom: '20px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'var(--bg-surface-3)',
          border: '2px solid var(--accent-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem'
        }}>
          👑
        </div>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'var(--accent-coral)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px var(--accent-coral-glow)'
        }}>
          <Heart size={18} fill="#fff" color="#fff" />
        </div>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'var(--bg-surface-3)',
          border: '2px solid var(--accent-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem'
        }}>
          🍿
        </div>
      </div>

      {/* Matched Movie Poster Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '190px',
        height: '280px',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: '2px solid var(--accent-gold)',
        boxShadow: '0 16px 48px rgba(245, 158, 11, 0.4), 0 0 30px rgba(0,0,0,0.9)',
        marginBottom: '16px',
        animation: 'matchSpotlight 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <img
          src={poster}
          alt={movie.titleRu || movie.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, transparent 40%, rgba(7, 7, 9, 0.95) 100%)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '1rem',
            fontWeight: '800',
            fontFamily: 'Syne',
            color: '#fff',
            lineHeight: '1.2',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)'
          }}>
            {movie.titleRu || movie.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-gold)', marginTop: '3px' }}>
            ★ {movie.rating} • {movie.year}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '100%',
        maxWidth: '320px',
        position: 'relative',
        zIndex: 1
      }}>
        <button
          onClick={() => {
            triggerHaptic('medium');
            playSound('tap');
            if (onOpenDetails) onOpenDetails(movie);
          }}
          className="btn-primary"
        >
          <Play size={18} fill="currentColor" /> Смотреть информацию
        </button>

        {onOpenRoulette && (
          <button
            onClick={() => {
              triggerHaptic('medium');
              playSound('tap');
              onOpenRoulette();
            }}
            className="btn-secondary"
          >
            <Dice5 size={18} /> Крутить рулетку совпадений
          </button>
        )}

        <button
          onClick={() => {
            triggerHaptic('light');
            playSound('tap');
            onContinue();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          Продолжить свайпать дальше <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
