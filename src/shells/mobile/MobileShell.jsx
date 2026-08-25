import { WifiOff } from 'lucide-react';
import { BrandLockup } from '../../ui/Brand.jsx';

/**
 * Mobile TMA Shell.
 *
 * Плавающий док вместо таб-бара: он не съедает высоту под карточку
 * и переживает fullscreen-режим Telegram, где системные отступы плавают.
 */
/** Инициалы вместо пустого кружка, когда у пользователя нет аватара. */
const initials = (name) => String(name ?? '?')
  .trim().split(/\s+/).slice(0, 2)
  .map((part) => part[0] ?? '')
  .join('')
  .toUpperCase() || '?';

export function MobileShell({
  nav, active, onNavigate, children, fixed = false,
  user, online = true, statusStrip, right, onOpenProfile,
}) {
  return (
    <div className="mobile-shell">
      <header className="hud">
        <BrandLockup size="sm" />
        <div className="hud__spacer" />
        {right}
        {!online && (
          <span className="hud__pill" title="Нет соединения">
            <WifiOff size={14} color="var(--coral)" />
          </span>
        )}
        {user && (
          // Профиль вынесен из дока, чтобы «Вместе» встало ровно по центру.
          <button
            type="button"
            className="hud__avatar-btn"
            onClick={onOpenProfile}
            aria-label={`Профиль: ${user.displayName}`}
            aria-current={active === 'profile' ? 'page' : undefined}
          >
            {user.photoURL
              ? <img className="hud__avatar" src={user.photoURL} alt="" />
              : <span className="hud__avatar hud__avatar--empty">{initials(user.displayName)}</span>}
          </button>
        )}
      </header>

      {statusStrip}

      <main className={`mobile-shell__main ${fixed ? 'mobile-shell__main--fixed' : ''}`}>
        {children}
      </main>

      <nav className="dock" aria-label="Основная навигация">
        {nav.map((item) => (
          <button
            key={item.key}
            type="button"
            className="dock__item"
            aria-current={active === item.key ? 'page' : undefined}
            onClick={() => onNavigate(item.key)}
          >
            <item.icon className="dock__icon" size={20} strokeWidth={active === item.key ? 2.3 : 1.8} />
            <span>{item.label}</span>
            {item.badge > 0 && <span className="dock__badge">{item.badge > 9 ? '9+' : item.badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
