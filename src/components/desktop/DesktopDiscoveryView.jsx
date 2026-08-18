import React, { useState, useMemo } from 'react';
import { Search, Play, Star, Sliders, Sparkles, Film, Sparkles as SparklesIcon } from 'lucide-react';
import { movies } from '../../data/movies.js';
import { curatedCollections } from '../../data/collections.js';
import { getPosterUrl, handlePosterError } from '../../engine/imagePrefetcher.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function DesktopDiscoveryView({
  onOpenDetails,
  onLaunchCollectionDeck
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Все');
  const [minRating, setMinRating] = useState(7.0);
  const [sortBy, setSortBy] = useState('rating'); // 'rating' | 'year' | 'title'

  const movieGenres = ['Все', 'Боевик', 'Комедия', 'Драма', 'Триллер', 'Фантастика', 'Приключения', 'Криминал', 'Детектив', 'Фэнтези', 'Мелодрама'];

  // All curated movie collections
  const activeCollections = curatedCollections;

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = movies.filter((m) => {
      // Genre filter
      if (selectedGenre !== 'Все') {
        const mGenres = (m.genres || '').toLowerCase();
        if (!mGenres.includes(selectedGenre.toLowerCase())) return false;
      }

      // Rating filter
      if (m.rating < minRating) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (m.titleRu || m.title || '').toLowerCase().includes(q);
        const directorMatch = (m.director || '').toLowerCase().includes(q);
        const actorsMatch = (m.actors || '').toLowerCase().includes(q);
        return titleMatch || directorMatch || actorsMatch;
      }

      return true;
    });

    // Sorting
    if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'year') {
      result.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (sortBy === 'title') {
      result.sort((a, b) => (a.titleRu || a.title || '').localeCompare(b.titleRu || b.title || ''));
    }

    return result;
  }, [selectedGenre, minRating, searchQuery, sortBy]);

  return (
    <div className="desktop-two-panel-grid">
      {/* Left Panel: Fixed Sticky Filters & Collections */}
      <div className="desktop-filter-pane">
        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%', marginBottom: '18px' }}>
          <input
            type="text"
            placeholder="Поиск по названию или режиссёру..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px 11px 38px',
              background: 'rgba(10, 10, 16, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>

        {/* Curated Collections Shelf */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-sunset)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Кураторские подборки кино
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeCollections.map((col) => (
              <div
                key={col.id}
                onClick={() => {
                  triggerHaptic('medium');
                  playSound('tap');
                  if (onLaunchCollectionDeck) onLaunchCollectionDeck(col);
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
                className="hover-card-elevate"
              >
                <div style={{
                  width: '36px',
                  height: '48px',
                  borderRadius: 'var(--radius-xs)',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  <img src={col.cover} alt={col.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {col.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {col.subtitle}
                  </div>
                </div>
                <Play size={14} color="var(--accent-coral)" style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Rating Slider Filter */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Минимальный рейтинг
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ffd60a', fontFamily: 'Space Grotesk' }}>
              ★ {minRating.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="6.0"
            max="9.0"
            step="0.1"
            value={minRating}
            onChange={(e) => setMinRating(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-coral)' }}
          />
        </div>

        {/* Sorting Switcher */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Сортировка
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'rating', label: 'По рейтингу' },
              { id: 'year', label: 'По новизне' },
              { id: 'title', label: 'По алфавиту' }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  triggerHaptic('light');
                  playSound('tap');
                  setSortBy(s.id);
                }}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  fontWeight: sortBy === s.id ? '700' : '500',
                  background: sortBy === s.id ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: sortBy === s.id ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
                  color: sortBy === s.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Content Grid */}
      <div className="desktop-content-pane">
        {/* Genre Filter Horizontal Scroll */}
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '16px',
          scrollbarWidth: 'none'
        }}>
          {movieGenres.map((genre) => {
            const isSelected = selectedGenre === genre;
            return (
              <button
                key={genre}
                onClick={() => {
                  triggerHaptic('light');
                  playSound('tap');
                  setSelectedGenre(genre);
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: '999px',
                  border: isSelected ? '1px solid rgba(255, 94, 98, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isSelected ? 'rgba(255, 94, 98, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? '#ff9966' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? '700' : '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                {genre}
              </button>
            );
          })}
        </div>

        {/* Results Header Count */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Найдено фильмов: <strong style={{ color: 'var(--text-primary)' }}>{filteredItems.length}</strong>
          </span>
        </div>

        {/* Media Grid */}
        <div className="desktop-media-grid">
          {filteredItems.map((item) => {
            const poster = getPosterUrl(item);
            return (
              <div
                key={item.id}
                onClick={() => {
                  triggerHaptic('light');
                  playSound('tap');
                  if (onOpenDetails) onOpenDetails(item);
                }}
                className="desktop-media-card"
              >
                <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', background: '#0a0a0f', overflow: 'hidden' }}>
                  <img
                    src={poster}
                    alt={item.titleRu || item.title}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => handlePosterError(e, item)}
                  />
                  {/* Rating Tag */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(0, 0, 0, 0.88)',
                    border: '1px solid #ffd60a',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    color: '#ffd60a',
                    fontFamily: 'Space Grotesk'
                  }}>
                    ★ {item.rating ? Number(item.rating).toFixed(1) : '7.8'}
                  </div>

                  {/* Year Tag */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '0.7rem',
                    color: '#e5e5ea'
                  }}>
                    {item.year}
                  </div>
                </div>

                <div className="desktop-media-info">
                  <h4 className="desktop-media-title">
                    {item.titleRu || item.title}
                  </h4>
                  <div className="desktop-media-meta">
                    <span>{item.genres?.split(',')[0]}</span>
                    <span>•</span>
                    <span>{item.country || 'Кино'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
