import { useEffect, useState } from 'react';
import { ArrowLeft, Star, UserPlus, UserRound } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States.jsx';
import { loadPublicProfile, requestFriend } from '../../engine/social.js';
import { withPlural, FORMS } from '../../../shared/i18n/plural.js';

/**
 * Профиль другого человека.
 *
 * Показывает только то, что он опубликовал сам: имя, ник, описание
 * и обезличенную статистику. Ни почты, ни истории решений — списки
 * фильмов остаются личным делом каждого.
 */
export function PublicProfileView({ username, onBack, toasts }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    loadPublicProfile(username)
      .then((person) => { if (alive) setState({ loading: false, person }); })
      .catch((error) => { if (alive) setState({ loading: false, error }); });
    return () => { alive = false; };
  }, [username]);

  if (state.loading) return <LoadingState text="Открываем профиль…" />;
  if (state.error) {
    return <ErrorState error={{ text: 'Не удалось загрузить профиль', retryable: true }} module="social.profile" />;
  }
  if (!state.person) {
    return (
      <div className="view">
        <button type="button" className="btn btn--quiet btn--sm" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
          <ArrowLeft size={16} /> Назад
        </button>
        <EmptyState icon={UserRound} title="Профиль не найден" text={`Ника @${username} не существует.`} />
      </div>
    );
  }

  const { person } = state;
  const { stats } = person;

  return (
    <div className="view">
      <button type="button" className="btn btn--quiet btn--sm" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <ArrowLeft size={16} /> Назад
      </button>

      <div className="public-profile">
        {person.photoURL
          ? <img className="public-profile__avatar" src={person.photoURL} alt="" />
          : <span className="public-profile__avatar" style={{ display: 'grid', placeItems: 'center' }}>
              <UserRound size={40} color="var(--text-low)" />
            </span>}

        <div className="stack gap-1" style={{ alignItems: 'center' }}>
          <h1 className="public-profile__name">{person.displayName}</h1>
          <span className="public-profile__handle">@{person.username}</span>
        </div>

        {person.bio && <p className="public-profile__bio">{person.bio}</p>}

        <div className="stat-row" style={{ width: '100%' }}>
          <div className="stat">
            <span className="stat__value">{stats.watched}</span>
            <span className="stat__label">просмотрено</span>
          </div>
          <div className="stat">
            <span className="stat__value">{stats.favorites}</span>
            <span className="stat__label">понравилось</span>
          </div>
          <div className="stat">
            <span className="stat__value">{stats.ratings}</span>
            <span className="stat__label">оценок</span>
          </div>
          {stats.averageRating !== null && (
            <div className="stat">
              <span className="stat__value" style={{ color: 'var(--gold)' }}>{stats.averageRating}</span>
              <span className="stat__label">средняя</span>
            </div>
          )}
        </div>

        {stats.ratings > 0 && (
          <p className="faint" style={{ fontSize: 'var(--t-small)' }}>
            Поставил {withPlural(stats.ratings, FORMS.RATING)}
            {stats.averageRating !== null && <> · в среднем <Star size={11} style={{ verticalAlign: -1 }} /> {stats.averageRating}</>}
          </p>
        )}

        <button
          type="button"
          className="btn btn--primary"
          onClick={async () => {
            try {
              const status = await requestFriend(person.id);
              toasts.success(status === 'accepted' ? 'Теперь вы друзья' : 'Заявка отправлена');
            } catch (error) {
              toasts.error(error?.message ?? 'Не получилось отправить заявку');
            }
          }}
        >
          <UserPlus size={16} /> Добавить в друзья
        </button>
      </div>
    </div>
  );
}
