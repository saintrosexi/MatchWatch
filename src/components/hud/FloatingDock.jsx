import React from 'react';
import { Flame, Compass, Users, Bookmark, Star, User } from 'lucide-react';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function FloatingDock({ activeTab, setActiveTab, likesCount = 0 }) {
  const tabs = [
    { id: 'feed', label: 'Свайп', icon: Flame },
    { id: 'discovery', label: 'Каталог', icon: Compass },
    { id: 'rooms', label: 'Комнаты', icon: Users },
    { id: 'vault', label: 'Сейф', icon: Bookmark, badge: likesCount },
    { id: 'actors', label: 'Звёзды', icon: Star },
    { id: 'profile', label: 'Профиль', icon: User }
  ];

  const handleTabClick = (tabId) => {
    if (activeTab !== tabId) {
      triggerHaptic('selection');
      playSound('tap');
      setActiveTab(tabId);
    }
  };

  return (
    <nav className="floating-dock-container" aria-label="Main Navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`dock-item ${isActive ? 'active' : ''}`}
            aria-label={tab.label}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span style={{
              fontSize: '0.65rem',
              fontWeight: isActive ? '700' : '500',
              fontFamily: 'Plus Jakarta Sans',
              letterSpacing: '-0.01em'
            }}>
              {tab.label}
            </span>

            {tab.badge > 0 && (
              <span className="dock-badge">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
