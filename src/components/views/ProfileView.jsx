import React from 'react';
import { getTasteDNA } from '../../engine/tasteProfileEngine.js';
import { RadarChart5D } from '../common/RadarChart5D.jsx';
import { Sparkles, Award, Flame, Film, Share2, Settings, UserCheck } from 'lucide-react';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function ProfileView({
  user,
  likedIds = [],
  onOpenSettings,
  onSharePassport
}) {
  const tasteDNA = getTasteDNA(likedIds);

  const progressPercent = Math.min(100, Math.round((likedIds.length / tasteDNA.nextThreshold) * 100));

  return (
    <div style={{ padding: '0 16px 24px', width: '100%' }}>
      {/* User Header */}
      <div className="glass-panel-thick" style={{ padding: '24px', textAlign: 'center', marginBottom: '20px', position: 'relative' }}>
        <button
          onClick={onOpenSettings}
          className="btn-icon"
          style={{ position: 'absolute', top: '16px', right: '16px' }}
          title="Настройки"
        >
          <Settings size={18} />
        </button>

        <div style={{
          width: '84px',
          height: '84px',
          borderRadius: '50%',
          margin: '0 auto 12px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '2px solid var(--accent-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          boxShadow: '0 0 20px var(--accent-gold-glow)'
        }}>
          {user.avatar || '🍿'}
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '2px' }}>
          {user.name}
        </h1>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          @{user.username} {user.isTelegram ? '• Telegram' : '• Гость'}
        </div>

        {/* Cinephile Rank Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 14px',
          borderRadius: '999px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid var(--accent-gold)',
          color: 'var(--accent-gold-light)',
          fontSize: '0.825rem',
          fontWeight: '700'
        }}>
          <Award size={14} /> Уровень {tasteDNA.level}: {tasteDNA.rankTitle}
        </div>

        {/* XP Bar */}
        <div style={{ marginTop: '14px', maxWidth: '280px', margin: '14px auto 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <span>Прогресс ранга</span>
            <span>{likedIds.length} / {tasteDNA.nextThreshold} лайков</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-gold), #ff4757)', borderRadius: '99px', transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* 5D Taste Archetype & Radar Card */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <span className="chip chip-gold" style={{ fontSize: '0.7rem', marginBottom: '4px' }}>
              Кино-Архетип
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>
              {tasteDNA.archetype.icon} {tasteDNA.archetype.name}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {tasteDNA.archetype.subtitle}
            </p>
          </div>
        </div>

        {/* 5D Radar */}
        <RadarChart5D vector={tasteDNA.vector} size={220} color="#f59e0b" />
      </div>

      {/* Top Genres Breakdown */}
      {tasteDNA.topGenres.length > 0 && (
        <div className="glass-panel" style={{ padding: '18px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-gold)', marginBottom: '12px' }}>
            Любимые жанры
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasteDNA.topGenres.map((g, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '3px' }}>
                  <span>{g.genre}</span>
                  <span style={{ color: 'var(--accent-gold-light)', fontWeight: '700', fontFamily: 'Space Grotesk' }}>{g.percent}%</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${g.percent}%`, height: '100%', background: 'var(--accent-gold)', borderRadius: '99px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Favorite Actors */}
      {tasteDNA.topActors.length > 0 && (
        <div className="glass-panel" style={{ padding: '18px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-gold)', marginBottom: '12px' }}>
            Любимые актёры в лайках
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {tasteDNA.topActors.map((a, idx) => (
              <span key={idx} className="chip">
                🎭 {a.name} ({a.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Export / Share Cine-Passport CTA */}
      <button
        onClick={() => {
          triggerHaptic('medium');
          playSound('tap');
          if (onSharePassport) onSharePassport(tasteDNA);
        }}
        className="btn-primary"
        style={{ width: '100%' }}
      >
        <Share2 size={18} /> Поделиться ДНК Кино-Паспорта
      </button>
    </div>
  );
}
