import React, { useState, useMemo } from 'react';
import { X, Check, SlidersHorizontal, RotateCcw, Sparkles } from 'lucide-react';
import { movies } from '../../data/movies.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

const ALL_GENRES = [
  'Боевик', 'Комедия', 'Драма', 'Триллер', 'Фантастика',
  'Приключения', 'Криминал', 'Детектив', 'Мелодрама',
  'Ужасы', 'Фэнтези', 'Мультфильм', 'Биография', 'Военный'
];

export function FilterMatrixModal({
  currentFilters = {},
  onApplyFilters,
  onClose
}) {
  const [genres, setGenres] = useState(currentFilters.genres || []);
  const [excludedGenres, setExcludedGenres] = useState(currentFilters.excludedGenres || []);
  const [minRating, setMinRating] = useState(currentFilters.minRating || 7.0);
  const [yearFrom, setYearFrom] = useState(currentFilters.yearFrom || 1980);
  const [yearTo, setYearTo] = useState(currentFilters.yearTo || 2026);

  // Toggle included genre
  const toggleGenre = (g) => {
    triggerHaptic('light');
    playSound('tap');
    if (genres.includes(g)) {
      setGenres(genres.filter((item) => item !== g));
    } else {
      setGenres([...genres, g]);
      // Remove from excluded if present
      setExcludedGenres(excludedGenres.filter((item) => item !== g));
    }
  };

  // Toggle excluded genre
  const toggleExcludeGenre = (g) => {
    triggerHaptic('light');
    playSound('tap');
    if (excludedGenres.includes(g)) {
      setExcludedGenres(excludedGenres.filter((item) => item !== g));
    } else {
      setExcludedGenres([...excludedGenres, g]);
      // Remove from included if present
      setGenres(genres.filter((item) => item !== g));
    }
  };

  // Calculate live matching count
  const matchingCount = useMemo(() => {
    return movies.filter((m) => {
      if (m.rating && m.rating < minRating) return false;
      if (m.year && (m.year < yearFrom || m.year > yearTo)) return false;

      const mGenres = (m.genres || '').toLowerCase();

      if (genres.length > 0) {
        const hasIncluded = genres.some((g) => mGenres.includes(g.toLowerCase()));
        if (!hasIncluded) return false;
      }

      if (excludedGenres.length > 0) {
        const hasExcluded = excludedGenres.some((g) => mGenres.includes(g.toLowerCase()));
        if (hasExcluded) return false;
      }

      return true;
    }).length;
  }, [genres, excludedGenres, minRating, yearFrom, yearTo]);

  const handleReset = () => {
    triggerHaptic('medium');
    playSound('tap');
    setGenres([]);
    setExcludedGenres([]);
    setMinRating(7.0);
    setYearFrom(1980);
    setYearTo(2026);
  };

  const handleApply = () => {
    triggerHaptic('medium');
    playSound('tap');
    onApplyFilters({
      genres,
      excludedGenres,
      minRating,
      yearFrom,
      yearTo
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-noir)',
      zIndex: 1200,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      padding: '24px 20px 48px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SlidersHorizontal size={22} color="var(--accent-gold)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>Матрица фильтров</h2>
        </div>

        <button onClick={onClose} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      {/* Included Genres Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-gold)' }}>
            ✓ Включить жанры
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Выбрано: {genres.length}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {ALL_GENRES.map((g) => {
            const isSelected = genres.includes(g);
            return (
              <button
                key={`inc-${g}`}
                onClick={() => toggleGenre(g)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? '1px solid var(--accent-gold)' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? 'var(--accent-gold-light)' : 'var(--text-secondary)',
                  fontSize: '0.825rem',
                  fontWeight: isSelected ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {/* Excluded Genres Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--accent-coral)' }}>
            ✕ Исключить нежелательные жанры
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Исключено: {excludedGenres.length}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {ALL_GENRES.map((g) => {
            const isExcluded = excludedGenres.includes(g);
            return (
              <button
                key={`exc-${g}`}
                onClick={() => toggleExcludeGenre(g)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: isExcluded ? '1px solid var(--accent-coral)' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isExcluded ? 'rgba(255, 71, 87, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: isExcluded ? '#ff6b81' : 'var(--text-muted)',
                  fontSize: '0.825rem',
                  fontWeight: isExcluded ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {isExcluded ? `✕ ${g}` : g}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rating Range Slider */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>Минимальный рейтинг:</span>
          <span className="rating-pill">★ {minRating.toFixed(1)}+</span>
        </div>
        <input
          type="range"
          min="5.0"
          max="8.8"
          step="0.1"
          value={minRating}
          onChange={(e) => setMinRating(parseFloat(e.target.value))}
          style={{
            width: '100%',
            accentColor: 'var(--accent-gold)',
            cursor: 'pointer'
          }}
        />
      </div>

      {/* Year Range */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px',
        marginBottom: '32px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>Года выпуска:</span>
          <span style={{
            fontFamily: 'Space Grotesk',
            fontWeight: '700',
            color: 'var(--text-gold)',
            fontSize: '0.9rem'
          }}>
            {yearFrom} — {yearTo}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="range"
            min="1960"
            max="2026"
            step="1"
            value={yearFrom}
            onChange={(e) => setYearFrom(parseInt(e.target.value))}
            style={{ width: '50%', accentColor: 'var(--accent-gold)' }}
          />
          <input
            type="range"
            min="1960"
            max="2026"
            step="1"
            value={yearTo}
            onChange={(e) => setYearTo(parseInt(e.target.value))}
            style={{ width: '50%', accentColor: 'var(--accent-gold)' }}
          />
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div style={{
        marginTop: 'auto',
        display: 'flex',
        gap: '12px',
        position: 'sticky',
        bottom: 0,
        background: 'rgba(7, 7, 9, 0.95)',
        backdropFilter: 'blur(16px)',
        paddingTop: '12px'
      }}>
        <button
          onClick={handleReset}
          className="btn-secondary"
          style={{ width: '48px', height: '48px', padding: 0 }}
          title="Сбросить фильтры"
        >
          <RotateCcw size={18} />
        </button>

        <button
          onClick={handleApply}
          className="btn-primary"
          style={{ flex: 1 }}
        >
          <Check size={18} />
          Применить ({matchingCount} фильмов)
        </button>
      </div>
    </div>
  );
}
