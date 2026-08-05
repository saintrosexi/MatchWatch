/**
 * MatchWatch Deck & Swipe Manager Engine
 * Manages swiping queue, decision stack, history stack, and undo operations.
 */

export class SwipeEngine {
  constructor(initialDeck = []) {
    this.deck = [...initialDeck];
    this.history = []; // Array of movieIds in order of swipe
    this.decisions = {}; // { [movieId]: 'like' | 'dislike' }
    this.currentIndex = 0;
  }

  setDeck(newDeck) {
    this.deck = [...newDeck];
  }

  setDecisions(decisions) {
    this.decisions = { ...decisions };
  }

  setHistory(history) {
    this.history = [...history];
  }

  swipe(movieId, direction) {
    const decision = (direction === 'like' || direction === 'right') ? 'like' : 'dislike';
    this.decisions[movieId] = decision;
    this.history.push(movieId);
    return decision;
  }

  undo() {
    if (this.history.length === 0) return null;
    
    // Pop the last swiped movie ID
    const lastMovieId = this.history.pop();
    delete this.decisions[lastMovieId];

    return lastMovieId;
  }

  canUndo() {
    return this.history.length > 0;
  }

  getDecision(movieId) {
    return this.decisions[movieId] || null;
  }

  getHistory() {
    return [...this.history];
  }

  getDecisions() {
    return { ...this.decisions };
  }
}
