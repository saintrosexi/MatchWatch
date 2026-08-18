import React, { useState, useMemo } from 'react';
import { Search, Play, Star, Clock, Film, Sparkles } from 'lucide-react';
import { movies } from '../../data/movies.js';
import { curatedCollections } from '../../data/collections.js';
import { getPosterUrl, handlePosterError } from '../../engine/imagePrefetcher.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function DiscoveryView({
  onOpenDetails,
  onLaunchCollectionDeck
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Все');

  const movieGenres = ['Все', 'Боевик', 'Комедия', 'Драма', 'Триллер', 'Фантастика', 'Приключения', 'Криминал', 'Детектив', 'Фэнтези'];

  // All curated movie collections
  const activeCollections = curatedCollections;

  // Filtered items
  const filteredItems = useMemo(() => {
    return movies.filter((m) => {
      // Genre filter
      if (selectedGenre !== 'Все') {
        const mGenres = (m.genres || '').toLowerCase();
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
  }, [selectedGenre, searchQuery]);

  return (
    <div style={{ padding: '0 16px 24px', width: '100%' }}>
      {/* Header Title */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '4px' }}>
          Кино-каталог
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Шедевры мирового кинематографа и культовые фильмы
        </p>
      </div>

      {/* Search Input Bar */}
      <div style={{
        position: 'relative',
        width: '100%',
        marginBottom: '18px'
      }}>
        <input
          type="text"
          placeholder="Поиск по названию или режиссёру..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px 12px 42px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            outline: 'none'
          }}
        />
        <Search
          size={18}
          color="var(--text-muted)"
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        />
      </div>

      {/* Curated Collections Horizontal Scroller */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{
          fontSize: '0.95rem',
          fontWeight: '700',
          marginBottom: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>🔥 Тематические подборки</span>
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
                minWidth: '200px',
                width: '200px',
                padding: '12px',
                cursor: 'pointer',
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{
                position: 'relative',
                width: '100%',
                height: '110px',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                marginBottom: '8px'
              }}>
                <img
                  src={col.cover}
                  alt={col.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  fontWeight: '700',
                  color: col.accent || 'var(--accent-coral)'
                }}>
                  {col.badge}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.88rem', fontWeight: '700', lineHeight: 1.2, marginBottom: '4px' }}>
                  {col.title}
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  {col.subtitle}
                </p>
              </div>

              <div style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--accent-coral)',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                <Play size={12} fill="currentColor" />
                <span>Смотреть подборку</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Genre Filter Horizontal Scroll */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '14px',
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
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: isSelected ? '1px solid rgba(255, 94, 98, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isSelected ? 'rgba(255, 94, 98, 0.18)' : 'rgba(255, 255, 255, 0.03)',
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

              <div style={{ padding: '10px' }}>
                <h4 style={{
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: '2px'
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
