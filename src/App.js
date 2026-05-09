import { useMemo, useState, useEffect } from "react";
import { movies } from "./data";
import { auth, database } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, set, onValue } from "firebase/database";
import SwipeCard from "./components/SwipeCard";
import LikedGrid from "./components/LikedGrid";
import TopMovies from "./components/TopMovies";
import SearchMovies from "./components/SearchMovies";
import MoodPicker from "./components/MoodPicker";
import MatchWatch from "./components/MatchWatch";
import FinalScreen from "./components/FinalScreen";
import Header from "./components/Header";
import Profile from "./components/Profile";
import "./styles.css";

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function App() {
  const [deck, setDeck] = useState(() => shuffle(movies));
  const [cursor, setCursor] = useState(0);
  const [decisions, setDecisions] = useState(() => ({})); // { [movieId]: 'like' | 'dislike' }
  const [history, setHistory] = useState(() => []); // swiped movie ids in order
  const [screen, setScreen] = useState("swipe");
  const [swipeHint, setSwipeHint] = useState({ x: 0, active: false });
  const [user, setUser] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!auth) {
      setDataLoaded(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = ref(database, `users/${currentUser.uid}/appData`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data && !dataLoaded) {
            if (data.decisions) setDecisions(data.decisions);
            if (data.history) setHistory(data.history);
          }
          setDataLoaded(true);
        }, { onlyOnce: true });
      } else {
        setDataLoaded(true);
      }
    });
    return () => unsubscribe();
  }, [dataLoaded]);

  useEffect(() => {
    if (user && dataLoaded && database) {
      set(ref(database, `users/${user.uid}/appData`), {
        decisions,
        history
      });
    }
  }, [decisions, history, user, dataLoaded]);

  const liked = useMemo(
    () => deck.filter(m => decisions[m.id] === "like"),
    [deck, decisions]
  );

  const isDecided = (movie) => Boolean(decisions[movie.id]);

  const nextUndecidedFrom = (startIndex) => {
    for (let i = startIndex; i < deck.length; i++) {
      if (!isDecided(deck[i])) return i;
    }
    return deck.length;
  };

  const handleSwipe = (dir, movie) => {
    const decision = dir === "right" ? "like" : "dislike";

    setDecisions(prev => ({ ...prev, [movie.id]: decision }));
    setHistory(prev => [...prev, movie.id]);

    const next = nextUndecidedFrom(cursor + 1);
    if (next >= deck.length) {
      setScreen("final");
    }
    setCursor(next);
  };

  const handleReset = () => {
    setDeck(shuffle(movies));
    setDecisions({});
    setHistory([]);
    setCursor(0);
    setScreen("swipe");
  };

  const handleUndo = () => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const lastId = prev[prev.length - 1];

      setDecisions(d => {
        const next = { ...d };
        delete next[lastId];
        return next;
      });

      const idx = deck.findIndex(m => m.id === lastId);
      setCursor(idx >= 0 ? idx : 0);
      setSwipeHint({ x: 0, active: false });
      setScreen("swipe");

      return prev.slice(0, -1);
    });
  };

  const handleTabClick = (tab) => {
    if (tab === "swipe") {
      setScreen("swipe");
      setCursor(nextUndecidedFrom(0));
    } else {
      setScreen(tab);
    }
  };

  const currentScreen = (() => {
    if (screen === "final") {
      return <FinalScreen onOpenLiked={() => setScreen("liked")} />;
    }
    if (screen === "liked") {
      return <LikedGrid liked={liked} />;
    }
    if (screen === "top") {
      return <TopMovies />;
    }
    if (screen === "search") {
      return <SearchMovies />;
    }
    if (screen === "mood") {
      return <MoodPicker />;
    }
    if (screen === "matchwatch") {
      return <MatchWatch onLike={(movieId) => setDecisions(prev => ({ ...prev, [movieId]: "like" }))} />;
    }
    if (screen === "profile") {
      return <Profile />;
    }
    return (
      <div className="screen screen--center">
        <div className="swipe-wrapper">
          <div className="swipe-top-actions">
            <button
              className="btn-swipe-action btn-swipe-action--secondary"
              onClick={handleReset}
              title="Перевыбрать любимые"
            >
              Перевыбрать любимые
            </button>
            <button
              className="btn-swipe-action btn-swipe-action--primary"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Назад к предыдущей карточке"
            >
              Назад к предыдущей карточке
            </button>
          </div>

          <div className="swipe-hints" aria-hidden="true">
            <div
              className="swipe-hint-icon swipe-hint-icon--dislike"
              style={{
                opacity: swipeHint.active ? Math.min(1, Math.max(0, -swipeHint.x / 120)) : 0,
                transform: `translateY(-50%) scale(${0.95 + Math.min(0.15, Math.max(0, -swipeHint.x / 600))})`
              }}
            >
              ✕
            </div>
            <div
              className="swipe-hint-icon swipe-hint-icon--like"
              style={{
                opacity: swipeHint.active ? Math.min(1, Math.max(0, swipeHint.x / 120)) : 0,
                transform: `translateY(-50%) scale(${0.95 + Math.min(0.15, Math.max(0, swipeHint.x / 600))})`
              }}
            >
              ❤️
            </div>
          </div>

          <div className="deck-container">
            {[cursor + 2, cursor + 1, cursor].map((cardIndex, position) => (
              cardIndex < deck.length && !isDecided(deck[cardIndex]) && (
                <div
                  key={cardIndex}
                  className={`deck-card deck-position-${2 - position}`}
                  style={{
                    zIndex: deck.length - cardIndex,
                  }}
                >
                  {cardIndex === cursor ? (
                    <SwipeCard
                      movie={deck[cardIndex]}
                      onSwipe={(dir, movie) => {
                        setSwipeHint({ x: 0, active: false });
                        handleSwipe(dir, movie);
                      }}
                      onDragProgress={(x, active) => setSwipeHint({ x, active })}
                    />
                  ) : (
                    <div className="card-placeholder">
                      <img src={deck[cardIndex].poster} alt={deck[cardIndex].title} />
                      <div className="placeholder-overlay" />
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div className="app">
      <Header currentScreen={screen} onTabClick={handleTabClick} likedCount={liked.length} />
      <div className="app-container">
        {currentScreen}
      </div>
    </div>
  );
}
