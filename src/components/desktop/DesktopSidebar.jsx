import React from 'react';
import {
  Flame,
  Film,
  Tv,
  Sparkles,
  Users,
  FolderHeart,
  User,
  Settings,
  Volume2,
  VolumeX
} from 'lucide-react';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound, setSoundEnabled } from '../../engine/soundEngine.js';

export function DesktopSidebar({
  activeTab,
  setActiveTab,
  likesCount = 0,
  activeRoom = null,
  soundOn = true,
  setSoundOn,
  onOpenSettings,
  user
}) {
  const mainNav = [
    { id: 'feed', label: 'Лента свайпов', icon: Flame, badge: null },
    { id: 'movies', label: 'Фильмы', icon: Film, badge: null },
    { id: 'series', label: 'Сериалы', icon: Tv, badge: null },
    { id: 'anime', label: 'Аниме', icon: Sparkles, badge: null },
    { id: 'actors', label: 'Звёзды кино', icon: User, badge: null },
    { id: 'vault', label: 'Фильмотека', icon: FolderHeart, badge: likesCount > 0 ? likesCount : null }
  ];

  const handleTabClick = (tabId) => {
    triggerHaptic('light');
    playSound('tap');
    setActiveTab(tabId);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    triggerHaptic('light');
    if (next) playSound('tap');
  };

  return (
    <aside className="desktop-sidebar">
      {/* Top Section: Logo & Main Navigation */}
      <div>
        {/* Brand Logo Header */}
        <div className="desktop-sidebar-logo">
          <img
            src="/logo.png"
            alt="MatchWatch"
            style={{
              height: '28px',
              width: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 12px rgba(255, 94, 98, 0.45))'
            }}
          />
        </div>

        {/* Content Navigation Group */}
        <div className="desktop-nav-group">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`desktop-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.badge !== null && (
                  <span className="desktop-nav-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Rooms, Profile, Settings, Sound */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
        {/* Rooms / Social Sync */}
        <button
          onClick={() => handleTabClick('rooms')}
          className={`desktop-nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
        >
          <Users size={18} />
          <span>Комнаты</span>
          {activeRoom && (
            <span style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(255, 94, 98, 0.2)',
              border: '1px solid rgba(255, 94, 98, 0.4)',
              color: '#ff9966',
              fontSize: '0.7rem',
              fontWeight: '700',
              fontFamily: 'Space Grotesk'
            }}>
              {activeRoom.code}
            </span>
          )}
        </button>

        {/* Profile & Taste DNA */}
        <button
          onClick={() => handleTabClick('profile')}
          className={`desktop-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        >
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: '700',
            color: '#fff'
          }}>
            {user?.first_name ? user.first_name[0] : 'U'}
          </div>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.first_name || 'Киноман'}
          </span>
        </button>

        {/* Settings */}
        <button
          onClick={() => {
            triggerHaptic('light');
            playSound('tap');
            if (onOpenSettings) onOpenSettings();
          }}
          className="desktop-nav-item"
        >
          <Settings size={18} />
          <span>Настройки</span>
        </button>

        {/* Sound Toggle */}
        <button
          onClick={toggleSound}
          className="desktop-nav-item"
          style={{ marginTop: '4px', opacity: 0.85 }}
        >
          {soundOn ? <Volume2 size={18} color="#ff9966" /> : <VolumeX size={18} />}
          <span style={{ color: soundOn ? '#ff9966' : 'var(--text-muted)' }}>
            {soundOn ? 'Звук включен' : 'Без звука'}
          </span>
        </button>
      </div>
    </aside>
  );
}
