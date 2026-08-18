import React, { useState, useMemo, useEffect } from 'react';
import { Star, Search, Play, User, Film, Sparkles, ChevronLeft } from 'lucide-react';
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

export function StarHubView({
  selectedActorName = null,
  onSelectActor,
  onOpenDetails,
  onLaunchActorDeck
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filmCategory, setFilmCategory] = useState('all');
  const [filmSearchQuery, setFilmSearchQuery] = useState('');
  const [livePhoto, setLivePhoto] = useState(null);
  const [heroImgError, setHeroImgError] = useState(false);

  // Precomputed actor catalog enriched with film counts and sorted descending
  const allActors = useMemo(() => {
    return getAllActors(movies);
  }, []);

  const [displayCount, setDisplayCount] = useState(40);

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

  // Selected Actor Details resolved dynamically
  const selectedActor = useMemo(() => {
    if (!selectedActorName) return null;
    return getActorProfile(selectedActorName);
  }, [selectedActorName]);

  // Reset live photo and image error on actor change
  useEffect(() => {
    setLivePhoto(null);
    setHeroImgError(false);
    setFilmCategory('all');
    setFilmSearchQuery('');

    if (selectedActor && !selectedActor.photo) {
      let isMounted = true;
      fetchRealActorProfile(selectedActor.name).then((res) => {
        if (isMounted && res?.photo) {
          setLivePhoto(res.photo);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [selectedActor]);

  const allActorMovies = useMemo(() => {
    if (!selectedActorName) return [];
    return getActorFilmography(selectedActorName, 'all');
  }, [selectedActorName]);

  const filteredActorMovies = useMemo(() => {
    let list = allActorMovies;
    if (filmCategory !== 'all') {
      list = list.filter((m) => m.category === filmCategory);
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
  }, [allActorMovies, filmCategory, filmSearchQuery]);

  if (selectedActor && selectedActorName) {
    const heroPhoto = heroImgError ? null : (selectedActor.photo || livePhoto);

    return (
      <div style={{ padding: '0 16px 24px', width: '100%' }}>
        {/* Back Button */}
        <button
          onClick={() => {
            triggerHaptic('light');
            if (onSelectActor) onSelectActor(null);
          }}
          className="btn-secondary"
          style={{ marginBottom: '16px', padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ChevronLeft size={16} /> Все актёры
        </button>

        {/* Actor Hero Card */}
        <div className="glass-panel-thick" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '110px',
            height: '110px',
            borderRadius: '50%',
            overflow: 'hidden',
            margin: '0 auto 16px',
            border: '2px solid var(--accent-gold)',
            boxShadow: '0 0 20px var(--accent-gold-glow)',
            background: 'var(--bg-surface-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {heroPhoto ? (
              <img
                src={heroPhoto}
                alt={selectedActor.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setHeroImgError(true)}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                fontWeight: '800',
                color: 'var(--accent-gold)'
              }}>
                {selectedActor.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '4px' }}>
            {selectedActor.name}
          </h1>
          {selectedActor.nameEn && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {selectedActor.nameEn}
            </div>
          )}
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            В коллекции MatchWatch: <strong style={{ color: 'var(--accent-gold)' }}>{allActorMovies.length}</strong> {allActorMovies.length === 1 ? 'картина' : allActorMovies.length < 5 ? 'картины' : 'картин'}
          </div>

          {/* Launch Actor Deck CTA */}
          {allActorMovies.length > 0 && onLaunchActorDeck && (
            <button
              onClick={() => {
                triggerHaptic('medium');
                playSound('tap');
                onLaunchActorDeck(selectedActor.name, allActorMovies);
              }}
              className="btn-primary"
              style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}
            >
              <Play size={16} fill="currentColor" /> Колода «Только с {selectedActor.name}»
            </button>
          )}
        </div>

        {/* Facts List */}
        {selectedActor.facts && selectedActor.facts.length > 0 && (
          <div className="glass-panel" style={{ padding: '18px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} /> Интересные факты
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedActor.facts.map((fact, idx) => (
                <div key={idx} style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                  • {fact}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filmography Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>
              Фильмография ({filteredActorMovies.length})
            </h3>

            {/* Category Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
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
                    setFilmCategory(tab.id);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.74rem',
                    fontWeight: '600',
                    background: filmCategory === tab.id ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.06)',
                    color: filmCategory === tab.id ? '#000' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* In-filmography Search */}
          {allActorMovies.length > 4 && (
            <div style={{ position: 'relative', width: '100%', marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="Поиск по картинам актёра..."
                value={filmSearchQuery}
                onChange={(e) => setFilmSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 36px',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          )}

          {/* Filmography Grid */}
          {filteredActorMovies.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              {filteredActorMovies.map((movie) => {
                const poster = getPosterUrl(movie);
                return (
                  <div
                    key={movie.id}
                    onClick={() => {
                      triggerHaptic('light');
                      playSound('tap');
                      if (onOpenDetails) onOpenDetails(movie);
                    }}
                    className="glass-card"
                    style={{ overflow: 'hidden', cursor: 'pointer' }}
                  >
                    <div style={{ position: 'relative', width: '100%', height: '190px' }}>
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
                        background: 'rgba(0,0,0,0.85)',
                        border: '1px solid var(--accent-gold)',
                        borderRadius: '999px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        color: 'var(--accent-gold-light)'
                      }}>
                        ★ {movie.rating}
                      </div>
                    </div>
                    <div style={{ padding: '10px' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {movie.titleRu || movie.title}
                      </h4>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span>{movie.year}</span>
                        <span>{movie.category === 'series' ? 'Сериал' : movie.category === 'anime' ? 'Аниме' : 'Фильм'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Фильмы в данной категории не найдены
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 24px', width: '100%' }}>
      {/* Catalog Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '4px' }}>
          Звёзды кино
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Культовые актёры и их лучшие роли в базе MatchWatch
        </p>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', width: '100%', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Поиск актёра..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px 14px 44px',
            background: 'var(--bg-surface-2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            outline: 'none'
          }}
        />
        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      {/* Actors Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '14px'
      }}>
        {displayedActors.map((actor) => (
          <div
            key={actor.name}
            onClick={() => {
              triggerHaptic('light');
              playSound('tap');
              if (onSelectActor) onSelectActor(actor.name);
            }}
            className="glass-card"
            style={{
              padding: '16px 12px',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative'
            }}
          >
            <div style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'var(--bg-surface-3)',
              border: '1.5px solid rgba(245, 158, 11, 0.3)',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              fontWeight: '800',
              color: 'var(--accent-gold)'
            }}>
              {actor.photo ? (
                <img
                  src={actor.photo}
                  alt={actor.name}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                actor.name.slice(0, 2).toUpperCase()
              )}
            </div>

            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', lineHeight: '1.25', marginBottom: '2px' }}>
              {actor.name}
            </h3>
            {actor.nameEn && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {actor.nameEn}
              </span>
            )}
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(245, 158, 11, 0.12)',
              color: 'var(--accent-gold-light)',
              fontWeight: '700',
              marginTop: '4px'
            }}>
              {actor.count} {actor.count === 1 ? 'фильм' : (actor.count >= 2 && actor.count <= 4) ? 'фильма' : 'фильмов'}
            </span>
          </div>
        ))}
      </div>

      {filteredActors.length > displayedActors.length && (
        <button
          onClick={() => setDisplayCount((prev) => prev + 40)}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '16px',
            background: 'var(--bg-surface-2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Показать ещё (+40)
        </button>
      )}
    </div>
  );
}
