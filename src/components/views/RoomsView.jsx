import React, { useState } from 'react';
import { Users, Plus, ArrowRight, Share2, Copy, Check, Sparkles, Flame, Dice5, Play, LogOut } from 'lucide-react';
import { createRoom, joinRoom, leaveRoom } from '../../engine/realtimeRooms.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function RoomsView({
  user,
  activeRoom,
  onStartRoomSwipe,
  onOpenRoulette,
  onOpenDetails
}) {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('compromise_25');

  const presets = [
    { id: 'compromise_25', title: '25 компромиссов', subtitle: 'Точный баланс ваших 5D-вкусов' },
    { id: 'popcorn_party', title: 'Попкорн & Драйв', subtitle: 'Легкое зрелищное кино на вечер' },
    { id: 'noir_thriller', title: 'Острый триллер', subtitle: 'Мрачные загадки и саспенс' }
  ];

  const handleCreateRoom = async () => {
    triggerHaptic('medium');
    playSound('tap');
    await createRoom({ hostUser: user, preset: selectedPreset });
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    triggerHaptic('medium');
    playSound('tap');
    await joinRoom({ roomCode: joinCode.trim(), user });
    setJoinCode('');
  };

  const handleCopyCode = () => {
    if (!activeRoom) return;
    triggerHaptic('light');
    navigator.clipboard?.writeText(activeRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: '0 16px 24px', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '4px' }}>
          Совместный выбор
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Выбирайте фильмы вместе с партнером или компанией без споров
        </p>
      </div>

      {activeRoom ? (
        /* Active Room Management Screen */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Room PIN Code Card */}
          <div className="glass-panel-thick" style={{ padding: '24px', textAlign: 'center' }}>
            <span className="chip chip-gold" style={{ marginBottom: '12px' }}>
              Комната активна
            </span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              PIN-код для подключения:
            </div>
            <div className="pin-digits" style={{
              fontSize: '2.8rem',
              fontWeight: '800',
              letterSpacing: '0.15em',
              color: 'var(--accent-gold-light)',
              textShadow: '0 0 20px var(--accent-gold-glow)',
              marginBottom: '16px'
            }}>
              {activeRoom.code}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                onClick={handleCopyCode}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.825rem' }}
              >
                {copied ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                {copied ? 'Скопировано!' : 'Скопировать код'}
              </button>

              <button
                onClick={() => {
                  leaveRoom();
                  triggerHaptic('light');
                }}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.825rem', borderColor: 'rgba(255, 71, 87, 0.3)', color: '#ff6b81' }}
              >
                <LogOut size={14} /> Выйти
              </button>
            </div>
          </div>

          {/* Connected Members */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} color="var(--accent-gold)" /> Участники ({activeRoom.members?.length || 1})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeRoom.members?.map((member, idx) => (
                <div
                  key={member.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem'
                    }}>
                      {member.avatar || '🍿'}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                        {member.name} {member.isHost ? '👑' : ''}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Лайков: {member.likes?.length || 0}
                      </div>
                    </div>
                  </div>

                  <span className="chip" style={{ fontSize: '0.7rem' }}>
                    В сети 🟢
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Room Matches */}
          {activeRoom.matches && activeRoom.matches.length > 0 && (
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-gold)' }}>
                  🎉 Совпадения ({activeRoom.matches.length})
                </h3>
                {onOpenRoulette && (
                  <button
                    onClick={onOpenRoulette}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    <Dice5 size={14} /> Рулетка
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
                {activeRoom.matches.map((m, idx) => (
                  <div
                    key={idx}
                    onClick={() => onOpenDetails && onOpenDetails(m.movie)}
                    style={{
                      minWidth: '110px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <img
                      src={m.movie?.poster}
                      alt={m.movie?.titleRu}
                      style={{
                        width: '100px',
                        height: '145px',
                        borderRadius: 'var(--radius-sm)',
                        objectFit: 'cover',
                        border: '1.5px solid var(--accent-gold)'
                      }}
                    />
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.movie?.titleRu || m.movie?.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Start Swiping Button */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              playSound('tap');
              if (onStartRoomSwipe) onStartRoomSwipe(activeRoom.deck);
            }}
            className="btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '1.05rem' }}
          >
            <Flame size={20} fill="currentColor" /> Начать совместный свайп
          </button>
        </div>
      ) : (
        /* Room Creation & Join Hub */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Create Room Section */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--accent-gold)" /> Создать новую комнату
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Выберите тип колоды для сессии:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {presets.map((p) => {
                const isSelected = selectedPreset === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedPreset(p.id);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '1.5px solid var(--accent-gold)' : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: isSelected ? 'var(--accent-gold-light)' : 'var(--text-primary)' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {p.subtitle}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleCreateRoom}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              <Plus size={18} /> Создать комнату
            </button>
          </div>

          {/* Join by PIN Section */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#60a5fa" /> Присоединиться к комнате
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Введите 4-значный PIN-код от друга:
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="ABCD"
                maxLength={4}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--accent-gold-light)',
                  fontFamily: 'Space Grotesk',
                  fontSize: '1.3rem',
                  fontWeight: '800',
                  letterSpacing: '0.2em',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleJoinRoom}
                disabled={!joinCode.trim()}
                className="btn-primary"
                style={{ padding: '0 22px' }}
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
