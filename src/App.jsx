import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DynamicIsland } from './components/hud/DynamicIsland.jsx';
import { FloatingDock } from './components/hud/FloatingDock.jsx';
import { FeedView } from './components/views/FeedView.jsx';
import { DiscoveryView } from './components/views/DiscoveryView.jsx';
import { RoomsView } from './components/views/RoomsView.jsx';
import { CineVaultView } from './components/views/CineVaultView.jsx';
import { StarHubView } from './components/views/StarHubView.jsx';
import { ProfileView } from './components/views/ProfileView.jsx';
import { SettingsView } from './components/views/SettingsView.jsx';

import { MovieDetailsSheet } from './components/modals/MovieDetailsSheet.jsx';
import { FilterMatrixModal } from './components/modals/FilterMatrixModal.jsx';
import { MatchCelebrationModal } from './components/modals/MatchCelebrationModal.jsx';
import { FortuneWheelModal } from './components/modals/FortuneWheelModal.jsx';
import { OnboardingStoryModal } from './components/modals/OnboardingStoryModal.jsx';
import { AICinemaPromptModal } from './components/common/AICinemaPromptModal.jsx';

import { DesktopLayout } from './components/desktop/DesktopLayout.jsx';

import { getRecommendedDeck } from './engine/recommendationEngine.js';
import { subscribeToRoom, recordRoomSwipe, joinRoom } from './engine/realtimeRooms.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useTelegramAuth } from './hooks/useTelegramAuth.js';
import { useDynamicIsland } from './hooks/useDynamicIsland.js';
import { useResponsiveViewport } from './hooks/useResponsiveViewport.js';
import { playSound, getSoundEnabled } from './engine/soundEngine.js';
import { triggerHaptic } from './engine/hapticsEngine.js';

