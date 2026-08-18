import React, { useState, useMemo } from 'react';
import { Search, Play, Star, Clock, Film, Tv, Sparkles } from 'lucide-react';
import { movies } from '../../data/movies.js';
import { curatedCollections } from '../../data/collections.js';
import { getPosterUrl, handlePosterError } from '../../engine/imagePrefetcher.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function DiscoveryView({
  onOpenDetails,
  onLaunchCollectionDeck
}) {
  const [activeCategory, setActiveCategory] = useState('movie'); // 'movie' | 'series' | 'anime'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Все');

  const categories = [
    { id: 'movie', label: '🎬 Фильмы' },
    { id: 'series', label: '📺 Сериалы' },
    { id: 'anime', label: '⛩ Аниме' }
  ];

  const movieGenres = ['Все', 'Боевик', 'Комедия', 'Драма', 'Триллер', 'Фантастика', 'Приключения', 'Криминал'];
  const seriesGenres = ['Все', 'Драма', 'Криминал', 'Детектив', 'Триллер', 'Фантастика', 'Комедия'];
  const animeGenres = ['Все', 'Сёнэн', 'Приключения', 'Фэнтези', 'Драма', 'Экшн', 'Мистика'];

  const currentGenres = activeCategory === 'series' ? seriesGenres : activeCategory === 'anime' ? animeGenres : movieGenres;

  // Filtered collections for the active category
  const activeCollections = useMemo(() => {
    return curatedCollections.filter((c) => c.category === activeCategory);
  }, [activeCategory]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return movies.filter((m) => {
      const mGenres = (m.genres || '').toLowerCase();
      const mCountry = (m.country || '').toLowerCase();
      const mDuration = (m.duration || '').toLowerCase();

      // Check category match
      const itemCategory = m.category || m.type || 'movie';
      if (itemCategory !== activeCategory) return false;

      // Genre filter
      if (selectedGenre !== 'Все') {
        if (!mGenres.includes(selectedGenre.toLowerCase())) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (m.titleRu || m.title || '').toLowerCase().includes(q);
        const directorMatch = (m.director || '').toLowerCase().includes(q);
        const actorsMatch = (m.actors || '').toLowerCase().includes(q);
        return titleMatch || directorMatch || actorsMatch;
      }

      return true;
    }).slice(0, 40);
  }, [activeCategory, selectedGenre, searchQuery]);

  return (
    <div style={{ padding: '0 16px 24px', width: '100%' }}>
      {/* Header Title */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '4px' }}>
          Кино-каталог
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Шедевры мирового кино, сериалов и японской анимации
        </p>
      </div>

      {/* Category Tabs: Movies / Series / Anime */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px'
      }}>
        {categories.map((cat) => {
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
                padding: '10px 8px',
                borderRadius: 'var(--radius-full)',
                border: isSelected ? '1.5px solid rgba(255, 94, 98, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isSelected ? 'rgba(255, 94, 98, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                color: isSelected ? '#ff9966' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: isSelected ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', width: '100%', marginBottom: '18px' }}>
        <input
          type="text"
          placeholder="Поиск по названию или режиссёру..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '13px 16px 13px 44px',
            background: 'var(--bg-surface-2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-primary)',
            fontSize: '0.88rem',
            outline: 'none'
          }}
        />
        <Search
          size={18}
          color="var(--text-muted)"
          style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>

      {/* Curated Collections for Active Category */}
      {!searchQuery && activeCollections.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-sunset)' }}>
              Подборки: {activeCategory === 'series' ? 'Сериалы' : activeCategory === 'anime' ? 'Аниме' : 'Фильмы'}
            </h2>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            paddingBottom: '8px',
            scrollbarWidth: 'none'
          }}>
            {activeCollections.map((col) => (
              <div
                key={col.id}
                onClick={() => {
                  triggerHaptic('medium');
                  playSound('tap');
                  if (onLaunchCollectionDeck) onLaunchCollectionDeck(col);
                }}
                className="glass-card"
                style={{
                  minWidth: '210px',
                  maxWidth: '230px',
                  padding: '14px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <span
                    className="chip"
                    style={{
                      background: `${col.accent}22`,
                      borderColor: `${col.accent}55`,
                      color: col.accent,
                      fontSize: '0.68rem',
                      marginBottom: '8px'
                    }}
                  >
                    {col.badge}
                  </span>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '800', lineHeight: '1.3', marginBottom: '4px' }}>
                    {col.title}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {col.subtitle}
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '12px',
                  color: col.accent,
                  fontSize: '0.78rem',
                  fontWeight: '700'
                }}>
                  <Play size={13} fill="currentColor" /> Запустить колоду
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Genre Chips Filter */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '12px',
        scrollbarWidth: 'none',
        marginBottom: '14px'
      }}>
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
                padding: '5px 12px',
                borderRadius: '999px',
                border: isSelected ? '1px solid rgba(255, 94, 98, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isSelected ? 'rgba(255, 94, 98, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                color: isSelected ? '#ff9966' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: isSelected ? '700' : '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {g}
            </button>
          );
        })}
      </div>

      {/* Items Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px'
      }}>
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
              className="glass-card"
              style={{
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ position: 'relative', width: '100%', height: '185px', background: '#0a0a0f' }}>
                <img
                  src={poster}
                  alt={item.titleRu || item.title}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => handlePosterError(e, item)}
                />
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(0, 0, 0, 0.88)',
                  border: '1px solid #ffd60a',
                  borderRadius: '999px',
                  padding: '2px 7px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: '#ffd60a',
                  fontFamily: 'Space Grotesk'
                }}>
                  ★ {item.rating ? Number(item.rating).toFixed(1) : '7.8'}
                </div>
              </div>

              <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h4 style={{
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  lineHeight: '1.25',
                  marginBottom: '2px',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {item.titleRu || item.title}
                </h4>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {item.year} • {item.genres?.split(',')[0]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
