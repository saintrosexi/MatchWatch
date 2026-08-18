import React, { useEffect } from 'react';
import { SwipeCard } from './SwipeCard.jsx';
import { ActionControls } from './ActionControls.jsx';
import { useSwipePhysics } from '../../hooks/useSwipePhysics.js';
import { prefetchPosters } from '../../engine/imagePrefetcher.js';
import { ChamaGuide } from '../common/ChamaGuide.jsx';
import { RotateCcw, Sparkles } from 'lucide-react';

export function SwipeDeck({
  movies = [],
  currentIndex = 0,
  onSwipe,
  onUndo,
  canUndo = false,
  onOpenDetails,
  onResetDeck,
  isAiDeck = false,
  activeAiPrompt = null,
  onOpenAiModal
}) {
  const currentMovie = movies[currentIndex];
  const nextMovies = movies.slice(currentIndex + 1, currentIndex + 3);

  // Proactive prefetching for next 5 cards
  useEffect(() => {
    if (movies.length > currentIndex) {
      prefetchPosters(movies.slice(currentIndex, currentIndex + 5), 5);
    }
  }, [movies, currentIndex]);

  const handleSwipeLeft = () => onSwipe('pass', currentMovie);
  const handleSwipeRight = () => onSwipe('like', currentMovie);
  const handleSwipeUp = () => onSwipe('superlike', currentMovie);
  const handleSwipeDown = () => {
    if (onOpenDetails && currentMovie) {
      onOpenDetails(currentMovie);
    }
  };

  const { dragState, triggerLike, triggerPass, triggerSuperlike, bind } = useSwipePhysics({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    onSwipeUp: handleSwipeUp,
    onSwipeDown: handleSwipeDown,
    onUndo,
    disabled: !currentMovie
  });

  if (!currentMovie) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '440px',
        padding: '20px',
        width: '100%'
      }}>
        <ChamaGuide
          state="empty"
          text={
            isAiDeck && activeAiPrompt
              ? `Колода окончена! Вы просмотрели все ${movies.length} фильмов по запросу «${activeAiPrompt}». Давайте придумаем, что ещё посмотреть!`
              : "Колода закончилась! Все подходящие фильмы были просмотрены."
          }
          actionButton={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '280px', marginTop: '12px' }}>
              {isAiDeck && onOpenAiModal && (
                <button
                  onClick={onOpenAiModal}
                  className="btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #FF5E62 0%, #FF9966 100%)',
                    boxShadow: '0 4px 15px rgba(255, 94, 98, 0.4)',
                    justifyContent: 'center'
                  }}
                >
                  <Sparkles size={16} /> Придумать новый AI запрос
                </button>
              )}
              <button
                onClick={onResetDeck}
                className="btn-secondary"
                style={{ justifyContent: 'center' }}
              >
                <RotateCcw size={16} /> {isAiDeck ? 'Вернуться к общей ленте' : 'Начать заново'}
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="card-stack-container">
        {/* Background Cards (Stacked underneath) */}
        {nextMovies.map((movie, idx) => (
          <SwipeCard
            key={movie.id}
            movie={movie}
            stackIndex={idx + 1}
            isTopCard={false}
          />
        ))}

        {/* Top Active Card */}
        <SwipeCard
          key={currentMovie.id}
          movie={currentMovie}
          isTopCard={true}
          stackIndex={0}
          dragState={dragState}
          onOpenDetails={onOpenDetails}
          bind={bind}
        />
      </div>

      {/* 5-Action Tactile Control Bar with Synchronized Kinetic Triggering */}
      <ActionControls
        onUndo={onUndo}
        onPass={triggerPass}
        onSuperlike={triggerSuperlike}
        onLike={triggerLike}
        onInfo={handleSwipeDown}
        canUndo={canUndo}
        disabled={!currentMovie}
      />
    </div>
  );
}
