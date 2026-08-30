import { useMemo, useState } from 'react';
import { BarChart3, Crown, Download, LogOut, Pencil, Sparkles, Star, Users, Volume2, VolumeX, Vibrate } from '../../ui/icons.js';
import { Poster } from '../../ui/Poster.jsx';
import { EmptyState, StatusStrip } from '../../ui/States.jsx';
import { topTags, profileBreadth } from '../../engine/tasteProfile.js';
import { tagLabel } from '../../../shared/taxonomy/tagOntology.js';
import { getConfig } from '../../engine/recommendationConfig.js';
import { PREMIUM_CONFIG } from '../../../shared/config/premium.js';
import { withPlural, FORMS } from '../../../shared/i18n/plural.js';
import { TelegramLinkCard } from './TelegramLinkCard.jsx';

/**
 * Профиль вкуса.
 *
 * Показывает ровно то, на чём построена лента: 5D-вектор настроения
 * и накопленные веса тегов. Пользователь должен видеть, почему ему
 * показывают именно это, — иначе рекомендации выглядят произволом.
 */
export function ProfileView({
  user, taste, access, matches = {}, favorites = {}, ratings = {},
  prefs, onPrefsChange, onLogout, onOpenDashboard, onOpenTitle,
  onEditProfile, onEditShowcase, onOpenFriends, profile, auth, toasts,
  premium, onOpenPremium, onOpenNews,
}) {
  const [showAllTags, setShowAllTags] = useState(false);
  const tags = useMemo(() => topTags(taste, showAllTags ? 40 : 14), [taste, showAllTags]);
  const breadth = useMemo(() => profileBreadth(taste), [taste]);
  const config = getConfig();

  const warm = taste.signals >= config.exploration.warmupSignals;
  const matchCount = Object.keys(matches).length;
  const favoriteCount = Object.keys(favorites).length;
  const rated = useMemo(
    () => Object.values(ratings).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    [ratings],
  );
  const averageRating = rated.length
    ? Math.round((rated.reduce((a, r) => a + r.rating, 0) / rated.length) * 10) / 10
    : null;

  return (
    <div className="view">
      <section className="section">
        <h2 className="section__title">Премиум</h2>
        {/*
          * Первым блоком экрана — по решению от 31.08.2026.
          *
          * Премиум сейчас не выдан всем, а стоит ноль рублей и берётся
          * нажатием. Значит нажатие и есть то, что мы измеряем, — а то,
          * что измеряют, не прячут под настройки звука. Ниже по экрану
          * до него доходили бы единицы, и первая волна не сказала бы
          * о готовности платить ничего.
          */}
        <button type="button" className="member" style={{ cursor: 'pointer', width: '100%' }} onClick={onOpenPremium}>
          <Crown size={20} color={premium?.premium ? 'var(--gold)' : 'var(--text-mid)'} weight={premium?.premium ? 'fill' : 'regular'} />
          <span className="stack grow" style={{ textAlign: 'left' }}>
            <span className="member__name">
              {premium?.premium ? 'Премиум активен' : 'Подключить премиум'}
            </span>
            <span className="member__state">
              {premium?.premium
                ? `Осталось ${premium.daysLeft} дн. · оформление профиля открыто`
                : premium?.promoAvailable
                  /* Ноль называем вслух: «подключить» без цены звучит как счёт. */
                  ? `${PREMIUM_CONFIG.price.label} → 0 ₽ на первый месяц`
                  : `${PREMIUM_CONFIG.price.label} или ${PREMIUM_CONFIG.price.stars} звёзд в месяц`}
            </span>
          </span>
          {premium?.promoAvailable && <span className="chip chip--gold">месяц бесплатно</span>}
        </button>
      </section>

      <header className="stack gap-4">
        <div className="row gap-4">
          {(profile?.photo_url ?? user.photoURL)
            ? <img className="member__avatar" style={{ width: 64, height: 64 }} src={profile?.photo_url ?? user.photoURL} alt="" />
            : <div className="member__avatar member__avatar--empty" style={{ width: 64, height: 64 }}>
                {(profile?.display_name ?? user.displayName ?? '?')[0]?.toUpperCase()}
              </div>}
          <div className="stack grow" style={{ minWidth: 0 }}>
            <h1 className="view__title truncate">{profile?.display_name ?? user.displayName}</h1>
            {profile?.username
              ? <span className="public-profile__handle">@{profile.username}</span>
              : <span className="faint" style={{ fontSize: 'var(--t-small)' }}>ник не задан</span>}
          </div>
          {access?.tier === 'plus' && <span className="chip chip--gold"><Crown size={12} /> Plus</span>}
        </div>

        {profile?.bio && <p className="public-profile__bio" style={{ textAlign: 'left' }}>{profile.bio}</p>}

        <div className="row gap-2">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onEditProfile}>
            <Pencil size={16} /> Редактировать
          </button>
          {/*
            * Витрина отдельно от «редактировать»: там имя и ник — кто вы,
            * здесь — что из уже отмеченного показывать другим.
            */}
          {onEditShowcase && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onEditShowcase}>
              <Sparkles size={16} /> Витрина
            </button>
          )}
          {onOpenFriends && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenFriends}>
              <Users size={16} /> Друзья
            </button>
          )}
        </div>

        {!profile?.username && (
          <StatusStrip tone="warn" action={{ label: 'Задать', onClick: onEditProfile }}>
            Задайте ник — без него друзья не смогут вас найти.
          </StatusStrip>
        )}
      </header>

      <div className="stat-row">
        <div className="stat">
          <span className="stat__value">{taste.counts.like + taste.counts.favorite}</span>
          <span className="stat__label">оценок «да»</span>
        </div>
        <div className="stat">
          <span className="stat__value">{favoriteCount}</span>
          <span className="stat__label">нравится</span>
        </div>
        <div className="stat">
          <span className="stat__value">{matchCount}</span>
          <span className="stat__label">мэтчей</span>
        </div>
        <div className="stat">
          <span className="stat__value">{Math.round(breadth * 100)}<span style={{ fontSize: 14 }}>%</span></span>
          <span className="stat__label">широта вкуса</span>
        </div>
        {averageRating !== null && (
          <div className="stat">
            <span className="stat__value" style={{ color: 'var(--gold)' }}>{averageRating}</span>
            <span className="stat__label">средняя оценка</span>
          </div>
        )}
      </div>

      {/*
        * Здесь была паутинка усреднённого настроения. Убрана вместе
        * с самим вектором: он сводил весь вкус в одну точку между
        * любимыми фильмами, и картинка выходила не про человека,
        * а про середину между его вкусами. Темы, которые показаны
        * ниже, ничего не усредняют и прямо участвуют в подборе —
        * человек узнаёт в них себя, а в пятиугольнике не узнавал.
        */}
      {!warm && (
        <p className="faint" style={{ fontSize: 'var(--t-small)' }}>
          {`Ещё ${withPlural(Math.max(0, config.exploration.warmupSignals - taste.signals), FORMS.SWIPE)}, `
            + 'и рекомендации станут заметно точнее. Пока показываем больше разного.'}
        </p>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Что вы любите</h2>
          {tags.length > 14 && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setShowAllTags((v) => !v)}>
              {showAllTags ? 'Свернуть' : 'Все темы'}
            </button>
          )}
        </div>

        {tags.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Профиль пока пуст"
            text="Свайпните десяток фильмов — и здесь появятся ваши любимые темы: от самураев до ограблений."
          />
        ) : (
          <>
            <div className="tag-cloud">
              {tags.map(({ tag, weight }) => (
                <span
                  key={tag}
                  className="tag-cloud__item"
                  style={{
                    borderColor: `rgba(255,77,94,${Math.min(0.75, 0.15 + weight / 12)})`,
                    background: `rgba(255,77,94,${Math.min(0.22, weight / 40)})`,
                  }}
                >
                  {tagLabel(tag)} <b>{weight}</b>
                </span>
              ))}
            </div>
            <p className="faint" style={{ fontSize: 'var(--t-micro)' }}>
              Вес растёт от свайпов и особенно от сердечка, медленно снижается от пропусков
              и стареет со временем — вкус живой.
            </p>
          </>
        )}
      </section>

      {rated.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Мои оценки</h2>
            <span className="faint" style={{ fontSize: 'var(--t-small)' }}>{rated.length}</span>
          </div>
          <div className="scroll-x">
            {rated.slice(0, 12).map((item) => (
              <button
                type="button"
                key={item.id}
                className="rated-card"
                onClick={() => onOpenTitle?.(item)}
                title={`${item.title} — ваша оценка ${item.rating}`}
              >
                <Poster src={item.poster} alt={item.title} size="w185" />
                <span className="rated-card__score">{item.rating}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {auth && (
        <TelegramLinkCard
          user={user}
          links={auth.links}
          inTelegram={auth.inTelegram}
          onLink={auth.linkTelegram}
          onUnlink={auth.unlinkTelegram}
          toast={toasts}
        />
      )}

      {/*
        * Импорт оценок. Пока анонс, а не кнопка.
        *
        * Место занято намеренно: перенос истории из Кинопоиска решает
        * холодный старт — три сотни настоящих оценок делают ленту
        * осмысленной с первого экрана, вместо десятков свайпов вслепую.
        * Пока он не готов, честнее показать, что он в работе, чем
        * поставить кнопку, которая ничего не делает.
        */}
      <section className="section">
        <h2 className="section__title">Импорт оценок</h2>
        <div className="import-teaser">
          <Download size={20} color="var(--text-low)" />
          <span className="stack grow gap-1">
            <span className="member__name">Из Кинопоиска</span>
            <span className="member__state">
              Перенесём оценки и просмотренное — подборка сразу станет вашей.
            </span>
          </span>
          <span className="chip">в работе</span>
        </div>
        <p className="faint" style={{ fontSize: 'var(--t-small)' }}>
          Находится в работе, ожидайте.
        </p>
      </section>

      <section className="section">
        <h2 className="section__title">Настройки</h2>
        <div className="stack gap-2">
          <SettingRow
            icon={prefs.sound ? Volume2 : VolumeX}
            label="Звуки"
            hint="Отклик на свайпы и фанфара мэтча"
            checked={prefs.sound}
            onChange={(v) => onPrefsChange({ sound: v })}
          />
          <SettingRow
            icon={Vibrate}
            label="Тактильный отклик"
            hint="Нативная вибрация Telegram"
            checked={prefs.haptics}
            onChange={(v) => onPrefsChange({ haptics: v })}
          />
          <SettingRow
            icon={Star}
            label="Предлагать оценить"
            hint="Спрашиваем про фильм из «Нравится» — оценка уточняет ленту"
            checked={prefs.ratePrompt !== false}
            onChange={(v) => onPrefsChange({ ratePrompt: v })}
          />
        </div>
      </section>

      <div className="row gap-3">
        {onOpenNews && (
          <button type="button" className="btn btn--ghost" onClick={onOpenNews}>
            <Sparkles size={16} /> Что нового
          </button>
        )}
        {onOpenDashboard && (
          <button type="button" className="btn btn--ghost" onClick={onOpenDashboard}>
            <BarChart3 size={16} /> Метрики
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--danger grow" onClick={onLogout}>
          <LogOut size={16} /> Выйти
        </button>
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, hint, checked, onChange }) {
  return (
    <label className="member" style={{ cursor: 'pointer' }}>
      <Icon size={20} color="var(--text-mid)" />
      <span className="stack grow">
        <span className="member__name">{label}</span>
        <span className="member__state">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 20, height: 20, accentColor: 'var(--coral)' }}
      />
    </label>
  );
}
