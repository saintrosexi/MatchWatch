import React, { useState } from 'react';
import {
  Award,
  Sparkles,
  Share2,
  Settings,
  Shield,
  Flame,
  Check,
  TrendingUp,
  Sliders,
  Copy
} from 'lucide-react';
import { getTasteDNA } from '../../engine/tasteProfileEngine.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function DesktopProfileView({
  user,
  likedIds = [],
  onOpenSettings,
  onSharePassport
}) {
  const [copied, setCopied] = useState(false);
  const dna = getTasteDNA(likedIds);

  const handleCopyPassport = () => {
    const text = `🎬 Кино-паспорт MatchWatch:
👤 Имя: ${user?.first_name || 'Киноман'}
🧬 Архетип: ${dna.archetype.name} (Уровень ${dna.level})
🔥 Оценил фильмов: ${likedIds.length}
✨ Проверь свой киновкус в MatchWatch!`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      triggerHaptic('success');
      playSound('tap');
      if (onSharePassport) onSharePassport(dna);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const vectorDimensions = [
    { key: 'energy', label: '⚡ Энергия & Экшн', val: dna.vector.energy, color: '#ff5e62' },
    { key: 'intellect', label: '🧠 Интеллект & Сюжет', val: dna.vector.intellect, color: '#bf5af2' },
    { key: 'emotion', label: '💔 Эмоции & Драма', val: dna.vector.emotion, color: '#ff9966' },
    { key: 'darkness', label: '🌑 Нуар & Мрак', val: dna.vector.darkness, color: '#64d2ff' },
    { key: 'dynamism', label: '🏎 Динамика & Темп', val: dna.vector.dynamism, color: '#ffd60a' }
  ];

  return (
    <div className="desktop-two-panel-grid" style={{ gridTemplateColumns: '380px 1fr' }}>
      {/* Left Column: Cinephile Passport Card */}
      <div>
        <div className="glass-panel" style={{
          padding: '28px 24px',
          background: 'linear-gradient(135deg, rgba(24, 24, 38, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%)',
          border: '1px solid rgba(255, 94, 98, 0.35)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 94, 98, 0.15)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: '800',
                color: '#fff',
                boxShadow: '0 4px 16px var(--accent-glow)'
              }}>
                {user?.first_name ? user.first_name[0] : 'U'}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'Syne', color: '#fff' }}>
                  {user?.first_name || 'Киноман'}
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Уровень вкуса: <strong style={{ color: '#ff9966' }}>{dna.level}</strong>
                </div>
              </div>
            </div>

            <span className="chip chip-sunset" style={{ fontSize: '0.72rem' }}>
              КИНО-ПАСПОРТ
            </span>
          </div>

          {/* Archetype Hero Box */}
          <div style={{
            padding: '16px',
            background: 'rgba(10, 10, 16, 0.85)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '18px'
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Ваш кино-архетип:
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', fontFamily: 'Syne', color: 'var(--text-sunset)', marginBottom: '4px' }}>
              {dna.archetype.name}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {dna.archetype.description}
            </div>
          </div>

          {/* Core Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'Space Grotesk', color: '#ff5e62' }}>
                {likedIds.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Понравилось ♥</div>
            </div>

            <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'Space Grotesk', color: '#ffd60a' }}>
                {dna.archetype.badges?.length || 3}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ачивок открыто 🏆</div>
            </div>
          </div>

          {/* Copy Passport Button */}
          <button
            onClick={handleCopyPassport}
            className="btn-primary"
            style={{ width: '100%', padding: '11px', fontSize: '0.85rem' }}
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span>{copied ? 'Паспорт скопирован!' : 'Поделиться кино-паспортом'}</span>
          </button>
        </div>
      </div>

      {/* Right Column: 5D Taste Radar & Badges */}
      <div>
        {/* 5D Taste Sensation Vector */}
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-sunset)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} /> 5D-Вектор кинематографических ощущений
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {vectorDimensions.map((dim) => (
              <div key={dim.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{dim.label}</span>
                  <span style={{ color: dim.color, fontWeight: '700', fontFamily: 'Space Grotesk' }}>{dim.val} / 10</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '999px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${dim.val * 10}%`,
                    height: '100%',
                    background: dim.color,
                    borderRadius: '999px',
                    boxShadow: `0 0 10px ${dim.color}88`,
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Unlocked Badges Shelf */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffd60a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} /> Киноманские достижения
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {dna.archetype.badges?.map((badge, idx) => (
              <div
                key={idx}
                style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 214, 10, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ fontSize: '1.8rem' }}>🏆</div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>
                    {badge}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Разблокировано
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
