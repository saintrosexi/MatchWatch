/**
 * GET /api/ops/metrics?days=14
 *
 * Данные для дашборда: создание комнат, доля свайпов с мэтчем,
 * retention D1/D7, приглашения на пользователя, топ-5 ошибок.
 *
 * Считает Postgres — представление ops_daily и функции ops_retention /
 * ops_top_failures. Ручных счётчиков больше нет: агрегаты выводятся из
 * сырых событий, поэтому их можно пересчитать задним числом.
 *
 * Доступ закрыт токеном OPS_DASHBOARD_TOKEN — эндпоинт внутренний.
 */

import { withHandler, ApiError } from '../_lib/http.js';
import { sbSelect, sbRpc, hasServiceKey } from '../_lib/supabaseAdmin.js';
import { telemetryEnv } from '../_lib/telemetry.js';
import { MODULE } from '../../shared/telemetry/events.js';
import { clampInt } from '../_lib/util.js';

const dayKeyOffset = (offset) => new Date(Date.now() - offset * 86400_000).toISOString().slice(0, 10);

export default withHandler({ methods: ['GET'], module: MODULE.OPS }, async ({ query, req }) => {
  const expected = process.env.OPS_DASHBOARD_TOKEN;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? query.get('token');
  if (expected && provided !== expected) {
    throw new ApiError(401, 'unauthorized', 'Нужен токен доступа к дашборду');
  }
  if (!hasServiceKey()) {
    throw new ApiError(503, 'ops_not_configured',
      'Метрики недоступны: не задан SUPABASE_SERVICE_ROLE_KEY');
  }

  const days = clampInt(query.get('days'), 1, 60, 14);
  const env = query.get('env') ?? telemetryEnv;
  const since = dayKeyOffset(days - 1);

  const [daily, retention, topErrors, topBusiness] = await Promise.all([
    sbSelect('ops_daily', {
      select: '*', environment: `eq.${env}`, day: `gte.${since}`, order: 'day.asc',
    }),
    sbRpc('ops_retention', { p_environment: env, p_days: days }),
    sbRpc('ops_top_failures', { p_environment: env, p_kind: 'error', p_days: days, p_limit: 5 }),
    sbRpc('ops_top_failures', { p_environment: env, p_kind: 'business', p_days: days, p_limit: 5 }),
  ]);

  const byDay = new Map((daily ?? []).map((row) => [row.day, row]));

  const timeline = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = dayKeyOffset(i);
    const row = byDay.get(day) ?? {};
    const swipes = Number(row.swipes ?? 0);
    const matches = Number(row.matches ?? 0);
    timeline.push({
      day,
      dau: Number(row.dau ?? 0),
      roomsCreated: Number(row.rooms_created ?? 0),
      roomsJoined: Number(row.rooms_joined ?? 0),
      invitesSent: Number(row.invites_sent ?? 0),
      swipes,
      matches,
      /** Доля свайпов, закончившихся мэтчем — ключевая метрика продукта. */
      matchRate: swipes ? Math.round((matches / swipes) * 10000) / 100 : 0,
      watchlistAdds: Number(row.watchlist_adds ?? 0),
      rouletteSpins: Number(row.roulette_spins ?? 0),
    });
  }

  const cohorts = (retention ?? []).map((row) => ({
    cohort: row.cohort_day,
    size: Number(row.cohort_size ?? 0),
    d1: row.d1 === null ? null : Number(row.d1),
    d7: row.d7 === null ? null : Number(row.d7),
  }));

  const totals = timeline.reduce((acc, row) => {
    for (const key of ['dau', 'roomsCreated', 'roomsJoined', 'invitesSent', 'swipes', 'matches']) {
      acc[key] = (acc[key] ?? 0) + row[key];
    }
    return acc;
  }, {});

  totals.signups = cohorts.reduce((a, c) => a + c.size, 0);
  totals.matchRate = totals.swipes ? Math.round((totals.matches / totals.swipes) * 10000) / 100 : 0;
  totals.invitesPerUser = totals.signups
    ? Math.round((totals.invitesSent / totals.signups) * 100) / 100 : 0;
  totals.errors = (topErrors ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0);
  totals.businessFailures = (topBusiness ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0);

  return {
    env,
    days,
    timeline,
    totals,
    retention: {
      cohorts,
      averageD1: average(cohorts.map((c) => c.d1).filter((v) => v !== null)),
      averageD7: average(cohorts.map((c) => c.d7).filter((v) => v !== null)),
    },
    topErrors: (topErrors ?? []).map((r) => ({ name: `${r.module} · ${r.name}`, count: Number(r.total) })),
    topBusinessFailures: (topBusiness ?? []).map((r) => ({ name: r.name, count: Number(r.total) })),
    generatedAt: Date.now(),
  };
});

const average = (values) =>
  (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null);
