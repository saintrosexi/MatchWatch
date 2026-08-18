import React, { useState } from 'react';
import {
  X,
  Play,
  Heart,
  Star,
  Clock,
  Film,
  User,
  Share2,
  Check,
  Maximize2
} from 'lucide-react';
import { getPosterUrl, handlePosterError } from '../../engine/imagePrefetcher.js';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound } from '../../engine/soundEngine.js';
import { getActorProfile } from '../../engine/actorResolver.js';

export function DesktopMovieDetailsModal({
  movie,
  isLiked = false,
  onClose,
  onLike,
  onSelectActor
}) {
  const [showFullTrailer, setShowFullTrailer] = useState(false);
  const [likedState, setLikedState] = useState(isLiked);
  const [copied, setCopied] = useState(false);

  if (!movie) return null;

  const poster = getPosterUrl(movie);
  const actorsList = (movie.actors || '').split(',').map((a) => a.trim()).filter(Boolean);
  const genresList = (movie.genres || '').split(',').map((g) => g.trim()).filter(Boolean);

  // YouTube trailer search query / ID helper
  const trailerSearchUrl = movie.trailer && movie.trailer.includes('youtube.com')
    ? movie.trailer
    : `https://www.youtube.com/results?search_query=${encodeURIComponent((movie.titleRu || movie.title) + ' трейлер')}`;

  const handleLikeClick = () => {
    const next = !likedState;
    setLikedState(next);
    triggerHaptic(next ? 'medium' : 'light');
    if (next) playSound('swipe_like');
    if (onLike) onLike(movie);
  };

  const handleShare = () => {
    const text = `🎬 Рекомендую посмотреть: «${movie.titleRu || movie.title}» (${movie.year}) — Рейтинг ★ ${movie.rating || '7.8'}\nВ приложении MatchWatch!`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      triggerHaptic('success');
      playSound('tap');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="desktop-modal-backdrop" onClick={onClose}>
      <div
        className="desktop-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Column: Big Poster & Quick Actions */}
        <div style={{
          position: 'relative',
          background: '#0a0a0f',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px'
        }}>
          {/* Poster Image */}
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '2/3',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <img
              src={poster}
              alt={movie.titleRu || movie.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => handlePosterError(e, movie)}
            />
            {/* Rating */}
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(0, 0, 0, 0.88)',
              border: '1px solid #ffd60a',
              borderRadius: '999px',
              padding: '4px 10px',
              fontSize: '0.85rem',
              fontWeight: '800',
              color: '#ffd60a',
              fontFamily: 'Space Grotesk'
            }}>
              ★ {movie.rating ? Number(movie.rating).toFixed(1) : '7.8'}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={handleLikeClick}
              className={likedState ? 'btn-primary' : 'btn-secondary'}
              style={{ flex: 1, padding: '11px', fontSize: '0.85rem' }}
            >
              <Heart size={16} fill={likedState ? 'currentColor' : 'none'} />
              <span>{likedState ? 'В фильмотеке' : 'Нравится'}</span>
            </button>

            <button
              onClick={handleShare}
              className="btn-secondary"
              style={{ padding: '11px 14px' }}
              title="Поделиться фильмом"
            >
              {copied ? <Check size={16} color="var(--accent-emerald)" /> : <Share2 size={16} />}
            </button>
          </div>
        </div>

        {/* Right Column: Detailed Info & Trailer Preview */}
        <div style={{ padding: '28px 32px', overflowY: 'auto' }}>
          {/* Top Bar with Close */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', fontFamily: 'Syne', color: '#fff', lineHeight: '1.2' }}>
                {movie.titleRu || movie.title}
              </h2>
              {movie.title && movie.titleRu && (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {movie.title}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="btn-icon"
              style={{ width: '36px', height: '36px' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Meta Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
            <span className="chip" style={{ fontFamily: 'Space Grotesk' }}>
              📅 {movie.year}
            </span>
            {movie.duration && (
              <span className="chip">
                <Clock size={12} /> {movie.duration}
              </span>
            )}
            {movie.country && (
              <span className="chip">
                🌍 {movie.country}
              </span>
            )}
            {genresList.map((g, i) => (
              <span key={i} className="chip chip-sunset">
                {g}
              </span>
            ))}
          </div>

          {/* Trailer Button */}
          <div style={{ marginBottom: '22px' }}>
            <a
              href={trailerSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ display: 'inline-flex', padding: '10px 18px', fontSize: '0.85rem' }}
            >
              <Play size={15} fill="currentColor" />
              <span>Смотреть трейлер на YouTube</span>
            </a>
          </div>

          {/* Director & Cast */}
          <div style={{ marginBottom: '20px' }}>
            {movie.director && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <strong style={{ color: '#fff' }}>Режиссёр:</strong> {movie.director}
              </div>
            )}

            {actorsList.length > 0 && (
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <strong style={{ color: '#fff' }}>В главных ролях:</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {actorsList.map((actor, idx) => {
                    const actorObj = getActorProfile(actor);
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          triggerHaptic('light');
                          if (onSelectActor) onSelectActor(actor);
                        }}
                        className="chip"
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px 4px 6px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent-coral)';
                          e.currentTarget.style.color = '#ff9966';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--glass-border)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: '700',
                          flexShrink: 0
                        }}>
                          {actorObj?.photo ? (
                            <img
                              src={actorObj.photo}
                              alt={actor}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <User size={10} />
                          )}
                        </div>
                        {actor}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Synopsis */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-sunset)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              О фильме
            </div>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.85)' }}>
              {movie.fullDescription || movie.description || 'Увлекательная кинематографическая история.'}
            </p>
          </div>

          {/* 5D Sensation Vector */}
          {movie.sensationVector && (
            <div style={{
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>
                5D-Вектор ощущений картины
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Энергия</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ff5e62', fontFamily: 'Space Grotesk' }}>
                    {movie.sensationVector.energy}/10
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Интеллект</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#bf5af2', fontFamily: 'Space Grotesk' }}>
                    {movie.sensationVector.intellect}/10
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Эмоции</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ff9966', fontFamily: 'Space Grotesk' }}>
                    {movie.sensationVector.emotion}/10
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Мрак</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#64d2ff', fontFamily: 'Space Grotesk' }}>
                    {movie.sensationVector.darkness}/10
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Драйв</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ffd60a', fontFamily: 'Space Grotesk' }}>
                    {movie.sensationVector.dynamism}/10
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
