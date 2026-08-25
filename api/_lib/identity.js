/**
 * Внутренний user_id MatchWatch.
 *
 * Ключевое решение осталось прежним, сменилось только хранилище:
 * user_id — это `auth.users.id`, а способ входа к нему не привязан.
 * Telegram-id и email лежат в таблице `identities` и указывают на один
 * и тот же профиль:
 *
 *   identities(provider, external_key) -> user_id
 *
 * Связать два способа входа = вставить строку в identities, а не
 * мигрировать данные пользователя.
 */

import { createHash } from 'node:crypto';
import { authAdmin, sbInsert, sbSelect, sbUpdate } from './supabaseAdmin.js';

export const PROVIDER = Object.freeze({ TELEGRAM: 'telegram', EMAIL: 'email' });

export const emailKey = (email) =>
  createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);

/**
 * Телефонных номеров и настоящей почты у Telegram-пользователя нет,
 * поэтому заводим служебный адрес в зарезервированном домене. Он никогда
 * никуда не отправляется — нужен только как ключ учётной записи Supabase.
 */
export const telegramEmail = (telegramId) => `tg-${telegramId}@telegram.matchwatch.invalid`;

/**
 * Находит существующий user_id по внешней идентичности либо создаёт новый.
 * @returns {Promise<{userId: string, created: boolean, email: string}>}
 */
export async function resolveUser(provider, externalKey, { email, profile = {}, linkToUserId = null } = {}) {
  const existing = await sbSelect('identities', {
    select: 'user_id',
    provider: `eq.${provider}`,
    external_key: `eq.${externalKey}`,
    limit: 1,
  });

  if (existing?.[0]?.user_id) {
    const userId = existing[0].user_id;
    await touchProfile(userId, profile);
    return { userId, created: false, email };
  }

  // Пользователь мог войти другим способом — тогда прикрепляем новую
  // идентичность к уже существующему профилю, не создавая второй.
  if (linkToUserId) {
    await sbInsert('identities', {
      provider, external_key: externalKey, user_id: linkToUserId,
    }, { upsert: true, onConflict: 'provider,external_key' });
    await touchProfile(linkToUserId, profile);
    return { userId: linkToUserId, created: false, email };
  }

  const authUser = (await authAdmin.findByEmail(email))
    ?? (await authAdmin.createUser({
      email,
      metadata: {
        display_name: profile.displayName ?? null,
        photo_url: profile.photoURL ?? null,
        provider,
      },
    }));

  const userId = authUser.id;

  await sbInsert('identities', {
    provider, external_key: externalKey, user_id: userId,
  }, { upsert: true, onConflict: 'provider,external_key' });

  // Профиль создаётся триггером on_auth_user_created, но у уже
  // существующего пользователя его надо обновить.
  await touchProfile(userId, { ...profile, primaryProvider: provider });

  return { userId, created: true, email };
}

/**
 * Ник Telegram годится как ник MatchWatch не всегда: у нас 3–24 символа
 * из латиницы, цифр, точки и подчёркивания, у Telegram — до 32.
 * Возвращает null, если привести нечего.
 */
export function usernameFromTelegram(raw) {
  const value = String(raw ?? '').trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '');
  return value.length >= 3 ? value.slice(0, 24).toLowerCase() : null;
}

async function touchProfile(userId, profile) {
  const patch = { last_seen_at: new Date().toISOString() };
  if (profile.displayName) patch.display_name = profile.displayName;
  if (profile.photoURL) patch.photo_url = profile.photoURL;
  if (profile.locale) patch.locale = profile.locale;
  if (profile.primaryProvider) patch.primary_provider = profile.primaryProvider;

  await sbUpdate('profiles', { id: `eq.${userId}` }, patch).catch(() => {
    // Профиль появляется триггером; гонка на первом входе не фатальна.
  });

  await claimUsername(userId, profile.username);
}

/**
 * Ник подставляется из Telegram, но только пока человек не выбрал свой:
 * перезаписывать осознанный выбор чужим значением нельзя. Занятый ник —
 * штатная ситуация (тёзка успел раньше), а не ошибка входа, поэтому
 * конфликт уникального индекса гасится молча.
 */
async function claimUsername(userId, candidate) {
  if (!candidate) return;
  const rows = await sbSelect('profiles', { select: 'username', id: `eq.${userId}`, limit: 1 })
    .catch(() => null);
  if (rows?.[0]?.username) return;

  await sbUpdate('profiles', { id: `eq.${userId}`, username: 'is.null' }, { username: candidate })
    .catch(() => {});
}

export async function loadProfile(userId) {
  const rows = await sbSelect('profiles', {
    select: 'id,display_name,photo_url,locale,access_tier,access_stars,primary_provider,created_at',
    id: `eq.${userId}`,
    limit: 1,
  });
  const row = rows?.[0];
  if (!row) return null;
  return {
    uid: row.id,
    displayName: row.display_name,
    photoURL: row.photo_url,
    locale: row.locale,
    provider: row.primary_provider,
    access: { tier: row.access_tier, stars: row.access_stars },
    createdAt: row.created_at,
  };
}
