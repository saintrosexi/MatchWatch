import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api.js';
import { ErrorState, LoadingState } from '../../ui/States.jsx';
import { loadLocal, saveLocal, STORAGE_KEYS } from '../../lib/storage.js';

/**
 * Минимальный дашборд продуктовых метрик.
 *
 * Смысл — иметь цифры с первого дня, а не только сырые логи: создание
 * комнат, доля свайпов с мэтчем, retention D1/D7, приглашения на
 * пользователя и топ ошибок, чтобы чинить по частоте, а не по ощущениям.
 */
export function DashboardView({ onBack }) {
  const [token, setToken] = useState(() => loadLocal(STORAGE_KEYS.OPS_TOKEN, ''));
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.metrics(days, token || undefined);
      setData(payload);
      if (token) saveLocal(STORAGE_KEYS.OPS_TOKEN, token);
    } catch (e) {
      setError({ text: e?.message ?? 'Не удалось загрузить метрики', retryable: true });
    } finally {
      setLoading(false);
    }
  }, [days, token]);

  useEffect(() => { load(); }, [load]);

  const peak = Math.max(1, ...(data?.timeline ?? []).map((d) => Math.max(d.swipes, d.dau)));

  return (
    <div className="view">
      <button type="button" className="btn btn--quiet btn--sm" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <ArrowLeft size={16} /> Назад
      </button>

      <header className="view__head">
        <h1 className="view__title">Метрики</h1>
        <p className="view__sub">Окружение: {data?.env ?? '—'} · период {days} дн.</p>
      </header>

      <div className="row gap-2">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            className={`chip chip--interactive ${days === d ? 'chip--on' : ''}`}
            onClick={() => setDays(d)}
          >
            {d} дн
          </button>
        ))}
        <input
          className="input"
          style={{ minHeight: 34, flex: 1 }}
          type="password"
          placeholder="Токен дашборда"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          aria-label="Токен доступа к дашборду"
        />
        <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
          <RefreshCw size={14} />
        </button>
      </div>

      {loading && !data && <LoadingState text="Считаем метрики…" />}
      {error && !data && <ErrorState error={error} onRetry={load} module="ops.metrics" />}

      {data && (
        <>
          <div className="dash-grid">
            <Metric label="Свайпов" value={data.totals.swipes} />
            <Metric label="Мэтчей" value={data.totals.matches} />
            <Metric label="Доля мэтчей" value={`${data.totals.matchRate}%`} tone="gold" />
            <Metric label="Комнат создано" value={data.totals.roomsCreated} />
            <Metric label="Приглашений / юзер" value={data.totals.invitesPerUser} />
            <Metric label="Retention D1" value={fmtPercent(data.retention.averageD1)} tone="gold" />
            <Metric label="Retention D7" value={fmtPercent(data.retention.averageD7)} tone="gold" />
            <Metric label="Ошибок" value={data.totals.errors} tone={data.totals.errors ? 'alarm' : undefined} />
          </div>

          <section className="section">
            <h2 className="section__title">Активность по дням</h2>
            <div className="surface dash-chart">
              {data.timeline.map((day) => (
                <div
                  key={day.day}
                  className="dash-chart__bar"
                  style={{ height: `${Math.max(2, (day.swipes / peak) * 100)}%` }}
                  title={`${day.day}: ${day.swipes} свайпов, ${day.matches} мэтчей, DAU ${day.dau}`}
                />
              ))}
            </div>
          </section>

          <section className="section">
            <h2 className="section__title">Топ-5 ошибок</h2>
            <table className="dash-table">
              <thead><tr><th>Модуль</th><th>Событий</th></tr></thead>
              <tbody>
                {data.topErrors.length === 0
                  ? <tr><td colSpan={2} className="faint">Ошибок за период нет</td></tr>
                  : data.topErrors.map((row) => (
                    <tr key={row.name}><td>{row.name}</td><td>{row.count}</td></tr>
                  ))}
              </tbody>
            </table>
          </section>

          <section className="section">
            <h2 className="section__title">Топ-5 сбоев логики</h2>
            <p className="faint" style={{ fontSize: 'var(--t-micro)' }}>
              Не исключения кода: «комната не найдена», «TMDB пустой ответ», «rules отклонили запись».
            </p>
            <table className="dash-table">
              <thead><tr><th>Событие</th><th>Раз</th></tr></thead>
              <tbody>
                {data.topBusinessFailures.length === 0
                  ? <tr><td colSpan={2} className="faint">Сбоев за период нет</td></tr>
                  : data.topBusinessFailures.map((row) => (
                    <tr key={row.name}><td>{row.name}</td><td>{row.count}</td></tr>
                  ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone }) {
  const color = tone === 'gold' ? 'var(--gold)' : tone === 'alarm' ? 'var(--coral)' : 'var(--text-hi)';
  return (
    <div className="stat">
      <span className="stat__value" style={{ color }}>{value ?? '—'}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

const fmtPercent = (value) => (value === null || value === undefined ? '—' : `${value}%`);
