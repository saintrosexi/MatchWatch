import React, { useState } from 'react';
import { X, Play, Star, Clock, User, Heart, Share2, Film, Sparkles, ExternalLink } from 'lucide-react';
import { getPosterUrl, handlePosterError } from '../../engine/imagePrefetcher.js';
import { RadarChart5D } from '../common/RadarChart5D.jsx';
import { getActorProfile } from '../../engine/actorResolver.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';

export function MovieDetailsSheet({
  movie,
  onClose,
  onLike,
  isLiked = false,
  onSelectActor
}) {
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);

  if (!movie) return null;

  const poster = getPosterUrl(movie);
  const actorsList = (movie.actors || '').split(',').map((a) => a.trim()).filter(Boolean);
  const genresList = (movie.genres || '').split(',').map((g) => g.trim()).filter(Boolean);

  // Extract YouTube trailer embed ID
  const getEmbedTrailerUrl = (url) => {
    if (!url) return null;
    try {
      if (url.includes('watch?v=')) {
        const id = url.split('watch?v=')[1]?.split('&')[0];
        return `https://www.youtube.com/embed/${id}?autoplay=1`;
      }
      if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1]?.split('?')[0];
        return `https://www.youtube.com/embed/${id}?autoplay=1`;
      }
    } catch (e) {}
    return null;
  };

  const trailerEmbed = getEmbedTrailerUrl(movie.trailer);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn-icon"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 100,
            background: 'rgba(0,0,0,0.6)'
          }}
        >
          <X size={20} />
        </button>

        {/* Header Media: Trailer Player or Parallax Backdrop */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '240px',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          marginBottom: '20px',
          background: 'var(--bg-surface-3)'
        }}>
          {isPlayingTrailer && trailerEmbed ? (
            <iframe
              src={trailerEmbed}
              title="Movie Trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <>
              <img
                src={poster}
                alt={movie.titleRu || movie.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'brightness(0.7) blur(2px)'
                }}
                onError={(e) => handlePosterError(e, movie)}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(16, 16, 23, 0.9) 100%)'
              }} />

              {/* Poster Thumbnail & Trailer Trigger Overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                padding: '16px'
              }}>
                <img
                  src={poster}
                  alt="Poster"
                  style={{
                    width: '85px',
                    height: '125px',
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                />

                {movie.trailer && (
                  <button
                    onClick={() => {
                      triggerHaptic('medium');
                      playSound('tap');
                      setIsPlayingTrailer(true);
                    }}
                    className="btn-primary"
                    style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                  >
                    <Play size={16} fill="currentColor" /> Смотреть трейлер
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Title, Year, Rating */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="rating-pill">
              <Star size={14} fill="currentColor" />
              <span>{movie.rating ? Number(movie.rating).toFixed(1) : '7.8'}</span>
            </div>
            <span className="chip">{movie.year}</span>
            {movie.duration && (
              <span className="chip" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {movie.duration}
              </span>
            )}
            {movie.country && <span className="chip">{movie.country}</span>}
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: '1.2' }}>
            {movie.titleRu || movie.title}
          </h1>

          {movie.director && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Режиссёр: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{movie.director}</span>
            </div>
          )}
        </div>

        {/* Genre Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {genresList.map((genre, idx) => (
            <span key={idx} className="chip chip-gold">
              {genre}
            </span>
          ))}
          {movie.vibeBadges && movie.vibeBadges.map((badge, idx) => (
            <span key={`vibe-${idx}`} className="chip chip-coral">
              {badge}
            </span>
          ))}
        </div>

        {/* Synopsis */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-gold)', marginBottom: '8px' }}>
            О фильме
          </h3>
          <p style={{ fontSize: '0.925rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
            {movie.fullDescription || movie.description || 'Описание уточняется.'}
          </p>
        </div>

        {/* 5D Sensation Vector Radar */}
        {movie.sensationVector && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 16px',
            marginBottom: '24px'
          }}>
            <h3 style={{
              fontSize: '0.95rem',
              color: 'var(--text-gold)',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Sparkles size={16} /> 5D-Вайб фильма
            </h3>
            <RadarChart5D vector={movie.sensationVector} size={190} color="#f59e0b" />
          </div>
        )}

        {/* Actors Carousel */}
        {actorsList.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-gold)', marginBottom: '12px' }}>
              В главных ролях
            </h3>
            <div style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              paddingBottom: '8px',
              scrollbarWidth: 'none'
            }}>
              {actorsList.map((actorName, idx) => {
                const actorObj = getActorProfile(actorName);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (onSelectActor) {
                        triggerHaptic('light');
                        playSound('tap');
                        onSelectActor(actorName);
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: '85px',
                      maxWidth: '95px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: 'var(--bg-surface-3)',
                      border: '1.5px solid rgba(245, 158, 11, 0.3)',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      fontWeight: '700',
                      color: 'var(--accent-gold)'
                    }}>
                      {actorObj?.photo ? (
                        <img
                          src={actorObj.photo}
                          alt={actorName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        actorName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      lineHeight: '1.25',
                      color: 'var(--text-primary)'
                    }}>
                      {actorName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dedicated Streaming Placeholder Section (Requested by User) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 16, 23, 0.9) 100%)',
          border: '1px dashed rgba(245, 158, 11, 0.35)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 16px',
          textAlign: 'center',
          marginBottom: '28px'
        }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '6px' }}>🎬📺</div>
          <div style={{
            fontFamily: 'Syne',
            fontSize: '0.95rem',
            fontWeight: '700',
            color: 'var(--text-gold)',
            marginBottom: '4px'
          }}>
            Где смотреть онлайн
          </div>
          <p style={{
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.4'
          }}>
            Скоро добавим, следите за обновлениями
          </p>
        </div>

        {/* Action Bar in Sheet */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              if (onLike) {
                triggerHaptic('medium');
                playSound('swipe_like');
                onLike(movie);
              }
            }}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            {isLiked ? 'В сохранённых ♥' : 'Нравится'}
          </button>

          {movie.imdb && (
            <a
              href={movie.imdb}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={16} /> IMDb
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
