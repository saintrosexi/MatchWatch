/**
 * Социальный слой: публичный профиль, поиск людей, друзья.
 *
 * Вся логика доступа живёт в SQL-функциях: клиент не должен уметь
 * читать чужие профили напрямую, иначе анон-ключом можно вычерпать
 * базу пользователей. Здесь только вызовы и приведение форм.
 */

import { supabase, supabaseReady, guarded } from '../lib/supabase.js';
import { trackMetric } from '../lib/telemetry.js';
import { MODULE } from '../../shared/telemetry/events.js';

const shapePerson = (row) => (row ? {
  id: row.id,
  username: row.username,
  displayName: row.display_name ?? row.username,
  photoURL: row.photo_url,
  bio: row.bio,
  status: row.status,
  requestedBy: row.requested_by,
} : null);

/** Свободен ли ник. Форма спрашивает до отправки, а не ловит отказ после. */
export async function isUsernameAvailable(username) {
  if (!supabaseReady() || !username) return false;
  const { data, error } = await supabase.rpc('username_available', { p_username: username });
  if (error) return false;
  return Boolean(data);
}

/** Сохраняет то, что человек показывает о себе. */
export async function saveProfile(uid, { displayName, username, bio, photoURL }) {
  if (!supabaseReady() || !uid) return null;

  const patch = {};
  if (displayName !== undefined) patch.display_name = displayName?.trim() || null;
  if (username !== undefined) patch.username = username?.trim().toLowerCase() || null;
  if (bio !== undefined) patch.bio = bio?.trim() || null;
  if (photoURL !== undefined) patch.photo_url = photoURL || null;

  const { data, error } = await supabase
    .from('profiles').update(patch).eq('id', uid).select().maybeSingle();

  if (error) {
    // Уникальный индекс — единственный надёжный арбитр: проверка «свободен ли»
    // могла устареть за те секунды, что человек заполнял форму.
    if (error.code === '23505') {
      throw Object.assign(new Error('Такой ник уже занят'), { code: 'username_taken' });
    }
    if (error.code === '23514') {
      throw Object.assign(new Error('Ник: 3–24 символа, латиница, цифры, точка и подчёркивание'), { code: 'username_invalid' });
    }
    throw error;
  }
  return data;
}

/** Публичная карточка по нику. */
export async function loadPublicProfile(username) {
  if (!supabaseReady() || !username) return null;
  const { data, error } = await supabase.rpc('public_profile', { p_username: username });
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    ...shapePerson(row),
    createdAt: row.created_at,
    stats: {
      ratings: Number(row.ratings_count ?? 0),
      averageRating: row.average_rating === null ? null : Number(row.average_rating),
      favorites: Number(row.favorites_count ?? 0),
      watched: Number(row.watched_count ?? 0),
    },
  };
}

/** Поиск людей: по началу ника или по точному адресу почты. */
export async function searchPeople(query) {
  if (!supabaseReady() || !query || query.trim().length < 2) return [];
  const { data, error } = await supabase.rpc('search_users', { p_query: query.trim() });
  if (error) throw error;
  return (data ?? []).map(shapePerson);
}

export async function loadFriends() {
  if (!supabaseReady()) return [];
  const { data, error } = await supabase.rpc('my_friends');
  if (error) throw error;
  return (data ?? []).map(shapePerson);
}

export async function requestFriend(friendId) {
  const status = await guarded(
    () => supabase.rpc('request_friend', { p_friend: friendId }),
    { module: MODULE.ROOMS_JOIN, description: 'request friend' },
  );
  trackMetric('friend_request_sent', { context: { status } });
  return status;
}

export const acceptFriend = (friendId) => guarded(
  () => supabase.rpc('accept_friend', { p_friend: friendId }),
  { module: MODULE.ROOMS_JOIN, description: 'accept friend' },
);

export const removeFriend = (friendId) => guarded(
  () => supabase.rpc('remove_friend', { p_friend: friendId }),
  { module: MODULE.ROOMS_JOIN, description: 'remove friend' },
);

/** Ник по умолчанию из имени или почты: человеку не нужно придумывать с нуля. */
export function suggestUsername(source) {
  const base = String(source ?? '')
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 20);
  if (base.length >= 3) return base;
  return `viewer${Math.floor(Math.random() * 9000 + 1000)}`;
}
