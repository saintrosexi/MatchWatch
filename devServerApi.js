/**
 * Плагин Vite: обслуживает папку `api/` в локальной разработке.
 *
 * На проде это делает Vercel. Без такого плагина `npm run dev` даёт
 * фронтенд без бэкенда, и ленту невозможно проверить локально.
 * Модули перезагружаются на каждый запрос — правки в api/ применяются
 * без перезапуска сервера.
 */

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function devServerApi({ root = process.cwd(), prefix = '/api' } = {}) {
  return {
    name: 'matchwatch:dev-api',
    apply: 'serve',

    /**
     * Vite отдаёт в бандл только VITE_*-переменные. Серверным функциям
     * нужны серверные секреты (ключ TMDB, токен бота), поэтому .env
     * подгружается в process.env вручную.
     */
    config() {
      for (const name of ['.env', '.env.local']) {
        const file = resolve(root, name);
        if (!existsSync(file)) continue;
        for (const line of readFileSync(file, 'utf8').split('\n')) {
          const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
          if (!match) continue;
          const [, key, rawValue] = match;
          if (process.env[key] !== undefined) continue;
          process.env[key] = rawValue.replace(/^["']|["']$/g, '');
        }
      }
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(`${prefix}/`)) return next();

        const [pathname] = req.url.split('?');
        const relative = pathname.slice(prefix.length + 1).replace(/\/+$/, '');
        if (!relative || relative.includes('..')) return next();

        const candidates = [
          resolve(root, 'api', `${relative}.js`),
          resolve(root, 'api', relative, 'index.js'),
        ];
        let file = candidates.find(existsSync);

        /*
         * Повторяем переписывание из vercel.json.
         *
         * На проде /api/ai/interpret доезжает до api/ai/index.js с
         * параметром action — эндпоинты сведены в роутеры, потому что
         * тариф ограничивает число функций. Локальный сервер про
         * переписывания не знает, и без этой ветки всё сведённое —
         * ии, бот, служебные — отвечало бы 404 только в разработке.
         * Расхождение прода и локали хуже любой из двух поломок:
         * его замечаешь последним.
         */
        if (!file) {
          const cut = relative.lastIndexOf('/');
          if (cut > 0) {
            const router = resolve(root, 'api', relative.slice(0, cut), 'index.js');
            if (existsSync(router)) {
              file = router;
              const action = relative.slice(cut + 1);
              const [, search = ''] = req.url.split('?');
              const params = new URLSearchParams(search);
              params.set('action', action);
              req.url = `${pathname}?${params.toString()}`;
            }
          }
        }

        if (!file) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: { code: 'not_found', message: `Нет обработчика ${pathname}` } }));
          return;
        }

        try {
          // Кэш-бастер: свежий модуль на каждый запрос.
          const module = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
          const handler = module.default;
          if (typeof handler !== 'function') throw new Error(`${relative}: нет default-экспорта`);
          await handler(req, res);
        } catch (error) {
          server.config.logger.error(`[dev-api] ${relative}: ${error.stack ?? error.message}`);
          if (res.writableEnded) return;
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            ok: false,
            error: { code: 'dev_handler_failed', message: error.message, retryable: false },
          }));
        }
      });
    },
  };
}
