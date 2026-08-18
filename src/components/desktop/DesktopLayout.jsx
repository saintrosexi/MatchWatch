import React, { useState } from 'react';
import { DesktopSidebar } from './DesktopSidebar.jsx';
import { DesktopHeaderHUD } from './DesktopHeaderHUD.jsx';
import { DesktopFeedView } from './DesktopFeedView.jsx';
import { DesktopDiscoveryView } from './DesktopDiscoveryView.jsx';
import { DesktopStarHubView } from './DesktopStarHubView.jsx';
import { DesktopVaultView } from './DesktopVaultView.jsx';
import { DesktopRoomsView } from './DesktopRoomsView.jsx';
import { DesktopProfileView } from './DesktopProfileView.jsx';
import { DesktopMovieDetailsModal } from './DesktopMovieDetailsModal.jsx';
import { DesktopSlotRouletteModal } from './DesktopSlotRouletteModal.jsx';

import { FilterMatrixModal } from '../modals/FilterMatrixModal.jsx';
import { MatchCelebrationModal } from '../modals/MatchCelebrationModal.jsx';
import { AICinemaPromptModal } from '../common/AICinemaPromptModal.jsx';
import { SettingsView } from '../views/SettingsView.jsx';

export function DesktopLayout({
  activeTab,
  setActiveTab,
  deck,
  currentIndex,
  onSwipe,
  onUndo,
  canUndo,
  onResetDeck,
  selectedMood,
  onSelectMood,
  likedIds,
  superlikeIds,
  watchedIds,
  dislikedIds,
  user,
  activeRoom,
  soundOn,
  setSoundOn,
  onResetDislikesOnly,
  onResetAllData,
  onRemoveLike,
  onLaunchCollectionDeck,
  onLaunchActorDeck,
  onLaunchVaultDeck,
  onLaunchAIDeck,
  onStartRoomSwipe,
  currentFilters,
  onApplyFilters,
  activeMatchCelebration,
  onCloseMatchCelebration,
  isAiDeck = false,
  activeAiPrompt = null
}) {
  const [selectedMovieForDetails, setSelectedMovieForDetails] = useState(null);
  const [selectedActorForHub, setSelectedActorForHub] = useState(null);
  const [isSlotRouletteOpen, setIsSlotRouletteOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="desktop-studio-container">
      {/* 1. Left Vertical Sidebar */}
      <DesktopSidebar
        activeTab={isSettingsOpen ? '' : activeTab}
        setActiveTab={(tab) => {
          setIsSettingsOpen(false);
          setActiveTab(tab);
        }}
        likesCount={likedIds.length}
        activeRoom={activeRoom}
        soundOn={soundOn}
        setSoundOn={setSoundOn}
        onOpenSettings={() => setIsSettingsOpen(true)}
        user={user}
      />

      {/* 2. Main Area */}
      <div className="desktop-main-area">
        {/* Top Header HUD */}
        <DesktopHeaderHUD
          activeTab={isSettingsOpen ? 'settings' : activeTab}
          activeRoom={activeRoom}
          onOpenRoulette={() => setIsSlotRouletteOpen(true)}
          onOpenFilters={() => setIsFilterModalOpen(true)}
        />

        {/* Content Body */}
        <div className="desktop-content-body">
          {isSettingsOpen ? (
            <SettingsView
              soundOn={soundOn}
              setSoundOn={setSoundOn}
              onResetDislikesOnly={onResetDislikesOnly}
              onResetAllData={onResetAllData}
              onClose={() => setIsSettingsOpen(false)}
              allLikesData={{ likedIds, superlikeIds, watchedIds, dislikedIds }}
            />
          ) : activeTab === 'feed' ? (
            <DesktopFeedView
              deck={deck}
              currentIndex={currentIndex}
              onSwipe={onSwipe}
              onUndo={onUndo}
              canUndo={canUndo}
              onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
              onResetDeck={onResetDeck}
              selectedMood={selectedMood}
              onSelectMood={onSelectMood}
              onOpenAIPrompt={() => setIsAIPromptOpen(true)}
              isAiDeck={isAiDeck}
              activeAiPrompt={activeAiPrompt}
            />
          ) : activeTab === 'movies' ? (
            <DesktopDiscoveryView
              key="movies"
              onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
              onLaunchCollectionDeck={onLaunchCollectionDeck}
            />
          ) : activeTab === 'actors' ? (
            <DesktopStarHubView
              selectedActorName={selectedActorForHub}
              onSelectActor={(actorName) => setSelectedActorForHub(actorName)}
              onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
              onLaunchActorDeck={onLaunchActorDeck}
            />
          ) : activeTab === 'vault' ? (
            <DesktopVaultView
              likedIds={likedIds}
              superlikeIds={superlikeIds}
              watchedIds={watchedIds}
              onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
              onRemoveLike={onRemoveLike}
              onLaunchVaultDeck={onLaunchVaultDeck}
            />
          ) : activeTab === 'rooms' ? (
            <DesktopRoomsView
              user={user}
              activeRoom={activeRoom}
              onStartRoomSwipe={onStartRoomSwipe}
              onOpenRoulette={() => setIsSlotRouletteOpen(true)}
              onOpenDetails={(movie) => setSelectedMovieForDetails(movie)}
            />
          ) : activeTab === 'profile' ? (
            <DesktopProfileView
              user={user}
              likedIds={likedIds}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onSharePassport={() => {}}
            />
          ) : null}
        </div>
      </div>

      {/* 3. Central Cinema Movie Details Modal */}
      {selectedMovieForDetails && (
        <DesktopMovieDetailsModal
          movie={selectedMovieForDetails}
          isLiked={likedIds.includes(selectedMovieForDetails.id)}
          onClose={() => setSelectedMovieForDetails(null)}
          onLike={(m) => {
            if (!likedIds.includes(m.id)) {
              onSwipe('like', m);
            }
          }}
          onSelectActor={(actorName) => {
            setSelectedMovieForDetails(null);
            setSelectedActorForHub(actorName);
            setActiveTab('actors');
          }}
        />
      )}

      {/* 4. 3-Reel Slot Machine Roulette Modal 🎰 */}
      {isSlotRouletteOpen && (
        <DesktopSlotRouletteModal
          movies={activeRoom?.matches?.map((m) => m.movie) || deck.slice(0, 16)}
          onClose={() => setIsSlotRouletteOpen(false)}
          onSelectMovie={(movie) => {
            setIsSlotRouletteOpen(false);
            setSelectedMovieForDetails(movie);
          }}
        />
      )}

      {/* 5. Filter Matrix Modal */}
      {isFilterModalOpen && (
        <FilterMatrixModal
          currentFilters={currentFilters}
          onApplyFilters={(filters) => {
            onApplyFilters(filters);
            setIsFilterModalOpen(false);
          }}
          onClose={() => setIsFilterModalOpen(false)}
        />
      )}

      {/* 6. Match Celebration Modal */}
      {activeMatchCelebration && (
        <MatchCelebrationModal
          match={activeMatchCelebration}
          onContinue={onCloseMatchCelebration}
          onOpenDetails={(movie) => {
            onCloseMatchCelebration();
            setSelectedMovieForDetails(movie);
          }}
          onOpenRoulette={() => {
            onCloseMatchCelebration();
            setIsSlotRouletteOpen(true);
          }}
        />
      )}

      {/* 7. Gemini AI Cinema Concierge Prompt Modal */}
      {isAIPromptOpen && (
        <AICinemaPromptModal
          isOpen={isAIPromptOpen}
          onClose={() => setIsAIPromptOpen(false)}
          onApplyAIDeck={(aiDeck, aiSummary) => {
            if (onLaunchAIDeck) {
              onLaunchAIDeck(aiDeck, aiSummary);
            }
            setActiveTab('feed');
          }}
          likedIds={likedIds}
        />
      )}
    </div>
  );
}
