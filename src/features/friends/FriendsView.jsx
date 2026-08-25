import { useCallback, useEffect, useState } from 'react';
import { Check, Search, UserMinus, UserPlus, Users, X } from '../../ui/icons.js';
import { EmptyState, LoadingState } from '../../ui/States.jsx';
import {
  acceptFriend, loadFriends, removeFriend, requestFriend, searchPeople,
} from '../../engine/social.js';

/**
 * «Друзья»: поиск людей и список связей.
 *
 * Поиск по нику работает с первых букв, по почте — только целиком.
 * Это не придирка к удобству: поиск по части адреса позволил бы
 * перебором вычерпать базу пользователей.
 */
export function FriendsView({ me, onOpenProfile, toasts }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    loadFriends()
      .then(setFriends)
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  // Поиск с задержкой: не дёргаем базу на каждую букву.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setFound([]); return undefined; }

    setSearching(true);
    const timer = setTimeout(() => {
      searchPeople(trimmed)
        .then(setFound)
        .catch(() => setFound([]))
        .finally(() => setSearching(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const act = async (fn, person, message) => {
    try {
      await fn(person.id);
      refresh();
      if (message) toasts.success(message);
    } catch (error) {
      toasts.error(error?.message ?? 'Не получилось');
    }
  };

  const accepted = friends.filter((f) => f.status === 'accepted');
  const incoming = friends.filter((f) => f.status === 'pending' && f.requestedBy !== me?.uid);
  const outgoing = friends.filter((f) => f.status === 'pending' && f.requestedBy === me?.uid);
  const known = new Set(friends.map((f) => f.id));

  return (
    <div className="view">
      <header className="view__head">
        <h1 className="view__title">Друзья</h1>
        <p className="view__sub">Найдите человека по нику или почте — и зовите в комнату.</p>
      </header>

      <div className="catalog__search">
        <Search size={16} color="var(--text-low)" />
        <input
          className="input"
          style={{ background: 'none', border: 'none', minHeight: 44 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ник или почта"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Поиск людей"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Очистить">
            <X size={16} color="var(--text-low)" />
          </button>
        )}
      </div>

      {query.trim().length >= 2 && (
        <section className="section">
          <h2 className="section__title">Результаты</h2>
          {searching && <div className="spinner" style={{ margin: '0 auto' }} />}
          {!searching && found.length === 0 && (
            <p className="faint" style={{ fontSize: 'var(--t-small)' }}>
              Никого не нашли. Ник ищется с первых букв, почта — целиком.
            </p>
          )}
          <div className="stack gap-2">
            {found.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                onOpen={() => onOpenProfile(person.username)}
                action={known.has(person.id) ? null : (
                  <button
                    type="button"
                    className="btn btn--sm btn--primary"
                    onClick={() => act(requestFriend, person, `Заявка отправлена ${person.displayName}`)}
                  >
                    <UserPlus size={16} /> Добавить
                  </button>
                )}
              />
            ))}
          </div>
        </section>
      )}

      {loading && <LoadingState text="Загружаем друзей…" />}

      {!loading && incoming.length > 0 && (
        <section className="section">
          <h2 className="section__title">Входящие заявки</h2>
          <div className="stack gap-2">
            {incoming.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                onOpen={() => onOpenProfile(person.username)}
                action={(
                  <div className="row gap-2">
                    <button type="button" className="btn btn--sm btn--primary"
                      onClick={() => act(acceptFriend, person, `${person.displayName} теперь в друзьях`)}>
                      <Check size={16} /> Принять
                    </button>
                    <button type="button" className="btn btn--sm btn--ghost"
                      onClick={() => act(removeFriend, person, 'Заявка отклонена')}>
                      <X size={16} />
                    </button>
                  </div>
                )}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Мои друзья</h2>
            {accepted.length > 0 && <span className="faint" style={{ fontSize: 'var(--t-small)' }}>{accepted.length}</span>}
          </div>

          {accepted.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Пока никого"
              text="Найдите человека по нику или почте — вместе выбирать кино интереснее."
            />
          ) : (
            <div className="stack gap-2">
              {accepted.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  onOpen={() => onOpenProfile(person.username)}
                  action={(
                    <button type="button" className="btn btn--sm btn--quiet"
                      onClick={() => act(removeFriend, person, 'Убрали из друзей')}
                      aria-label="Убрать из друзей">
                      <UserMinus size={16} />
                    </button>
                  )}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && outgoing.length > 0 && (
        <section className="section">
          <h2 className="section__title">Отправленные заявки</h2>
          <div className="stack gap-2">
            {outgoing.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                onOpen={() => onOpenProfile(person.username)}
                action={(
                  <button type="button" className="btn btn--sm btn--quiet"
                    onClick={() => act(removeFriend, person, 'Заявка отозвана')}>
                    Отозвать
                  </button>
                )}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PersonRow({ person, action, onOpen }) {
  return (
    <div className="member">
      <button type="button" className="row gap-3 grow" style={{ minWidth: 0, textAlign: 'left' }} onClick={onOpen}>
        {person.photoURL
          ? <img className="member__avatar" src={person.photoURL} alt="" />
          : <span className="member__avatar member__avatar--empty">{initials(person.displayName)}</span>}
        <span className="stack grow" style={{ minWidth: 0 }}>
          <span className="member__name truncate">{person.displayName}</span>
          <span className="member__state truncate">@{person.username}</span>
        </span>
      </button>
      {action}
    </div>
  );
}

const initials = (name) => String(name ?? '?').trim().split(/\s+/).slice(0, 2)
  .map((p) => p[0] ?? '').join('').toUpperCase() || '?';
