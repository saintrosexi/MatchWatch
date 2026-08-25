/**
 * Серверный доступ к Supabase под service_role.
 *
 * Намеренно на голом fetch, без SDK: серверлес-функции холодно стартуют,
 * а нам нужны ровно две вещи — PostgREST и Auth Admin API. Обе описаны
 * простыми HTTP-запросами.
 *
 * service_role обходит RLS, поэтому этот модуль не должен быть импортирован
 * ничем, что выполняется в браузере.
 */

const url = () => {
  const value = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!value) throw new Error('SUPABASE_URL не задан');
  return value.replace(/\/$/, '');
};

const serviceKey = () => {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    const error = new Error('SUPABASE_SERVICE_ROLE_KEY не задан — серверные операции недоступны');
    error.code = 'service_key_missing';
    throw error;
  }
  return value;
};

export const hasServiceKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function request(path, { method = 'GET', body, headers = {}, prefer } = {}) {
  const key = serviceKey();
  const res = await fetch(`${url()}${path}`, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(prefer ? { prefer } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const payload = text ? safeParse(text) : null;

  if (!res.ok) {
    const error = new Error(payload?.message ?? payload?.error_description ?? `Supabase ${method} ${path} -> ${res.status}`);
    error.status = res.status;
    error.code = payload?.code ?? String(res.status);
    error.details = payload?.details ?? text.slice(0, 300);
    throw error;
  }

  return payload;
}

const safeParse = (text) => {
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

/* ── PostgREST ──────────────────────────────────────────────────────── */

const qs = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};

export const sbSelect = (table, params) => request(`/rest/v1/${table}${qs(params)}`);

export const sbInsert = (table, rows, { upsert = false, onConflict } = {}) =>
  request(`/rest/v1/${table}${onConflict ? qs({ on_conflict: onConflict }) : ''}`, {
    method: 'POST',
    body: Array.isArray(rows) ? rows : [rows],
    prefer: [
      'return=representation',
      upsert ? 'resolution=merge-duplicates' : null,
    ].filter(Boolean).join(','),
  });

export const sbUpdate = (table, params, patch) =>
  request(`/rest/v1/${table}${qs(params)}`, {
    method: 'PATCH', body: patch, prefer: 'return=representation',
  });

export const sbDelete = (table, params) =>
  request(`/rest/v1/${table}${qs(params)}`, { method: 'DELETE', prefer: 'return=minimal' });

/** Вызов SQL-функции. Вся доменная логика комнат живёт именно там. */
export const sbRpc = (fn, args = {}) =>
  request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args });

/* ── Auth Admin ─────────────────────────────────────────────────────── */

export const authAdmin = {
  /** Ищет пользователя по email. Возвращает null, если такого нет. */
  async findByEmail(email) {
    const payload = await request(`/auth/v1/admin/users${qs({ filter: email, page: 1, per_page: 1 })}`);
    const users = payload?.users ?? [];
    return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  },

  /**
   * Создаёт пользователя сразу подтверждённым.
   *
   * `email_confirm: true` означает «адрес считается подтверждённым», и
   * Supabase не отправляет письмо вообще. Это снимает зависимость от
   * встроенного SMTP, у которого на бесплатном тарифе лимит в пару писем
   * в час, и позволяет входить сразу после регистрации.
   */
  createUser({ email, password, metadata = {}, emailConfirm = true }) {
    return request('/auth/v1/admin/users', {
      method: 'POST',
      body: {
        email,
        ...(password ? { password } : {}),
        email_confirm: emailConfirm,
        user_metadata: metadata,
      },
    });
  },

  updateUser(userId, patch) {
    return request(`/auth/v1/admin/users/${userId}`, { method: 'PUT', body: patch });
  },

  /**
   * Одноразовый токен для входа без пароля.
   *
   * Клиент обменяет `hashed_token` на полноценную сессию через verifyOtp.
   * Это единственный способ выдать сессию Telegram-пользователю, не заводя
   * ему пароль и не отправляя ничего по почте.
   */
  async generateSessionToken(email) {
    const payload = await request('/auth/v1/admin/generate_link', {
      method: 'POST',
      body: { type: 'magiclink', email },
    });
    const hashed = payload?.properties?.hashed_token ?? payload?.hashed_token;
    if (!hashed) throw new Error('Supabase не вернул hashed_token для входа');
    return hashed;
  },

  /** Проверяет пользовательский access-токен и возвращает его владельца. */
  async getUserByToken(accessToken) {
    const key = serviceKey();
    const res = await fetch(`${url()}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const error = new Error('Сессия недействительна');
      error.status = res.status;
      throw error;
    }
    return res.json();
  },
};

export const projectUrl = url;
