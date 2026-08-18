import React, { useState } from 'react';
import { Star, Clock, Info } from 'lucide-react';
import { getPosterCandidates } from '../../engine/imagePrefetcher.js';

export function SwipeCard({
  movie,
  dragState,
  isTopCard = false,
  stackIndex = 0,
  onOpenDetails,
  bind = {}
}) {
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [allImagesFailed, setAllImagesFailed] = useState(false);

  const candidates = getPosterCandidates(movie);
  const currentPosterUrl = candidates[candidateIdx] || '';

  const handleImgError = () => {
    if (candidateIdx < candidates.length - 1) {
      setCandidateIdx((prev) => prev + 1);
    } else {
      setAllImagesFailed(true);
    }
  };

  // Stack offset calculations for background cards
  const scale = isTopCard ? 1 : Math.max(0.88, 1 - stackIndex * 0.04);
  const translateY = isTopCard ? (dragState?.y || 0) : stackIndex * 12;
  const translateX = isTopCard ? (dragState?.x || 0) : 0;
  const rotateZ = isTopCard ? (dragState?.rotateZ || 0) : 0;
  const rotateX = isTopCard ? (dragState?.rotateX || 0) : 0;
  const rotateY = isTopCard ? (dragState?.rotateY || 0) : 0;

  // Fly-out animation class
  const flyOutClass = isTopCard && dragState?.flyOut
    ? dragState.flyOut === 'right'
      ? 'card-fly-right'
      : dragState.flyOut === 'left'
      ? 'card-fly-left'
      : 'card-fly-up'
    : '';

  // Extract top 2 actors & genres
  const actorsList = (movie?.actors || '').split(',').map((a) => a.trim()).filter(Boolean).slice(0, 2);
  const genresList = (movie?.genres || '').split(',').map((g) => g.trim()).filter(Boolean).slice(0, 3);

  return (
    <div
      {...(isTopCard ? bind : {})}
      className={`card-3d-wrapper ${flyOutClass}`}
      style={{
        zIndex: 20 - stackIndex,
        transform: isTopCard && dragState?.flyOut
          ? undefined
          : `translate3d(${translateX}px, ${translateY}px, 0) rotateZ(${rotateZ}deg) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
        transition: isTopCard && dragState?.isDragging ? 'none' : 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        background: 'var(--bg-surface-2)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isTopCard
          ? '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 1px 1px rgba(255, 255, 255, 0.1)'
          : '0 12px 30px rgba(0, 0, 0, 0.6)'
      }}
    >
      {/* Movie Poster Image or Stylized Fallback Art */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {!allImagesFailed && currentPosterUrl ? (
          <img
            src={currentPosterUrl}
            alt={movie.titleRu || movie.title}
            onError={handleImgError}
            loading={isTopCard ? 'eager' : 'lazy'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: isTopCard ? 'brightness(0.92)' : 'brightness(0.72)',
              transform: 'scale(1.02)'
            }}
          />
        ) : (
          /* High-Contrast Stylized Cinema Backdrop Card */
          <div style={{
            width: '100%',
            height: '100%',
            background: 'radial-gradient(ellipse at 50% 30%, #1f1f35 0%, #0c0c14 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎬</div>
            <div style={{
              fontFamily: 'Syne',
              fontSize: '1.4rem',
              fontWeight: '800',
              color: 'var(--text-sunset)',
              marginBottom: '8px'
            }}>
              {movie.titleRu || movie.title}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {movie.genres}
            </div>
          </div>
        )}

        {/* Dynamic Light Sheen on 3D Tilt */}
        {isTopCard && dragState?.isDragging && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at ${50 + (dragState.x * 0.1)}% ${50 + (dragState.y * 0.1)}%, rgba(255, 255, 255, 0.16) 0%, transparent 60%)`,
            pointerEvents: 'none'
          }} />
        )}

        {/* Bottom Dark Gradient for Legibility */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(7, 7, 10, 0.2) 0%, rgba(7, 7, 10, 0.1) 40%, rgba(7, 7, 10, 0.85) 75%, rgba(7, 7, 10, 0.98) 100%)',
          pointerEvents: 'none'
        }} />
      </div>

      {/* Swipe Feedback Stamp Overlays */}
      {isTopCard && (dragState?.direction === 'like' || dragState?.flyOut === 'right') && (
        <div style={{
          position: 'absolute',
          top: '32px',
          left: '28px',
          padding: '8px 18px',
          border: '3px solid var(--accent-emerald)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--accent-emerald)',
          fontFamily: 'Syne',
          fontWeight: '800',
          fontSize: '1.3rem',
          transform: 'rotate(-15deg)',
          background: 'rgba(10, 10, 16, 0.8)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 0 20px var(--accent-emerald-glow)',
          zIndex: 30,
          pointerEvents: 'none'
        }}>
          НРАВИТСЯ ❤️
        </div>
      )}

      {isTopCard && (dragState?.direction === 'pass' || dragState?.flyOut === 'left') && (
        <div style={{
          position: 'absolute',
          top: '32px',
          right: '28px',
          padding: '8px 18px',
          border: '3px solid var(--accent-coral)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--accent-coral)',
          fontFamily: 'Syne',
          fontWeight: '800',
          fontSize: '1.3rem',
          transform: 'rotate(15deg)',
          background: 'rgba(10, 10, 16, 0.8)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 0 20px var(--accent-glow)',
          zIndex: 30,
          pointerEvents: 'none'
        }}>
          ПРОПУСК ✕
        </div>
      )}

      {isTopCard && (dragState?.direction === 'superlike' || dragState?.flyOut === 'up') && (
        <div style={{
          position: 'absolute',
          top: '36px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 20px',
          border: '3px solid var(--accent-sapphire)',
          borderRadius: 'var(--radius-md)',
          color: '#64d2ff',
          fontFamily: 'Syne',
          fontWeight: '800',
          fontSize: '1.25rem',
          background: 'rgba(10, 10, 16, 0.85)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 0 24px var(--accent-sapphire-glow)',
          zIndex: 30,
          pointerEvents: 'none'
        }}>
          ★ В ИЗБРАННОЕ
        </div>
      )}

      {/* Top Header Information Overlay */}
      <div style={{
        position: 'absolute',
        top: '14px',
        left: '14px',
        right: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        {/* Rating Pill */}
        <div className="rating-pill">
          <Star size={13} fill="currentColor" />
          <span>{movie.rating ? Number(movie.rating).toFixed(1) : '7.8'}</span>
        </div>

        {/* Year & Duration */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(10, 10, 16, 0.8)',
          backdropFilter: 'blur(12px)',
          padding: '3px 10px',
          borderRadius: '999px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          fontFamily: 'Space Grotesk'
        }}>
          <span>{movie.year}</span>
          {movie.duration && (
            <>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Clock size={11} /> {movie.duration}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bottom Content Hierarchy Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '20px 16px 16px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        {/* Genre Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {genresList.map((genre, idx) => (
            <span key={idx} className="chip chip-sunset">
              {genre}
            </span>
          ))}
          {movie.country && (
            <span className="chip" style={{ fontSize: '0.7rem' }}>
              {movie.country}
            </span>
          )}
        </div>

        {/* Movie Title */}
        <h2 style={{
          fontSize: '1.5rem',
          lineHeight: '1.2',
          fontWeight: '800',
          color: '#ffffff',
          textShadow: '0 2px 8px rgba(0,0,0,0.85)'
        }}>
          {movie.titleRu || movie.title}
        </h2>

        {/* Top 2 Actors preview */}
        {actorsList.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)'
          }}>
            <span>🎭</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {actorsList.join(', ')}
            </span>
          </div>
        )}

        {/* Short Synopsis preview & Details Trigger */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '2px'
        }}>
          <p style={{
            fontSize: '0.8rem',
            lineHeight: '1.35',
            color: 'rgba(255, 255, 255, 0.75)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            flex: 1,
            marginRight: '10px'
          }}>
            {movie.description || movie.fullDescription || 'Захватывающая кинематографическая история.'}
          </p>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenDetails) onOpenDetails(movie);
            }}
            title="Подробнее о фильме"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 94, 98, 0.15)',
              border: '1px solid rgba(255, 94, 98, 0.4)',
              color: '#ff9966',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Info size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
