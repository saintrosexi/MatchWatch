import { useState } from 'react';
import { RotateCcw } from '../../ui/icons.js';
import { Sheet } from '../../ui/Sheet.jsx';
import { GENRE_LIST } from '../../../shared/taxonomy/genres.js';

const CURRENT_YEAR = new Date().getFullYear();

export const DEFAULT_FILTERS = Object.freeze({
  genres: [],
  yearFrom: 1970,
  yearTo: CURRENT_YEAR,
  minRating: 0,
  sort: 'popularity',
});

const SORTS = [
  { key: 'popularity', label: 'Популярное' },
  { key: 'rating', label: 'По рейтингу' },
  { key: 'newest', label: 'Новинки' },
];

/**
 * Фильтры ДО начала сессии.
 *
 * Смысл: вкусовой вектор работает постфактум, а пользователю иногда нужно
 * сузить колоду заранее — «сегодня только фантастика после 2010».
 */
export function FiltersSheet({ open, onClose, value, onApply }) {
  const [draft, setDraft] = useState(value ?? DEFAULT_FILTERS);

  const patch = (fields) => setDraft((d) => ({ ...d, ...fields }));
  const toggleGenre = (id) => patch({
    genres: draft.genres.includes(id)
      ? draft.genres.filter((g) => g !== id)
      : [...draft.genres, id].slice(0, 5),
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Настроить колоду"
      footer={(
        <div className="row gap-3">
          <button type="button" className="btn btn--ghost" onClick={() => setDraft(DEFAULT_FILTERS)}>
            <RotateCcw size={16} /> Сбросить
          </button>
          <button
            type="button"
            className="btn btn--primary grow"
            onClick={() => { onApply(draft); onClose(); }}
          >
            Показать фильмы
          </button>
        </div>
      )}
    >
      <div className="filters">
        <div className="filters__group">
          <span className="eyebrow">Жанры {draft.genres.length ? `(${draft.genres.length}/5)` : ''}</span>
          <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
            {GENRE_LIST.map((genre) => (
              <button
                key={genre.id}
                type="button"
                className={`chip chip--interactive ${draft.genres.includes(genre.id) ? 'chip--on' : ''}`}
                aria-pressed={draft.genres.includes(genre.id)}
                onClick={() => toggleGenre(genre.id)}
              >
                {genre.ru}
              </button>
            ))}
          </div>
        </div>

        <div className="filters__group">
          <span className="eyebrow">Годы выпуска</span>
          <div className="range-row">
            <span className="range-row__value">{draft.yearFrom}</span>
            <input
              className="range"
              type="range"
              min={1920}
              max={CURRENT_YEAR}
              value={draft.yearFrom}
              aria-label="Год от"
              onChange={(e) => patch({ yearFrom: Math.min(Number(e.target.value), draft.yearTo) })}
            />
          </div>
          <div className="range-row">
            <span className="range-row__value">{draft.yearTo}</span>
            <input
              className="range"
              type="range"
              min={1920}
              max={CURRENT_YEAR}
              value={draft.yearTo}
              aria-label="Год до"
              onChange={(e) => patch({ yearTo: Math.max(Number(e.target.value), draft.yearFrom) })}
            />
          </div>
        </div>

        <div className="filters__group">
          <span className="eyebrow">Минимальный рейтинг</span>
          <div className="range-row">
            <span className="range-row__value">
              {draft.minRating ? draft.minRating.toFixed(1) : 'любой'}
            </span>
            <input
              className="range"
              type="range"
              min={0}
              max={9}
              step={0.5}
              value={draft.minRating}
              aria-label="Минимальный рейтинг"
              onChange={(e) => patch({ minRating: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="filters__group">
          <span className="eyebrow">Сортировка каталога</span>
          <div className="row gap-2">
            {SORTS.map((sort) => (
              <button
                key={sort.key}
                type="button"
                className={`chip chip--interactive ${draft.sort === sort.key ? 'chip--on' : ''}`}
                aria-pressed={draft.sort === sort.key}
                onClick={() => patch({ sort: sort.key })}
              >
                {sort.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
