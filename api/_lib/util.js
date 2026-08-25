/** Параллельная обработка с ограничением конкурентности — бережём rate-limit TMDB. */
export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { __error: error?.message ?? String(error) };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

export const toInt = (value, fallback = null) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const toFloat = (value, fallback = null) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

export const clampInt = (value, min, max, fallback) => {
  const n = toInt(value, fallback);
  if (n === null) return fallback;
  return Math.min(max, Math.max(min, n));
};
