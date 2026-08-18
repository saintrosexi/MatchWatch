import React, { useState, useMemo } from 'react';
import { Heart, Star, CheckCircle, LayoutGrid, List, Play, Trash2, Clock, Sparkles } from 'lucide-react';
import { movies } from '../../data/movies.js';
import { getPosterUrl, handlePosterError } from '../../engine/imagePrefetcher.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';
import { ChamaGuide } from '../common/ChamaGuide.jsx';

export function CineVaultView({
  likedIds = [],
  superlikeIds = [],
  watchedIds = [],
  onOpenDetails,
  onRemoveLike,
  onLaunchVaultDeck
}) {
  const [activeTab, setActiveTab] = useState('liked'); // 'liked' | 'superlikes' | 'watched'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState('rating'); // 'rating' | 'year' | 'title'

  // Get active movies list based on tab
  const currentMovieIds = useMemo(() => {
    if (activeTab === 'superlikes') return superlikeIds;
    if (activeTab === 'watched') return watchedIds;
    return likedIds;
  }, [activeTab, likedIds, superlikeIds, watchedIds]);

  const vaultMovies = useMemo(() => {
    const list = movies.filter((m) => currentMovieIds.includes(m.id));
    return list.sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'year') return (b.year || 0) - (a.year || 0);
      return (a.titleRu || a.title).localeCompare(b.titleRu || b.title);
    });
  }, [currentMovieIds, sortBy]);

  return (
    <div style={{ padding: '0 16px 24px', width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '4px' }}>
            Кино-сейф
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Ваша персональная фильмотека и закладки
          </p>
        </div>

        {/* Grid/List View Mode Toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '3px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              padding: '6px',
              borderRadius: '50%',
              background: viewMode === 'grid' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: 'none',
              color: viewMode === 'grid' ? 'var(--accent-gold)' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px',
              borderRadius: '50%',
              background: viewMode === 'list' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: 'none',
              color: viewMode === 'list' ? 'var(--accent-gold)' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '12px',
        marginBottom: '16px'
      }}>
        <button
          onClick={() => setActiveTab('liked')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: activeTab === 'liked' ? 'rgba(255, 71, 87, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            border: activeTab === 'liked' ? '1px solid rgba(255, 71, 87, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
            color: activeTab === 'liked' ? '#ff6b81' : 'var(--text-secondary)',
            fontSize: '0.825rem',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          <Heart size={14} fill={activeTab === 'liked' ? 'currentColor' : 'none'} />
          Понравилось ({likedIds.length})
        </button>

        <button
          onClick={() => setActiveTab('superlikes')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: activeTab === 'superlikes' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            border: activeTab === 'superlikes' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
            color: activeTab === 'superlikes' ? '#60a5fa' : 'var(--text-secondary)',
            fontSize: '0.825rem',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          <Star size={14} fill={activeTab === 'superlikes' ? 'currentColor' : 'none'} />
          Суперлайки ({superlikeIds.length})
        </button>

        <button
          onClick={() => setActiveTab('watched')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: activeTab === 'watched' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            border: activeTab === 'watched' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
            color: activeTab === 'watched' ? '#34d399' : 'var(--text-secondary)',
            fontSize: '0.825rem',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          <CheckCircle size={14} />
          Просмотрено ({watchedIds.length})
        </button>
      </div>

      {/* Action to launch swipe session from this list */}
      {vaultMovies.length > 0 && onLaunchVaultDeck && (
        <button
          onClick={() => onLaunchVaultDeck(vaultMovies)}
          className="btn-secondary"
          style={{ width: '100%', marginBottom: '16px', fontSize: '0.825rem', padding: '10px' }}
        >
          <Play size={14} fill="currentColor" /> Запустить колоду из этого списка
        </button>
      )}

      {/* Empty State */}
      {vaultMovies.length === 0 ? (
        <ChamaGuide
          state="empty"
          text={
            activeTab === 'liked'
              ? 'Вы пока не сохранили ни одного фильма. Свайпайте вправо на главном экране!'
              : activeTab === 'superlikes'
              ? 'Суперлайков пока нет. Свайпайте вверх, чтобы добавлять в избранное!'
              : 'Список просмотренных пуст.'
          }
        />
      ) : viewMode === 'grid' ? (
        /* Grid Mode */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '14px'
        }}>
          {vaultMovies.map((movie) => {
            const poster = getPosterUrl(movie);
            return (
              <div
                key={movie.id}
                onClick={() => onOpenDetails && onOpenDetails(movie)}
                className="glass-card"
                style={{ overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
              >
                <div style={{ position: 'relative', width: '100%', height: '210px' }}>
                  <img
                    src={poster}
                    alt={movie.titleRu || movie.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => handlePosterError(e, movie)}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.8)',
                    border: '1px solid var(--accent-gold)',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: 'var(--accent-gold-light)'
                  }}>
                    ★ {movie.rating}
                  </div>
                </div>

                <div style={{ padding: '10px' }}>
                  <h4 style={{
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {movie.titleRu || movie.title}
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {movie.year} • {movie.genres?.split(',')[0]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List Mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {vaultMovies.map((movie) => {
            const poster = getPosterUrl(movie);
            return (
              <div
                key={movie.id}
                onClick={() => onOpenDetails && onOpenDetails(movie)}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  gap: '12px',
                  cursor: 'pointer'
                }}
              >
                <img
                  src={poster}
                  alt={movie.titleRu}
                  style={{ width: '48px', height: '68px', borderRadius: 'var(--radius-xs)', objectFit: 'cover' }}
                  onError={(e) => handlePosterError(e, movie)}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <h4 style={{
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {movie.titleRu || movie.title}
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    ★ {movie.rating} • {movie.year} • {movie.genres?.split(',')[0]}
                  </div>
                  {movie.director && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Реж: {movie.director}
                    </div>
                  )}
                </div>

                {onRemoveLike && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveLike(movie.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      padding: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
