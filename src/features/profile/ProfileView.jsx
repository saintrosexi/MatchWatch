import { useMemo, useState } from 'react';
import { BarChart3, Crown, LogOut, Pencil, Sparkles, Users, Volume2, VolumeX, Vibrate } from '../../ui/icons.js';
import { Radar } from '../../ui/Radar.jsx';
import { Poster } from '../../ui/Poster.jsx';
import { EmptyState } from '../../ui/States.jsx';
import { topTags, profileBreadth } from '../../engine/tasteProfile.js';
import { tagLabel } from '../../../shared/taxonomy/tagOntology.js';
import { getConfig } from '../../engine/recommendationConfig.js';
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
  onEditProfile, onOpenFriends, profile, auth, toasts,
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
          {onOpenFriends && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenFriends}>
              <Users size={16} /> Друзья
            </button>
          )}
        </div>

        {!profile?.username && (
          <p className="status-strip status-strip--warn">
            Задайте ник — без него друзья не смогут вас найти.
          </p>
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

      <section className="taste-panel">
        <div className="section__head">
          <h2 className="section__title">Ваше кинематографическое настроение</h2>
          {!warm && <span className="chip chip--ice">набирается</span>}
        </div>

        <Radar vectors={[{ key: 'me', vector: taste.moods }]} />

        <p className="faint" style={{ fontSize: 'var(--t-small)' }}>
          {warm
            ? 'Профиль прогрет — лента настроена под вас.'
            : `Ещё ${withPlural(Math.max(0, config.exploration.warmupSignals - taste.signals), FORMS.SWIPE)}, и рекомендации станут заметно точнее. Пока показываем больше разного.`}
        </p>
      </section>

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
        </div>
      </section>

      <div className="row gap-3">
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
