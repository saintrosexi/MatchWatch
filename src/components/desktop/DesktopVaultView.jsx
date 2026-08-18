import React, { useState, useMemo } from 'react';
import {
  Heart,
  Star,
  CheckCircle2,
  Trash2,
  Play,
  Download,
  LayoutGrid,
  List,
  Search,
  Clock,
  Sparkles
} from 'lucide-react';
import { movies } from '../../data/movies.js';
import { getPosterUrl, handlePosterError } from '../../engine/imagePrefetcher.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function DesktopVaultView({
  likedIds = [],
  superlikeIds = [],
  watchedIds = [],
  onOpenDetails,
  onRemoveLike,
  onLaunchVaultDeck
}) {
  const [activeSubTab, setActiveSubTab] = useState('liked'); // 'liked' | 'superliked' | 'watched'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('');

  const targetIds = activeSubTab === 'superliked'
    ? superlikeIds
    : activeSubTab === 'watched'
    ? watchedIds
    : likedIds;

  const vaultMovies = useMemo(() => {
    const list = movies.filter((m) => targetIds.includes(m.id));
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((m) => {
      const title = (m.titleRu || m.title || '').toLowerCase();
      const dir = (m.director || '').toLowerCase();
      const gen = (m.genres || '').toLowerCase();
      return title.includes(q) || dir.includes(q) || gen.includes(q);
    });
  }, [targetIds, searchQuery]);

  const handleExport = () => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        likedCount: likedIds.length,
        superlikedCount: superlikeIds.length,
        items: vaultMovies
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `matchwatch_vault_${activeSubTab}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      triggerHaptic('success');
      playSound('tap');
    } catch (e) {
      console.warn('Export error:', e);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Top Header Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Status Sub-Tabs */}
        <div style={{
          display: 'flex',
          gap: '6px',
          background: 'rgba(16, 16, 26, 0.8)',
          padding: '4px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            onClick={() => {
              triggerHaptic('light');
              playSound('tap');
              setActiveSubTab('liked');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '999px',
              border: activeSubTab === 'liked' ? '1px solid rgba(255, 94, 98, 0.5)' : '1px solid transparent',
              background: activeSubTab === 'liked' ? 'rgba(255, 94, 98, 0.2)' : 'transparent',
              color: activeSubTab === 'liked' ? '#ff9966' : 'var(--text-secondary)',
              fontSize: '0.825rem',
              fontWeight: activeSubTab === 'liked' ? '700' : '500',
              cursor: 'pointer'
            }}
          >
            <Heart size={14} fill={activeSubTab === 'liked' ? 'currentColor' : 'none'} />
            <span>Понравилось ({likedIds.length})</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              playSound('tap');
              setActiveSubTab('superliked');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '999px',
              border: activeSubTab === 'superliked' ? '1px solid #0a84ff' : '1px solid transparent',
              background: activeSubTab === 'superliked' ? 'rgba(10, 132, 255, 0.2)' : 'transparent',
              color: activeSubTab === 'superliked' ? '#64d2ff' : 'var(--text-secondary)',
              fontSize: '0.825rem',
              fontWeight: activeSubTab === 'superliked' ? '700' : '500',
              cursor: 'pointer'
            }}
          >
            <Star size={14} fill={activeSubTab === 'superliked' ? 'currentColor' : 'none'} />
            <span>В избранном ({superlikeIds.length})</span>
          </button>
        </div>

        {/* Right Tools: Search, View Mode, Export, Launch Deck */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Search */}
          <div style={{ position: 'relative', width: '220px' }}>
            <input
              type="text"
              placeholder="Поиск в фильмотеке..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                background: 'rgba(16, 16, 26, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* View Toggle (Grid / Table) */}
          <div style={{
            display: 'flex',
            background: 'rgba(16, 16, 26, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-full)',
            padding: '2px'
          }}>
            <button
              onClick={() => setViewMode('grid')}
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                background: viewMode === 'grid' ? 'rgba(255, 94, 98, 0.2)' : 'transparent',
                color: viewMode === 'grid' ? '#ff9966' : 'var(--text-muted)'
              }}
              title="Сетка постеров"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                background: viewMode === 'table' ? 'rgba(255, 94, 98, 0.2)' : 'transparent',
                color: viewMode === 'table' ? '#ff9966' : 'var(--text-muted)'
              }}
              title="Таблица"
            >
              <List size={15} />
            </button>
          </div>

          {/* Export JSON */}
          <button
            onClick={handleExport}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
            title="Экспорт в JSON"
          >
            <Download size={14} />
            <span>Экспорт</span>
          </button>

          {/* Launch Deck Button */}
          {vaultMovies.length > 0 && (
            <button
              onClick={() => {
                triggerHaptic('medium');
                playSound('tap');
                if (onLaunchVaultDeck) onLaunchVaultDeck(vaultMovies);
              }}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              <Play size={14} fill="currentColor" />
              <span>Запустить колоду ({vaultMovies.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Grid or Table */}
      {vaultMovies.length === 0 ? (
        <div className="glass-panel" style={{
          padding: '60px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍿</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '6px' }}>
            В этой категории пока пусто
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
            Листайте ленту свайпов и сохраняйте понравившиеся фильмы, чтобы сформировать свою коллекцию.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Mode */
        <div className="desktop-media-grid">
          {vaultMovies.map((movie) => {
            const poster = getPosterUrl(movie);
            return (
              <div
                key={movie.id}
                onClick={() => {
                  triggerHaptic('light');
                  playSound('tap');
                  if (onOpenDetails) onOpenDetails(movie);
                }}
                className="desktop-media-card"
              >
                <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', background: '#0a0a0f', overflow: 'hidden' }}>
                  <img
                    src={poster}
                    alt={movie.titleRu || movie.title}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => handlePosterError(e, movie)}
                  />
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
                    ★ {movie.rating ? Number(movie.rating).toFixed(1) : '7.8'}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('medium');
                      if (onRemoveLike) onRemoveLike(movie.id);
                    }}
                    title="Удалить из коллекции"
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.75)',
                      border: '1px solid rgba(255, 71, 87, 0.4)',
                      color: '#ff5e62',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      lineHeight: '1.3',
                      marginBottom: '4px',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {movie.titleRu || movie.title}
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {movie.year} • {movie.genres?.split(',')[0]}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table Mode */
        <div className="glass-panel" style={{ overflowX: 'auto', padding: '8px' }}>
          <table className="desktop-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Постер</th>
                <th>Название</th>
                <th>Режиссёр</th>
                <th>Год</th>
                <th>Жанры</th>
                <th>Рейтинг</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {vaultMovies.map((m) => {
                const poster = getPosterUrl(m);
                return (
                  <tr
                    key={m.id}
                    onClick={() => {
                      triggerHaptic('light');
                      playSound('tap');
                      if (onOpenDetails) onOpenDetails(m);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <img
                        src={poster}
                        alt={m.titleRu || m.title}
                        style={{ width: '38px', height: '54px', objectFit: 'cover', borderRadius: '4px' }}
                        onError={(e) => handlePosterError(e, m)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: '700', color: '#fff' }}>{m.titleRu || m.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.title}</div>
                    </td>
                    <td>{m.director || '—'}</td>
                    <td>{m.year}</td>
                    <td>{m.genres}</td>
                    <td>
                      <span style={{ color: '#ffd60a', fontWeight: '700', fontFamily: 'Space Grotesk' }}>
                        ★ {m.rating ? Number(m.rating).toFixed(1) : '7.8'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('medium');
                          if (onRemoveLike) onRemoveLike(m.id);
                        }}
                        title="Удалить"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '6px'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ff5e62')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
