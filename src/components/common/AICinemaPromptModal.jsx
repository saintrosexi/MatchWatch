import React, { useState } from 'react';
import { Sparkles, Send, X, Flame, Brain, Compass, Film, Zap, Smile, Heart, ArrowRight } from 'lucide-react';
import { generateGeminiRecommendations } from '../../engine/geminiRecommender.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function AICinemaPromptModal({
  isOpen,
  onClose,
  onApplyAIDeck,
  userTasteVector,
  likedIds = []
}) {
  const [promptText, setPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const quickChips = [
    { label: '🧠 Взрыв мозга с твистами', query: 'Запутанный триллер или детектив с неожиданным твистом в финале' },
    { label: '⚡ Неоновый нуар и киберпанк', query: 'Мрачный стильный неоновый нуар и киберпанк' },
    { label: '🍕 Под пиццу с друзьями', query: 'Лёгкий, динамичный и смешной фильм для компании с пиццей' },
    { label: '🌌 Глубокий космос и смысл', query: 'Масштабная научная фантастика про космос, время и смысл жизни' },
    { label: '🔥 Адреналиновый драйв', query: 'Бешеный экшн и адреналиновые погони без лишних пауз' },
    { label: '😂 Посмеяться от души', query: 'Культовая комедия с отличным искрометным юмором' },
    { label: '💔 Драма до мурашек', query: 'Глубокая эмоциональная драма с потрясающей актёрской игрой' }
  ];

  const handleSubmit = async (textToUse = promptText) => {
    const q = textToUse.trim();
    if (!q) {
      setErrorMsg('Пожалуйста, введите ваш запрос или выберите настроение.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);
    triggerHaptic('medium');
    playSound('tap');

    try {
      const result = await generateGeminiRecommendations({
        prompt: q,
        userTasteVector,
        likedIds
      });

      if (result && result.success && result.deck.length > 0) {
        playSound('match_celebration');
        triggerHaptic('success');
        onApplyAIDeck(result.deck, result.aiSummary);
        onClose();
      } else {
        setErrorMsg('Не удалось собрать колоду. Попробуйте другой запрос.');
      }
    } catch (e) {
      console.error('AI Recommender error:', e);
      setErrorMsg('Произошла ошибка при обращении к AI. Попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      animation: 'fadeIn 0.25s ease-out'
    }}>
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'linear-gradient(180deg, rgba(24, 24, 38, 0.95) 0%, rgba(14, 14, 22, 0.98) 100%)',
          border: '1.5px solid rgba(255, 94, 98, 0.35)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 94, 98, 0.15)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            triggerHaptic('light');
            playSound('tap');
            onClose();
          }}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={16} />
        </button>

        {/* Header with Glowing Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(255, 94, 98, 0.25), rgba(255, 153, 102, 0.15))',
            border: '1px solid rgba(255, 94, 98, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ff9966',
            boxShadow: '0 0 16px rgba(255, 94, 98, 0.25)'
          }}>
            <Sparkles size={24} />
          </div>

          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'Syne, sans-serif', color: '#fff' }}>
              MatchWatch AI Консьерж
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Опишите любое кино-желание — Gemini соберёт умную колоду из 25 фильмов
            </p>
          </div>
        </div>

        {/* Text Input Area */}
        <div style={{ position: 'relative' }}>
          <textarea
            value={promptText}
            onChange={(e) => {
              setPromptText(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="Например: Хочу мрачный детектив под дождь с неожиданным финалом или что-то про космос и одиночество..."
            rows={3}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              fontSize: '0.88rem',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.4
            }}
          />
        </div>

        {errorMsg && (
          <div style={{ fontSize: '0.78rem', color: '#ff5e62', fontWeight: '600' }}>
            {errorMsg}
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ✨ Быстрые идеи для запроса:
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            maxHeight: '120px',
            overflowY: 'auto'
          }}>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPromptText(chip.query);
                  triggerHaptic('light');
                  playSound('tap');
                }}
                disabled={isLoading}
                style={{
                  padding: '6px 11px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.74rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 94, 98, 0.4)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => handleSubmit()}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: '16px',
            border: 'none',
            background: 'linear-gradient(135deg, #ff5e62 0%, #ff9966 100%)',
            color: '#fff',
            fontWeight: '700',
            fontSize: '0.92rem',
            cursor: isLoading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(255, 94, 98, 0.35)',
            opacity: isLoading ? 0.75 : 1,
            transition: 'all 0.2s ease'
          }}
        >
          {isLoading ? (
            <>
              <div style={{
                width: '18px',
                height: '18px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <span>Gemini анализирует базу фильмов...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <span>Собрать персональную AI-колоду</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
