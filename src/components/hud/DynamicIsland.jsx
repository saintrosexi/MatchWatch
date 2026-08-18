import React from 'react';
import { Volume2, VolumeX, Users, Filter, Dice5 } from 'lucide-react';
import { playSound, setSoundEnabled } from '../../engine/soundEngine.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';

export function DynamicIsland({
  islandState,
  soundOn,
  setSoundOn,
  activeRoom,
  currentTab = 'feed',
  onOpenFilters,
  onOpenRoulette
}) {
  const isExpanded = islandState && islandState.mode !== 'idle';
  const isFeedTab = currentTab === 'feed';

  const toggleSound = (e) => {
    e.stopPropagation();
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    triggerHaptic('light');
    if (next) playSound('tap');
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      width: '100%',
      zIndex: 1000,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '100%',
        maxWidth: isExpanded ? '440px' : '410px',
        minHeight: '48px',
        background: isExpanded ? 'rgba(16, 16, 26, 0.96)' : 'rgba(12, 12, 18, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '999px',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: isExpanded
          ? '0 12px 36px rgba(0, 0, 0, 0.85), 0 0 24px var(--accent-glow)'
          : '0 8px 24px rgba(0, 0, 0, 0.65)',
        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        gap: '8px'
      }}>
        {/* Left Side: Original MatchWatch Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isExpanded && islandState.icon ? (
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 94, 98, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}>
              {islandState.icon}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img
                src="/logo.png"
                alt="MatchWatch"
                style={{
                  height: '24px',
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 10px rgba(255, 94, 98, 0.45))'
                }}
              />
            </div>
          )}
        </div>

        {/* Center: Dynamic Status / Room Badge */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isExpanded ? 'flex-start' : 'center',
          overflow: 'hidden',
          padding: '0 4px'
        }}>
          {isExpanded ? (
            <>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
              }}>
                {islandState.message}
              </div>
              {islandState.subMessage && (
                <div style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}>
                  {islandState.subMessage}
                </div>
              )}
            </>
          ) : activeRoom ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              background: 'rgba(255, 94, 98, 0.15)',
              border: '1px solid rgba(255, 94, 98, 0.4)',
              borderRadius: '999px',
              fontSize: '0.75rem',
              color: '#ff9966',
              fontWeight: '700',
              fontFamily: 'Space Grotesk'
            }}>
              <Users size={12} />
              <span>{activeRoom.code}</span>
              <span style={{ opacity: 0.7 }}>• {activeRoom.members?.length || 1}👥</span>
            </div>
          ) : null}
        </div>

        {/* Right Side: Action Toggles (Filters & Roulette strictly on Feed/Swipe tab) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Cinema Roulette Trigger (only on Feed) */}
          {isFeedTab && onOpenRoulette && (
            <button
              onClick={() => {
                triggerHaptic('light');
                playSound('tap');
                onOpenRoulette();
              }}
              title="Кино-рулетка"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Dice5 size={16} />
            </button>
          )}

          {/* Filters Modal Trigger (only on Feed) */}
          {isFeedTab && onOpenFilters && (
            <button
              onClick={() => {
                triggerHaptic('light');
                playSound('tap');
                onOpenFilters();
              }}
              title="Фильтры колоды"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Filter size={15} />
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={soundOn ? 'Выключить звук' : 'Включить звук'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: soundOn ? 'rgba(255, 94, 98, 0.15)' : 'rgba(255, 255, 255, 0.06)',
              border: soundOn ? '1px solid rgba(255, 94, 98, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
              color: soundOn ? '#ff9966' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}
