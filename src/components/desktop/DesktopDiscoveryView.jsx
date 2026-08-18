import React, { useState, useMemo } from 'react';
import { Search, Play, Star, Sliders, Sparkles, Film, Tv } from 'lucide-react';
import { movies } from '../../data/movies.js';
import { curatedCollections } from '../../data/collections.js';
import { getPosterUrl, handlePosterError } from '../../engine/imagePrefetcher.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function DesktopDiscoveryView({
  initialCategory = 'movie',
  onOpenDetails,
  onLaunchCollectionDeck
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Все');
  const [minRating, setMinRating] = useState(7.0);
  const [sortBy, setSortBy] = useState('rating'); // 'rating' | 'year' | 'title'

  const movieGenres = ['Все', 'Боевик', 'Комедия', 'Драма', 'Триллер', 'Фантастика', 'Приключения', 'Криминал'];
  const seriesGenres = ['Все', 'Драма', 'Криминал', 'Детектив', 'Триллер', 'Фантастика', 'Комедия'];
  const animeGenres = ['Все', 'Сёнэн', 'Приключения', 'Фэнтези', 'Драма', 'Экшн', 'Мистика'];

  const currentGenres = activeCategory === 'series' ? seriesGenres : activeCategory === 'anime' ? animeGenres : movieGenres;

  // Filtered collections
  const activeCollections = useMemo(() => {
    return curatedCollections.filter((c) => c.category === activeCategory);
  }, [activeCategory]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = movies.filter((m) => {
      const itemCategory = m.category || 'movie';
      if (itemCategory !== activeCategory) return false;

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
  }, [activeCategory, selectedGenre, minRating, searchQuery, sortBy]);

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

        {/* Category Switcher Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          {[
            { id: 'movie', label: '🎬 Фильмы' },
            { id: 'series', label: '📺 Сериалы' },
            { id: 'anime', label: '⛩ Аниме' }
          ].map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  triggerHaptic('light');
                  playSound('tap');
                  setActiveCategory(cat.id);
                  setSelectedGenre('Все');
                }}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '1px solid rgba(255, 94, 98, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                  background: isSelected ? 'rgba(255, 94, 98, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                  color: isSelected ? '#ff9966' : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? '700' : '500',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Curated Collections Shelf */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-sunset)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Кураторские подборки
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
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = col.accent;
                  e.currentTarget.style.background = `${col.accent}14`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }}
              >
                <div>
                  <div style={{ fontSize: '0.825rem', fontWeight: '700', color: '#fff' }}>
                    {col.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {col.badge}
                  </div>
                </div>
                <Play size={14} color={col.accent} fill="currentColor" />
              </div>
            ))}
          </div>
        </div>

        {/* Genre Selector */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Жанры
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {currentGenres.map((g) => {
              const isSelected = selectedGenre === g;
              return (
                <button
                  key={g}
                  onClick={() => {
                    triggerHaptic('light');
                    playSound('tap');
                    setSelectedGenre(g);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: isSelected ? '1px solid rgba(255, 94, 98, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: isSelected ? 'rgba(255, 94, 98, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                    color: isSelected ? '#ff9966' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? '700' : '500',
                    cursor: 'pointer'
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Minimum Rating Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>Мин. рейтинг</span>
            <span style={{ color: '#ffd60a', fontFamily: 'Space Grotesk' }}>★ {minRating.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="6.0"
            max="9.0"
            step="0.2"
            value={minRating}
            onChange={(e) => setMinRating(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-coral)' }}
          />
        </div>
      </div>

      {/* Right Panel: Movies Grid & Sorting Header */}
      <div>
        {/* Results Info & Sort Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Найдено: <strong style={{ color: '#fff' }}>{filteredItems.length}</strong> тайтлов
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: 'rgba(16, 16, 26, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="rating">По рейтингу ★</option>
              <option value="year">По году выхода</option>
              <option value="title">По названию (А-Я)</option>
            </select>
          </div>
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
                </div>

                <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      lineHeight: '1.3',
                      marginBottom: '4px',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {item.titleRu || item.title}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.year} • {item.genres?.split(',')[0]}
                    </div>
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
