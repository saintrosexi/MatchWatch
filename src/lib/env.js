/** Единая точка доступа к переменным окружения на клиенте. */
const env = import.meta.env ?? {};

/**
 * Юзернейм бота хранится без «собачки».
 *
 * В настройках его почти всегда пишут как в Telegram — `@bot`, — а дальше
 * из него собирается `https://t.me/<bot>/<app>`, где лишний символ даёт
 * нерабочую ссылку-приглашение. Нормализуем на входе, чтобы значение
 * можно было задавать в любом виде.
 */
const botUsername = (raw) => {
  const value = String(raw ?? '').trim().replace(/^@+/, '');
  return value || null;
};

export const ENV = {
  supabase: {
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
  },
  telegramBot: botUsername(env.VITE_TELEGRAM_BOT_USERNAME),
  telegramApp: env.VITE_TELEGRAM_APP_NAME ?? 'app',
  sentryDsn: env.VITE_SENTRY_DSN ?? null,
  release: env.VITE_RELEASE ?? 'dev',
  apiBase: env.VITE_API_BASE ?? '/api',
  get isTelegramShell() {
    return Boolean(globalThis.Telegram?.WebApp?.initData);
  },
};

export const isSupabaseConfigured = () =>
  Boolean(ENV.supabase.url && ENV.supabase.anonKey);

export const isDev = Boolean(env.DEV);
