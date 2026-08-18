import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Play,
  QrCode,
  Sparkles,
  Heart,
  Dices,
  LogOut,
  Flame,
  Film
} from 'lucide-react';
import { createRoom, joinRoom, leaveRoom } from '../../engine/realtimeRooms.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';
import { getPosterUrl } from '../../engine/imagePrefetcher.js';

export function DesktopRoomsView({
  user,
  activeRoom = null,
  onStartRoomSwipe,
  onOpenRoulette,
  onOpenDetails
}) {
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [roomCategory, setRoomCategory] = useState('all'); // 'all' | 'movie' | 'anime' | 'series'

  const handleCreate = () => {
    triggerHaptic('medium');
    playSound('tap');
    createRoom({ hostUser: user });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    triggerHaptic('medium');
    playSound('tap');
    joinRoom({ roomCode: joinCodeInput.trim().toUpperCase(), user });
    setJoinCodeInput('');
  };

  const handleCopyLink = () => {
    if (!activeRoom) return;
    const url = `${window.location.origin}?room=${activeRoom.code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      triggerHaptic('success');
      playSound('tap');
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleStartCompromiseDeck = () => {
    if (!activeRoom || !activeRoom.deck) return;
    triggerHaptic('heavy');
    playSound('swipe_like');
    if (onStartRoomSwipe) onStartRoomSwipe(activeRoom.deck);
  };

  return (
    <div className="desktop-two-panel-grid" style={{ gridTemplateColumns: '360px 1fr' }}>
      {/* Left Panel: Create / Join Room / Code Card */}
      <div>
        {!activeRoom ? (
          /* Not in room state */
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(255, 94, 98, 0.15)',
                border: '1px solid rgba(255, 94, 98, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff9966'
              }}>
                <Users size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Кино на двоих</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Синхронный выбор фильма с партнёром</p>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '20px' }}>
              Создайте комнату или введите код партнера. Свайпайте фильмы одновременно — при взаимном лайке MatchWatch мгновенно уведомит вас!
            </p>

            <button
              onClick={handleCreate}
              className="btn-primary"
              style={{ width: '100%', marginBottom: '16px', padding: '12px' }}
            >
              <Sparkles size={16} /> Создать новую комнату
            </button>

            <div style={{ position: 'relative', margin: '20px 0', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />
              <span style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--bg-surface-1)',
                padding: '0 10px',
                fontSize: '0.75rem',
                color: 'var(--text-muted)'
              }}>
                ИЛИ
              </span>
            </div>

            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="ВВЕДИТЕ 4-ЗНАЧНЫЙ КОД"
                maxLength={4}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(10, 10, 16, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius-md)',
                  color: '#ff9966',
                  fontFamily: 'Space Grotesk',
                  fontWeight: '700',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                  letterSpacing: '0.2em',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={!joinCodeInput.trim()}
                className="btn-secondary"
                style={{ width: '100%', padding: '11px', opacity: joinCodeInput.trim() ? 1 : 0.5 }}
              >
                Войти в комнату
              </button>
            </form>
          </div>
        ) : (
          /* Active Room Card */
          <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(255, 94, 98, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="chip chip-sunset" style={{ fontSize: '0.75rem' }}>
                  ● ОНЛАЙН
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Комната</span>
              </div>

              <button
                onClick={() => {
                  triggerHaptic('medium');
                  playSound('tap');
                  leaveRoom();
                }}
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.72rem', color: '#ff5e62', borderColor: 'rgba(255,71,87,0.3)' }}
              >
                <LogOut size={12} /> Выйти
              </button>
            </div>

            {/* Room Code Display */}
            <div style={{
              textAlign: 'center',
              padding: '18px',
              background: 'rgba(10, 10, 16, 0.9)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Код для партнера:</div>
              <div style={{
                fontSize: '2.4rem',
                fontWeight: '900',
                fontFamily: 'Space Grotesk',
                color: '#ff9966',
                letterSpacing: '0.2em'
              }}>
                {activeRoom.code}
              </div>
            </div>

            {/* Copy Link Button */}
            <button
              onClick={handleCopyLink}
              className="btn-secondary"
              style={{ width: '100%', marginBottom: '16px', fontSize: '0.825rem' }}
            >
              {copiedLink ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
              {copiedLink ? 'Ссылка скопирована!' : 'Скопировать ссылку-приглашение'}
            </button>

            {/* Members in Room */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Участники ({activeRoom.members?.length || 1}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeRoom.members?.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--accent-gradient)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      color: '#fff'
                    }}>
                      {m.name ? m.name[0] : 'U'}
                    </div>
                    <span style={{ fontSize: '0.825rem', color: '#fff', fontWeight: '600' }}>
                      {m.name || 'Киноман'}
                    </span>
                    {m.id === user.id && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>(Вы)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Lobby Actions & Mutually Matched Movies Shelf */}
      <div>
        {activeRoom ? (
          <div>
            {/* Start Swiping Launch Box */}
            <div className="glass-panel" style={{
              padding: '24px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(26, 26, 40, 0.9) 0%, rgba(12, 12, 18, 0.95) 100%)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px' }}>
                  Синхронная колода готова к старту
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  Умный компромиссный подбор на основе вкусов обоих участников
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleStartCompromiseDeck}
                  className="btn-primary"
                  style={{ padding: '12px 24px', fontSize: '0.9rem' }}
                >
                  <Play size={16} fill="currentColor" /> Начать совместный свайп
                </button>
              </div>
            </div>

            {/* Mutually Liked Movies Shelf (Matches) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-sunset)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Heart size={18} fill="currentColor" color="var(--accent-coral)" />
                  Найденные совпадения (Matches: {activeRoom.matches?.length || 0})
                </h3>

                {activeRoom.matches?.length > 1 && (
                  <button
                    onClick={() => {
                      triggerHaptic('medium');
                      playSound('tap');
                      if (onOpenRoulette) onOpenRoulette();
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    <Dices size={14} /> Выбрать через рулетку 🎰
                  </button>
                )}
              </div>

              {!activeRoom.matches || activeRoom.matches.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✨</div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>
                    Пока нет общих совпадений
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Нажмите «Начать совместный свайп» — как только вы оба лайкнете фильм, он сразу появится здесь!
                  </p>
                </div>
              ) : (
                <div className="desktop-media-grid">
                  {activeRoom.matches.map((mObj) => {
                    const movie = mObj.movie;
                    const poster = getPosterUrl(movie);
                    return (
                      <div
                        key={movie.id}
                        onClick={() => {
                          triggerHaptic('light');
                          playSound('tap');
                          if (onOpenDetails) onOpenDetails(movie);
                        }}
                        className="desktop-media-card"
                      >
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', background: '#0a0a0f', overflow: 'hidden' }}>
                          <img
                            src={poster}
                            alt={movie.titleRu || movie.title}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(50, 215, 75, 0.9)',
                            color: '#000',
                            borderRadius: '999px',
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: '800'
                          }}>
                            MATCH! ❤️
                          </div>
                        </div>

                        <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <h4 style={{
                              fontSize: '0.9rem',
                              fontWeight: '700',
                              lineHeight: '1.3',
                              marginBottom: '4px',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {movie.titleRu || movie.title}
                            </h4>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {movie.year} • {movie.genres?.split(',')[0]}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* General info when not in room */
          <div className="glass-panel" style={{ padding: '40px 30px', textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '14px' }}>👥🍿</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px' }}>
              Идеальный вечер без споров о фильме
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 24px', lineHeight: '1.5' }}>
              Создайте комнату слева или подключитесь по коду от друга на смартфоне, планшете или ноутбуке. MatchWatch синхронизирует выбор в реальном времени!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
