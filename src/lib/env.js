/** Единая точка доступа к переменным окружения на клиенте. */
const env = import.meta.env ?? {};

export const ENV = {
  supabase: {
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
  },
  telegramBot: env.VITE_TELEGRAM_BOT_USERNAME ?? null,
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
