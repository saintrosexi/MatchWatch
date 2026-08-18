import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check, Flame, Users, UserCheck } from 'lucide-react';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function OnboardingStoryModal({ onComplete }) {
  const [slideIdx, setSlideIdx] = useState(0);

  const slides = [
    {
      title: 'Добро пожаловать в MatchWatch',
      subtitle: 'Новая эра выбора кино',
      description: 'Умный 5D-нейроалгоритм подбирает кино по энергии, интеллекту, эмоциям и вашему сиюминутному настроению.',
      icon: '🎬✨',
      badge: 'Премиум Кинозал'
    },
    {
      title: 'Тактильные 3D-Свайпы',
      subtitle: 'Управляйте жестами и клавишами',
      description: '👉 Вправо — Нравится ♥\n👈 Влево — Пропуск ✕\n👆 Вверх — В избранное ★\n👇 Вниз — Трейлер и детали ℹ',
      icon: '📱🕹',
      badge: 'Полная свобода'
    },
    {
      title: 'Синхронный выбор в комнатах',
      subtitle: 'Никаких споров перед экраном',
      description: 'Создайте комнату по 4-значному коду или ссылке. Как только вы оба лайкнете фильм — MatchWatch мгновенно устроит Match!',
      icon: '👥🍿',
      badge: 'Идеальный компромисс'
    },
    {
      title: 'Ваша ДНК Киновкуса',
      subtitle: 'Персональный профиль киномана',
      description: 'Открывайте свой архетип (Неоновый визионер, Эстет-интеллектуал), копите бейджи и делитесь кино-паспортом с друзьями.',
      icon: '🧬🏆',
      badge: 'Кино-паспорт'
    }
  ];

  const currentSlide = slides[slideIdx];

  const handleNext = () => {
    triggerHaptic('medium');
    playSound('tap');
    if (slideIdx < slides.length - 1) {
      setSlideIdx((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(7, 7, 9, 0.96)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      zIndex: 1400,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '40px 24px 32px'
    }}>
      {/* Top Slide Indicators */}
      <div style={{
        display: 'flex',
        gap: '8px',
        width: '100%',
        maxWidth: '360px',
        marginTop: '12px'
      }}>
        {slides.map((_, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '99px',
              background: idx <= slideIdx ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.15)',
              boxShadow: idx === slideIdx ? '0 0 10px var(--accent-gold)' : 'none',
              transition: 'all 0.3s ease'
            }}
          />
        ))}
      </div>

      {/* Center Slide Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: '380px'
      }}>
        <div style={{
          fontSize: '4.5rem',
          marginBottom: '20px',
          filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.6))',
          animation: 'floatGentle 3s infinite ease-in-out'
        }}>
          {currentSlide.icon}
        </div>

        <span className="chip chip-gold" style={{ marginBottom: '12px' }}>
          {currentSlide.badge}
        </span>

        <h2 style={{
          fontSize: '1.65rem',
          fontWeight: '800',
          fontFamily: 'Syne',
          lineHeight: '1.25',
          marginBottom: '8px'
        }}>
          {currentSlide.title}
        </h2>

        <div style={{
          fontSize: '0.95rem',
          fontWeight: '600',
          color: 'var(--accent-gold-light)',
          marginBottom: '16px'
        }}>
          {currentSlide.subtitle}
        </div>

        <p style={{
          fontSize: '0.9rem',
          lineHeight: '1.6',
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-line'
        }}>
          {currentSlide.description}
        </p>
      </div>

      {/* Bottom Controls */}
      <div style={{
        width: '100%',
        maxWidth: '360px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <button
          onClick={handleNext}
          className="btn-primary"
          style={{ width: '100%', padding: '16px 28px', fontSize: '1rem' }}
        >
          {slideIdx === slides.length - 1 ? (
            <>
              <Check size={20} /> Начать пользоваться
            </>
          ) : (
            <>
              Далее <ArrowRight size={18} />
            </>
          )}
        </button>

        {slideIdx < slides.length - 1 && (
          <button
            onClick={() => {
              triggerHaptic('light');
              onComplete();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            Пропустить обучение
          </button>
        )}
      </div>
    </div>
  );
}
