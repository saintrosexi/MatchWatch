import { useMemo, useState, useEffect } from "react";
import { movies } from "./data";
import { auth, database } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, set, onValue, remove } from "firebase/database";
import SwipeCard from "./components/SwipeCard";
import LikedGrid from "./components/LikedGrid";
import TopMovies from "./components/TopMovies";
import SearchMovies from "./components/SearchMovies";
import MoodPicker from "./components/MoodPicker";
import MatchWatch from "./components/MatchWatch";
import FinalScreen from "./components/FinalScreen";
import Header from "./components/Header";
import Profile from "./components/Profile";
import Friends from "./components/Friends";
import PublicProfile from "./components/PublicProfile";
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
  const [stopGenres, setStopGenres] = useState([]);
  const [invites, setInvites] = useState({});
  const [friendRequests, setFriendRequests] = useState({});

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
        
        onValue(ref(database, `users/${currentUser.uid}/profile/stopGenres`), (snap) => {
          setStopGenres(snap.val() || []);
        });
        
        onValue(ref(database, `users/${currentUser.uid}/invites`), (snap) => {
          setInvites(snap.val() || {});
        });
        
        onValue(ref(database, `users/${currentUser.uid}/friendRequests`), (snap) => {
          setFriendRequests(snap.val() || {});
        });
      } else {
        setDataLoaded(true);
      }
    });
    return () => unsubscribe();
  }, [dataLoaded]);

  const [publicProfileTag, setPublicProfileTag] = useState(null);
  const [initialRoomCode, setInitialRoomCode] = useState(null);
  const [hostRoomCode, setHostRoomCode] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const addTag = urlParams.get('add');
    if (addTag) {
      setPublicProfileTag(addTag);
      setScreen("publicProfile");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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

  const filteredDeck = useMemo(() => {
    if (stopGenres.length === 0) return deck;
    return deck.filter(m => {
      if (!m.genres) return true;
      return !stopGenres.some(g => m.genres.includes(g));
    });
  }, [deck, stopGenres]);

  const isDecided = (movie) => Boolean(decisions[movie.id]);

  const nextUndecidedFrom = (startIndex) => {
    for (let i = startIndex; i < filteredDeck.length; i++) {
      if (!isDecided(filteredDeck[i])) return i;
    }
    return filteredDeck.length;
  };

  const handleSwipe = (dir, movie) => {
    const decision = dir === "right" ? "like" : "dislike";

    setDecisions(prev => ({ ...prev, [movie.id]: decision }));
    setHistory(prev => [...prev, movie.id]);

    const next = nextUndecidedFrom(cursor + 1);
    if (next >= filteredDeck.length) {
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

  const handleWatchNew = () => {
    setDecisions(prev => {
      const next = {};
      Object.entries(prev).forEach(([id, decision]) => {
        if (decision === "like") next[id] = "like";
      });
      return next;
    });
    setHistory(prev => prev.filter(id => decisions[id] === "like"));
    setDeck(shuffle(movies));
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

      const idx = filteredDeck.findIndex(m => m.id === lastId);
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
      return <FinalScreen onOpenLiked={() => setScreen("liked")} onWatchNew={handleWatchNew} />;
    }
    if (screen === "liked") {
      return <LikedGrid liked={liked} />;
    }
    if (screen === "top") {
      return <TopMovies stopGenres={stopGenres} />;
    }
    if (screen === "search") {
      return <SearchMovies stopGenres={stopGenres} />;
    }
    if (screen === "mood") {
      return <MoodPicker stopGenres={stopGenres} />;
    }
    if (screen === "matchwatch") {
      return <MatchWatch 
        onLike={(movieId) => setDecisions(prev => ({ ...prev, [movieId]: "like" }))} 
        initialRoomCode={initialRoomCode}
        onClearInitialRoomCode={() => setInitialRoomCode(null)}
        hostRoomCode={hostRoomCode}
        onClearHostRoomCode={() => setHostRoomCode(null)}
        invites={invites}
      />;
    }
    if (screen === "profile") {
      return <Profile />;
    }
    if (screen === "friends") {
      return <Friends onViewProfile={(tag) => {
        setPublicProfileTag(tag);
        setScreen("publicProfile");
      }} />;
    }
    if (screen === "publicProfile") {
      return <PublicProfile 
        tag={publicProfileTag} 
        onBackToApp={() => setScreen("swipe")} 
        onGoToMatchWatch={(roomCode) => {
          setHostRoomCode(roomCode);
          setScreen("matchwatch");
        }}
      />;
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
              cardIndex < filteredDeck.length && !isDecided(filteredDeck[cardIndex]) && (
                <div
                  key={cardIndex}
                  className={`deck-card deck-position-${2 - position}`}
                  style={{
                    zIndex: filteredDeck.length - cardIndex,
                  }}
                >
                  {cardIndex === cursor ? (
                    <SwipeCard
                      movie={filteredDeck[cardIndex]}
                      onSwipe={(dir, movie) => {
                        setSwipeHint({ x: 0, active: false });
                        handleSwipe(dir, movie);
                      }}
                      onDragProgress={(x, active) => setSwipeHint({ x, active })}
                    />
                  ) : (
                    <div className="card-placeholder">
                      <img src={filteredDeck[cardIndex].poster} alt={filteredDeck[cardIndex].title} />
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
      <Header 
        currentScreen={screen} 
        onTabClick={handleTabClick} 
        likedCount={liked.length} 
        friendRequestsCount={Object.keys(friendRequests).length}
        invitesCount={Object.keys(invites).length}
      />
      
      <div className="app-container">
        {currentScreen}
        
        {Object.keys(invites).length > 0 && (
          <div className="global-invites-overlay">
            {Object.entries(invites).map(([code, info]) => (
              <div key={code} className="invite-toast">
                <div>
                  <strong>👤 {info.from}</strong> зовет вас выбрать фильм!
                </div>
                <div className="invite-actions">
                  <button className="btn-accept" onClick={() => handleAcceptInvite(code)}>Присоединиться</button>
                  <button className="btn-reject" onClick={() => handleRejectInvite(code)}>Скрыть</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
