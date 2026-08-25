import { WifiOff } from 'lucide-react';
import { BrandLockup } from '../../ui/Brand.jsx';

/**
 * Mobile TMA Shell.
 *
 * Вход в профиль живёт в нижней панели, а не в шапке: в Mini App правый
 * верхний угол занят кнопками Telegram, и аватар там был не виден и
 * не нажимался.
 *
 * Панель навигации прижата к нижней кромке и сама закрывает системный
 * отступ телефона: в fullscreen-режиме Telegram плавающая пилюля висела
 * над мёртвой полосой, а контент уезжал под неё.
 */
export function MobileShell({
  nav, active, onNavigate, children, fixed = false,
  user, online = true, statusStrip, right,
}) {
  return (
    <div className="mobile-shell">
      <header className="hud">
        {/* Распорка уводит логотип из-под кнопки «Закрыть» Telegram. */}
        <div className="hud__spacer hud__spacer--lead" />
        <BrandLockup size="sm" />
        <div className="hud__spacer" />
        {right}
        {!online && (
          <span className="hud__pill" title="Нет соединения">
            <WifiOff size={14} color="var(--coral)" />
          </span>
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
            {item.avatar
              ? (
                /* Аватар приглушён, пока вкладка не выбрана: он не должен
                   спорить с иконками соседей яркостью фотографии. */
                <img className="dock__avatar" src={item.avatar} alt="" />
              )
              : <item.icon className="dock__icon" size={20} strokeWidth={active === item.key ? 2.3 : 1.8} />}
            <span>{item.label}</span>
            {item.badge > 0 && <span className="dock__badge">{item.badge > 9 ? '9+' : item.badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
