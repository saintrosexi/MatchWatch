import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import DetailedMovieModal from "./DetailedMovieModal";
import TasteProfile from "./TasteProfile";

export default function LikedGrid({ liked }) {
  const [selectedMovie, setSelectedMovie] = useState(null);

  return (
    <>
      <div className="liked-grid-wrapper">
        <TasteProfile likedMovies={liked} />

        <div className="liked-section">
          <h2 className="page-title">❤️ Ваши любимые фильмы</h2>
          <div className="grid">
            {liked.length === 0 ? (
              <div className="empty-message">
                Вы ещё не добавили фильмы в избранное. Начните свайпить! 🎬
              </div>
            ) : (
              liked.map(m => (
                <div 
                  key={m.id} 
                  className="grid-item"
                  onClick={() => setSelectedMovie(m)}
                  style={{ cursor: "pointer" }}
                >
                  <img src={m.poster} alt={m.title} />
                  <div className="movie-title">{m.titleRu || m.title}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedMovie && (
          <DetailedMovieModal 
            movie={selectedMovie} 
            onClose={() => setSelectedMovie(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