export function App() {
  // Responsive Viewport Hook (Auto >= 1024px or manual override)
  const { isDesktop } = useResponsiveViewport();

  // Navigation State
  const [activeTab, setActiveTab] = useState('feed');
  const [selectedActorForHub, setSelectedActorForHub] = useState(null);

  // User & Identity
  const { user } = useTelegramAuth();

  // Persistent User Data (Strictly protected against loss)
  const [likedIds, setLikedIds] = useLocalStorage('mw_liked_ids', []);
  const [superlikeIds, setSuperlikeIds] = useLocalStorage('mw_superlike_ids', []);
  const [dislikedIds, setDislikedIds] = useLocalStorage('mw_disliked_ids', []);
  const [watchedIds, setWatchedIds] = useLocalStorage('mw_watched_ids', []);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage('mw_onboarding_done', false);

  // Safe Array Wrappers
  const safeLikedIds = Array.isArray(likedIds) ? likedIds : [];
  const safeDislikedIds = Array.isArray(dislikedIds) ? dislikedIds : [];
  const safeSuperlikeIds = Array.isArray(superlikeIds) ? superlikeIds : [];
  const safeWatchedIds = Array.isArray(watchedIds) ? watchedIds : [];

  // Audio & HUD
  const [soundOn, setSoundOn] = useState(() => getSoundEnabled());
  const { islandState, showIslandAlert, setRoomStatus } = useDynamicIsland();

  // Room Subscription State & Acknowledged Matches Tracking
  const [activeRoom, setActiveRoom] = useState(null);
  const seenMatchIdsRef = useRef(new Set());

  useEffect(() => {
    const unsubscribe = subscribeToRoom((room) => {
      setActiveRoom(room);
      if (room) {
        setRoomStatus(room.code, room.members?.length || 1);

        // Reactive match celebration across all connected tabs and clients
        if (room.matches && Array.isArray(room.matches)) {
          room.matches.forEach((m) => {
            const mId = m.movieId || m.movie?.id;
            if (mId && !seenMatchIdsRef.current.has(mId)) {
              seenMatchIdsRef.current.add(mId);
              setActiveMatchCelebration(m);
              playSound('match_celebration');
              triggerHaptic('success');
            }
          });
        }
      } else {
        seenMatchIdsRef.current.clear();
      }
    });
    return unsubscribe;
  }, [setRoomStatus]);

  // Deep-link room auto-join from URL search parameter (?room=ABCD) or Telegram start_param
  useEffect(() => {
    try {
      let targetRoomCode = null;

      // 1. Check URL search parameters (?room=ABCD or ?roomCode=ABCD)
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        targetRoomCode = params.get('room') || params.get('roomCode') || params.get('join');
      }

      // 2. Check Telegram WebApp start_param
      if (!targetRoomCode && typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const startParam = window.Telegram.WebApp.initDataUnsafe?.start_param;
        if (startParam) {
          if (startParam.startsWith('room_')) {
            targetRoomCode = startParam.replace('room_', '');
          } else if (startParam.length === 4) {
            targetRoomCode = startParam;
          }
        }
      }

      if (targetRoomCode) {
        const cleanCode = targetRoomCode.trim().toUpperCase();
        if (cleanCode.length === 4) {
          joinRoom({ roomCode: cleanCode, user }).then((room) => {
            if (room) {
              setActiveTab('rooms');
              showIslandAlert(`Комната ${cleanCode}`, 'Вы подключились к комнате!', '👥');
            }
          }).catch((err) => {
            console.warn('Auto-join room error:', err);
          });
        }
      }
    } catch (e) {
      console.warn('Deep link auto-join parsing error:', e);
    }
  }, [user, showIslandAlert]);

  // Deck & Filter State
  const [selectedMood, setSelectedMood] = useState(null);
  const [currentFilters, setCurrentFilters] = useState({});
  const [swipeHistory, setSwipeHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeAiPrompt, setActiveAiPrompt] = useState(null);

  // Deck Generation with Mood and Custom Filters
  const buildFilteredDeck = useCallback((mood = selectedMood, filters = currentFilters) => {
    return getRecommendedDeck({
      likedIds: safeLikedIds,
      dislikedIds: safeDislikedIds,
      mood,
      filters,
      limit: 60
    });
  }, [safeLikedIds, safeDislikedIds, selectedMood, currentFilters]);

  const [deck, setDeck] = useState(() => buildFilteredDeck());

  // Re-generate Deck when mood or filters change
  const refreshDeck = useCallback((newMood = selectedMood, newFilters = currentFilters, customPool = null) => {
    if (customPool) {
      setDeck(customPool);
      setCurrentIndex(0);
      setSwipeHistory([]);
      return;
    }

    setActiveAiPrompt(null);
    const newDeck = buildFilteredDeck(newMood, newFilters);
    setDeck(newDeck);
    setCurrentIndex(0);
    setSwipeHistory([]);
  }, [buildFilteredDeck, selectedMood, currentFilters]);

  // Modals Management (Mobile & Desktop)
  const [selectedMovieForDetails, setSelectedMovieForDetails] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeMatchCelebration, setActiveMatchCelebration] = useState(null);
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Handle Swiping Action
  const handleSwipe = (direction, movie) => {
    if (!movie) return;

    // Record in history for Undo
    setSwipeHistory((prev) => [...prev, { direction, movie, index: currentIndex }]);

    if (direction === 'like') {
      if (!safeLikedIds.includes(movie.id)) {
        setLikedIds((prev) => [...prev, movie.id]);
      }
      // Check in realtime room
      if (activeRoom) {
        const matchResult = recordRoomSwipe({ movieId: movie.id, liked: true, userId: user.id });
        if (matchResult) {
          const mId = matchResult.movieId || matchResult.movie?.id;
          if (mId) seenMatchIdsRef.current.add(mId);
          setActiveMatchCelebration(matchResult);
        }
      }
    } else if (direction === 'superlike') {
      if (!safeLikedIds.includes(movie.id)) {
        setLikedIds((prev) => [...prev, movie.id]);
      }
      if (!safeSuperlikeIds.includes(movie.id)) {
        setSuperlikeIds((prev) => [...prev, movie.id]);
      }
      showIslandAlert('В избранном ★', movie.titleRu || movie.title, '★');
      if (activeRoom) {
        const matchResult = recordRoomSwipe({ movieId: movie.id, liked: true, userId: user.id });
        if (matchResult) {
          const mId = matchResult.movieId || matchResult.movie?.id;
          if (mId) seenMatchIdsRef.current.add(mId);
          setActiveMatchCelebration(matchResult);
        }
      }
    } else if (direction === 'pass') {
      if (!safeDislikedIds.includes(movie.id)) {
        setDislikedIds((prev) => [...prev, movie.id]);
      }
      if (activeRoom) {
        recordRoomSwipe({ movieId: movie.id, liked: false, userId: user.id });
      }
    }

    setCurrentIndex((prev) => prev + 1);

    // Replenish cards if running low (ONLY for standard feed, NEVER for custom AI deck)
    if (!activeAiPrompt && currentIndex >= deck.length - 6) {
      const additional = getRecommendedDeck({
        likedIds: [...safeLikedIds, ...(direction === 'like' ? [movie.id] : [])],
        dislikedIds: [...safeDislikedIds, ...(direction === 'pass' ? [movie.id] : [])],
        mood: selectedMood,
        filters: currentFilters,
        limit: 30
      });
      setDeck((prev) => [...prev, ...additional]);
    }
  };

  // Handle Kinetic Undo
  const handleUndo = () => {
    if (swipeHistory.length === 0 || currentIndex === 0) return;

    const lastAction = swipeHistory[swipeHistory.length - 1];
    const { direction, movie } = lastAction;

    if (direction === 'like' || direction === 'superlike') {
      setLikedIds((prev) => prev.filter((id) => id !== movie.id));
      if (direction === 'superlike') {
        setSuperlikeIds((prev) => prev.filter((id) => id !== movie.id));
      }
    } else if (direction === 'pass') {
      setDislikedIds((prev) => prev.filter((id) => id !== movie.id));
    }

    setSwipeHistory((prev) => prev.slice(0, -1));
    setCurrentIndex((prev) => Math.max(0, prev - 1));

    triggerHaptic('medium');
    playSound('pop');
    showIslandAlert('Отмена действия', movie.titleRu || movie.title, '↩️');
  };

  // Launch Curated Collection as a Swipe Deck
  const handleLaunchCollectionDeck = (collection) => {
    if (!collection) return;
    setActiveAiPrompt(null);
    refreshDeck(null, {}, collection.movies);
    setActiveTab('feed');
    showIslandAlert('Подборка загружена', collection.title, '🎬');
  };

  // Launch Actor Filmography Deck
  const handleLaunchActorDeck = (actorName) => {
    if (!actorName) return;
    setActiveAiPrompt(null);
    const actorDeck = getRecommendedDeck({
      actorName,
      likedIds: safeLikedIds,
      dislikedIds: [],
      filters: { includeSeen: true },
      limit: 30
    });
    refreshDeck(null, {}, actorDeck);
    setActiveTab('feed');
    showIslandAlert('Фильмы актёра', actorName, '🌟');
  };

  // Launch CineVault Saved Movies Deck
  const handleLaunchVaultDeck = (savedMovies) => {
    if (!savedMovies || savedMovies.length === 0) return;
    setActiveAiPrompt(null);
    refreshDeck(null, {}, savedMovies);
    setActiveTab('feed');
    showIslandAlert('Фильмотека', `Загружено ${savedMovies.length} фильмов`, '📁');
  };

  // Launch Gemini AI Concierge Smart Deck
  const handleLaunchAIDeck = (aiDeck, aiSummary, prompt) => {
    if (!aiDeck || aiDeck.length === 0) return;
    setActiveAiPrompt(prompt || 'AI подборка');
    refreshDeck(null, {}, aiDeck);
    setActiveTab('feed');
    showIslandAlert('✨ AI-колода готова', aiSummary || `${aiDeck.length} фильмов от MatchWatch AI`, '✨');
  };

  // Start Room Swiping Session
  const handleStartRoomSwipe = (room) => {
    if (!room || !room.deck) return;
    setDeck(room.deck);
    setCurrentIndex(0);
    setSwipeHistory([]);
    setActiveTab('feed');
    showIslandAlert(`Комната ${room.code}`, `Свайпают: ${room.members?.length || 2} чел.`, '🍿');
  };

  // Reset Dislikes only
  const handleResetDislikesOnly = () => {
    setDislikedIds([]);
    refreshDeck(selectedMood, currentFilters);
    showIslandAlert('История сброшена', 'Пропущенные фильмы снова в ленте', '🧹');
  };

  // Reset All User Data
  const handleResetAllData = () => {
    setLikedIds([]);
    setSuperlikeIds([]);
    setDislikedIds([]);
    setWatchedIds([]);
    setHasCompletedOnboarding(false);
    refreshDeck(null, {});
    showIslandAlert('Память очищена', 'Все оценки и история сброшены', '🗑️');
  };

  // =========================================================================
  // 1. DESKTOP STUDIO RENDERING (>= 1024px)
  // =========================================================================
  if (isDesktop) {
    return (
      <DesktopLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        deck={deck}
        currentIndex={currentIndex}
        onSwipe={handleSwipe}
        onUndo={handleUndo}
        canUndo={swipeHistory.length > 0 && currentIndex > 0}
        onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
        onResetDeck={() => refreshDeck(selectedMood, currentFilters)}
        selectedMood={selectedMood}
        onSelectMood={(mood) => {
          setSelectedMood(mood);
          refreshDeck(mood, currentFilters);
        }}
        likedIds={safeLikedIds}
        superlikeIds={safeSuperlikeIds}
        watchedIds={safeWatchedIds}
        dislikedIds={safeDislikedIds}
        user={user}
        activeRoom={activeRoom}
        soundOn={soundOn}
        setSoundOn={setSoundOn}
        onResetDislikesOnly={handleResetDislikesOnly}
        onResetAllData={handleResetAllData}
        onRemoveLike={(id) => {
          setLikedIds((prev) => prev.filter((item) => item !== id));
          setSuperlikeIds((prev) => prev.filter((item) => item !== id));
        }}
        onLaunchCollectionDeck={handleLaunchCollectionDeck}
        onLaunchActorDeck={handleLaunchActorDeck}
        onLaunchVaultDeck={handleLaunchVaultDeck}
        onLaunchAIDeck={handleLaunchAIDeck}
        onStartRoomSwipe={handleStartRoomSwipe}
        currentFilters={currentFilters}
        onApplyFilters={(filters) => {
          setCurrentFilters(filters);
          refreshDeck(selectedMood, filters);
        }}
        activeMatchCelebration={activeMatchCelebration}
        onCloseMatchCelebration={() => setActiveMatchCelebration(null)}
        isAiDeck={Boolean(activeAiPrompt)}
        activeAiPrompt={activeAiPrompt}
      />
    );
  }

  // =========================================================================
  // 2. MOBILE APP SHELL RENDERING (< 1024px or Telegram WebApp Mobile)
  // =========================================================================
  return (
    <div className="mobile-app-shell">
      {/* Dynamic Island HUD (Context-aware: filters & roulette only on Feed) */}
      <DynamicIsland
        islandState={islandState}
        soundOn={soundOn}
        setSoundOn={setSoundOn}
        activeRoom={activeRoom}
        currentTab={activeTab}
        onOpenFilters={() => setIsFilterModalOpen(true)}
        onOpenRoulette={() => setIsRouletteOpen(true)}
      />

      {/* Main Screen Router */}
      <main style={{ flex: 1, width: '100%', marginTop: '4px' }}>
        {isSettingsOpen ? (
          <SettingsView
            soundOn={soundOn}
            setSoundOn={setSoundOn}
            onResetDislikesOnly={handleResetDislikesOnly}
            onResetAllData={handleResetAllData}
            onClose={() => setIsSettingsOpen(false)}
            allLikesData={{ likedIds: safeLikedIds, superlikeIds: safeSuperlikeIds, watchedIds: safeWatchedIds, dislikedIds: safeDislikedIds }}
          />
        ) : activeTab === 'feed' ? (
          <FeedView
            deck={deck}
            currentIndex={currentIndex}
            onSwipe={handleSwipe}
            onUndo={handleUndo}
            canUndo={swipeHistory.length > 0 && currentIndex > 0}
            onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
            onResetDeck={() => refreshDeck(selectedMood, currentFilters)}
            selectedMood={selectedMood}
            onSelectMood={(mood) => {
              setSelectedMood(mood);
              refreshDeck(mood, currentFilters);
            }}
            onOpenAIPrompt={() => setIsAIPromptOpen(true)}
            isAiDeck={Boolean(activeAiPrompt)}
            activeAiPrompt={activeAiPrompt}
          />
        ) : activeTab === 'discovery' ? (
          <DiscoveryView
            onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
            onLaunchCollectionDeck={handleLaunchCollectionDeck}
          />
        ) : activeTab === 'rooms' ? (
          <RoomsView
            user={user}
            activeRoom={activeRoom}
            onStartRoomSwipe={handleStartRoomSwipe}
            onOpenRoulette={() => setIsRouletteOpen(true)}
            onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
          />
        ) : activeTab === 'vault' ? (
          <CineVaultView
            likedIds={safeLikedIds}
            superlikeIds={safeSuperlikeIds}
            watchedIds={safeWatchedIds}
            onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
            onRemoveLike={(id) => {
              setLikedIds((prev) => prev.filter((item) => item !== id));
              setSuperlikeIds((prev) => prev.filter((item) => item !== id));
            }}
            onLaunchVaultDeck={handleLaunchVaultDeck}
          />
        ) : activeTab === 'actors' ? (
          <StarHubView
            selectedActorName={selectedActorForHub}
            onSelectActor={(actorName) => setSelectedActorForHub(actorName)}
            onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
            onLaunchActorDeck={handleLaunchActorDeck}
          />
        ) : activeTab === 'profile' ? (
          <ProfileView
            user={user}
            likedIds={safeLikedIds}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSharePassport={(dna) => {
              showIslandAlert('Кино-паспорт скопирован', `${dna.archetype.name} (Ур. ${dna.level})`, '🧬');
            }}
          />
        ) : null}
      </main>

      {/* Floating Dynamic Dock Navigation */}
      <FloatingDock
        activeTab={isSettingsOpen ? '' : activeTab}
        setActiveTab={(tab) => {
          setIsSettingsOpen(false);
          setActiveTab(tab);
        }}
        likesCount={safeLikedIds.length}
      />

      {/* Modals & Sheets (Mobile) */}
      {selectedMovieForDetails && (
        <MovieDetailsSheet
          movie={selectedMovieForDetails}
          isLiked={safeLikedIds.includes(selectedMovieForDetails.id)}
          onClose={() => setSelectedMovieForDetails(null)}
          onLike={(m) => {
            if (!safeLikedIds.includes(m.id)) {
              setLikedIds((prev) => [...prev, m.id]);
            }
          }}
          onSelectActor={(actorName) => {
            setSelectedMovieForDetails(null);
            setSelectedActorForHub(actorName);
            setActiveTab('actors');
          }}
        />
      )}

      {isFilterModalOpen && (
        <FilterMatrixModal
          currentFilters={currentFilters}
          onApplyFilters={(filters) => {
            setCurrentFilters(filters);
            refreshDeck(selectedMood, filters);
          }}
          onClose={() => setIsFilterModalOpen(false)}
        />
      )}

      {activeMatchCelebration && (
        <MatchCelebrationModal
          match={activeMatchCelebration}
          onContinue={() => setActiveMatchCelebration(null)}
          onOpenDetails={(movie) => {
            setActiveMatchCelebration(null);
            setSelectedMovieForDetails(movie);
          }}
          onOpenRoulette={() => {
            setActiveMatchCelebration(null);
            setIsRouletteOpen(true);
          }}
        />
      )}

      {isRouletteOpen && (
        <FortuneWheelModal
          movies={activeRoom?.matches?.map((m) => m.movie) || deck.slice(0, 8)}
          onClose={() => setIsRouletteOpen(false)}
          onSelectMovie={(movie) => {
            setIsRouletteOpen(false);
            setSelectedMovieForDetails(movie);
          }}
        />
      )}

      {isAIPromptOpen && (
        <AICinemaPromptModal
          isOpen={isAIPromptOpen}
          onClose={() => setIsAIPromptOpen(false)}
          onApplyAIDeck={handleLaunchAIDeck}
          likedIds={safeLikedIds}
        />
      )}

      {!hasCompletedOnboarding && (
        <OnboardingStoryModal
          onComplete={() => setHasCompletedOnboarding(true)}
        />
      )}
    </div>
  );
}
