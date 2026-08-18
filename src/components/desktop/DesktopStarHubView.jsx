import React, { useState, useMemo, useEffect } from 'react';
import { Search, Play, Star, Film, Sparkles, Award, User, ChevronRight } from 'lucide-react';
import { movies } from '../../data/movies.js';
import { getPosterUrl, handlePosterError } from '../../engine/imagePrefetcher.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';
import {
  getActorProfile,
  getActorFilmography,
  fetchRealActorProfile,
  getAllActors,
  normalizeActorName
} from '../../engine/actorResolver.js';

export function DesktopStarHubView({
  selectedActorName = null,
  onSelectActor,
  onOpenDetails,
  onLaunchActorDeck
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filmSearchQuery, setFilmSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('all');
  const [livePhoto, setLivePhoto] = useState(null);
  const [heroImgError, setHeroImgError] = useState(false);

  // Pre-calculate all actors with tokenized film counts and filmographies
  const allActors = useMemo(() => {
    return getAllActors(movies);
  }, []);

  const [displayCount, setDisplayCount] = useState(60);

  const filteredActors = useMemo(() => {
    if (!searchQuery.trim()) return allActors;
    const q = searchQuery.toLowerCase().trim();
    return allActors.filter((a) => {
      const nameMatch = a.name.toLowerCase().includes(q);
      const nameEnMatch = a.nameEn && a.nameEn.toLowerCase().includes(q);
      return nameMatch || nameEnMatch;
    });
  }, [allActors, searchQuery]);

  const displayedActors = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredActors.slice(0, 100);
    }
    return filteredActors.slice(0, displayCount);
  }, [filteredActors, searchQuery, displayCount]);

  // Dynamically resolve active actor (never incorrectly fall back to Tom Hanks)
  const activeActor = useMemo(() => {
    if (selectedActorName) {
      const targetNorm = normalizeActorName(selectedActorName);
      const existing = allActors.find((a) => normalizeActorName(a.name) === targetNorm);
      if (existing) return existing;

      // Synthesize profile and filmography on the fly for uncurated actors
      const profile = getActorProfile(selectedActorName, movies);
      const actorMovies = getActorFilmography(selectedActorName, 'all', movies);
      return {
        ...profile,
        count: actorMovies.length,
        movies: actorMovies
      };
    }
    return allActors[0] || null;
  }, [allActors, selectedActorName]);

  // Reset live photo and error states when active actor changes
  useEffect(() => {
    setLivePhoto(null);
    setHeroImgError(false);
    setFilmSearchQuery('');
    setSelectedCategoryTab('all');

    if (activeActor && !activeActor.photo) {
      let isMounted = true;
      fetchRealActorProfile(activeActor.name).then((res) => {
        if (isMounted && res?.photo) {
          setLivePhoto(res.photo);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [activeActor]);

  const activeActorMovies = useMemo(() => {
    if (!activeActor) return [];
    let list = activeActor.movies || [];
    if (selectedCategoryTab !== 'all') {
      list = list.filter((m) => m.category === selectedCategoryTab);
    }
    if (filmSearchQuery.trim()) {
      const q = filmSearchQuery.toLowerCase().trim();
      list = list.filter((m) => {
        const titleRuMatch = m.titleRu && m.titleRu.toLowerCase().includes(q);
        const titleEnMatch = m.title && m.title.toLowerCase().includes(q);
        return titleRuMatch || titleEnMatch;
      });
    }
    return list;
  }, [activeActor, selectedCategoryTab, filmSearchQuery]);

  const heroPhoto = heroImgError ? null : (activeActor?.photo || livePhoto);

  return (
    <div className="desktop-two-panel-grid" style={{ gridTemplateColumns: '320px 1fr' }}>
      {/* Left Column: Actor Directory List */}
      <div className="desktop-filter-pane">
        <div style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '14px', color: 'var(--text-sunset)' }}>
          Каталог актёров ({filteredActors.length})
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <input
            type="text"
            placeholder="Поиск актёра..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
          />
          <Search
            size={15}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>

        {/* Actor Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: 'calc(100vh - 270px)', overflowY: 'auto', paddingRight: '4px' }}>
          {displayedActors.map((actor) => {
            const isSelected = activeActor && normalizeActorName(activeActor.name) === normalizeActorName(actor.name);
            return (
              <div
                key={actor.name}
                onClick={() => {
                  triggerHaptic('light');
                  playSound('tap');
                  if (onSelectActor) onSelectActor(actor.name);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'rgba(255, 94, 98, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected ? '1px solid rgba(255, 94, 98, 0.5)' : '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: isSelected ? '1.5px solid var(--accent-coral)' : '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'var(--bg-surface-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    color: 'var(--accent-coral)'
                  }}>
                    {actor.photo ? (
                      <img
                        src={actor.photo}
                        alt={actor.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      actor.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.88rem',
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {actor.name}
                    </div>
                    {actor.nameEn && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {actor.nameEn}
                      </div>
                    )}
                  </div>
                </div>

                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: isSelected ? 'var(--accent-coral)' : 'rgba(255, 255, 255, 0.08)',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  fontWeight: '700',
                  fontFamily: 'Space Grotesk',
                  flexShrink: 0
                }}>
                  {actor.count}
                </span>
              </div>
            );
          })}

          {filteredActors.length > displayedActors.length && (
            <button
              onClick={() => setDisplayCount((prev) => prev + 60)}
              style={{
                width: '100%',
                padding: '10px',
                margin: '8px 0',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Показать ещё (+60)
            </button>
          )}
        </div>
      </div>

      {/* Right Column: Hero Portfolio of Selected Actor */}
      {activeActor ? (
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)', paddingRight: '6px' }}>
          {/* Hero Banner Header */}
          <div className="glass-panel" style={{
            padding: '24px 28px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(28, 22, 34, 0.9) 0%, rgba(14, 12, 20, 0.95) 100%)',
            border: '1px solid rgba(255, 94, 98, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
              <div style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                border: '2.5px solid var(--accent-coral)',
                boxShadow: '0 8px 24px var(--accent-glow)',
                background: 'var(--bg-surface-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {heroPhoto ? (
                  <img
                    src={heroPhoto}
                    alt={activeActor.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setHeroImgError(true)}
                  />
                ) : (
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-coral)' }}>
                    {activeActor.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#fff', margin: 0 }}>
                    {activeActor.name}
                  </h1>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: '999px',
                    background: 'rgba(255, 215, 0, 0.15)',
                    color: '#ffd700',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    fontWeight: '700'
                  }}>
                    ★ Звезда Кино
                  </span>
                </div>
                {activeActor.nameEn && (
                  <div style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {activeActor.nameEn}
                  </div>
                )}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  В фильмотеке MatchWatch: <strong style={{ color: 'var(--accent-coral)' }}>{activeActor.movies ? activeActor.movies.length : 0}</strong> {(activeActor.movies ? activeActor.movies.length : 0) === 1 ? 'картина' : (activeActor.movies ? activeActor.movies.length : 0) < 5 ? 'картины' : 'картин'}
                </div>
              </div>
            </div>

            {/* Launch Actor Deck Action Button */}
            {activeActor.movies && activeActor.movies.length > 0 && (
              <button
                onClick={() => {
                  triggerHaptic('heavy');
                  playSound('swipe_like');
                  if (onLaunchActorDeck) {
                    onLaunchActorDeck(activeActor.name, activeActor.movies);
                  }
                }}
                className="btn-primary"
                style={{ padding: '12px 20px', fontSize: '0.9rem', gap: '8px' }}
              >
                <Play size={16} /> Запустить колоду с актёром
              </button>
            )}
          </div>

          {/* Interesting Facts Grid */}
          {activeActor.facts && activeActor.facts.length > 0 && (
            <div style={{ marginBottom: '22px' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-sunset)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} /> Интересные факты
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                {activeActor.facts.map((fact, idx) => (
                  <div
                    key={idx}
                    className="glass-panel"
                    style={{
                      padding: '12px 14px',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.45',
                      borderLeft: '3px solid var(--accent-coral)'
                    }}
                  >
                    {fact}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filmography Controls: Search & Category Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
              Фильмография ({activeActorMovies.length})
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* In-filmography Search */}
              <div style={{ position: 'relative', width: '200px' }}>
                <input
                  type="text"
                  placeholder="Поиск картины..."
                  value={filmSearchQuery}
                  onChange={(e) => setFilmSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '32px', height: '32px', fontSize: '0.78rem' }}
                />
                <Search
                  size={13}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>

              {/* Category Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: 'all', label: 'Всё' },
                  { id: 'movie', label: '🎬 Фильмы' },
                  { id: 'series', label: '📺 Сериалы' },
                  { id: 'anime', label: '⛩ Аниме' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedCategoryTab(tab.id);
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      background: selectedCategoryTab === tab.id ? 'var(--accent-coral)' : 'rgba(255, 255, 255, 0.05)',
                      color: selectedCategoryTab === tab.id ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Movies Grid */}
          {activeActorMovies.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '14px',
              marginBottom: '32px'
            }}>
              {activeActorMovies.map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => {
                    triggerHaptic('light');
                    playSound('tap');
                    if (onOpenDetails) onOpenDetails(movie);
                  }}
                  className="desktop-poster-card"
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '2/3',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: 'var(--bg-surface-3)'
                  }}>
                    <img
                      src={getPosterUrl(movie)}
                      alt={movie.titleRu || movie.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                      onError={(e) => handlePosterError(e, movie)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.75)',
                      backdropFilter: 'blur(4px)',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      color: '#ffd700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <Star size={11} fill="#ffd700" color="#ffd700" />
                      {movie.rating || '—'}
                    </div>
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {movie.titleRu || movie.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                      <span>{movie.year}</span>
                      <span>{movie.category === 'series' ? 'Сериал' : movie.category === 'anime' ? 'Аниме' : 'Фильм'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Фильмы в данной категории не найдены
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Выберите актёра из списка слева
        </div>
      )}
    </div>
  );
}
