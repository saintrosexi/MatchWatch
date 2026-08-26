/**
 * Проверка сессии для эндпоинтов, которые стоят денег.
 *
 * Разбор запроса и объяснение выбора обращаются к платной модели.
 * Открытыми они быть не могут: скрипт выбирает суточную квоту за минуты,
 * и приложение остаётся без разбора запросов до следующего дня. Мы
 * в эту квоту упирались уже дважды — и без всякого злого умысла.
 *
 * Проверка именно сессии, а не общего секрета: секрет пришлось бы
 * положить в клиентскую сборку, откуда его достаёт любой желающий
 * за пять секунд. Токен сессии у каждого свой и живёт недолго.
 */

import { unauthorized } from './http.js';
import { authAdmin } from './supabaseAdmin.js';

const bearer = (req) => {
  const header = req.headers?.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
};

/**
 * @returns {Promise<{id: string, email: string|null}>} вошедший пользователь
 */
export async function requireUser(req) {
  const token = bearer(req);
  if (!token) throw unauthorized('session_required', 'Нужен вход в аккаунт');

  try {
    const user = await authAdmin.getUserByToken(token);
    if (!user?.id) throw new Error('empty user');
    return { id: user.id, email: user.email ?? null };
  } catch {
    throw unauthorized('session_invalid', 'Сессия истекла — войдите заново');
  }
}
