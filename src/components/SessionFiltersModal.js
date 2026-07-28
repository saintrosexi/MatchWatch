import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "../styles.css";

const ALL_GENRES = [
  "Драма",
  "Комедия",
  "Боевик",
  "Триллер",
  "Мелодрама",
  "Фантастика",
  "Приключения",
  "Криминал",
  "Ужасы",
  "Детектив",
  "Семейный",
  "Фэнтези"
];

const DECADES = [
  { label: "Все годы", value: "all" },
  { label: "2020-2026 (Новинки)", value: "2020-2026" },
  { label: "2010-2019", value: "2010-2019" },
  { label: "2000-2009", value: "2000-2009" },
  { label: "До 2000г", value: "vintage" }
];

export default function SessionFiltersModal({ isOpen, onClose, onApply, initialFilters }) {
  const [selectedGenres, setSelectedGenres] = useState(initialFilters?.genres || []);
  const [selectedDecade, setSelectedDecade] = useState(initialFilters?.decade || "all");
  const [contentType, setContentType] = useState(initialFilters?.contentType || "movie");
  const [maxDuration, setMaxDuration] = useState(initialFilters?.maxDuration || 0); // 0 = any

  if (!isOpen) return null;

  const toggleGenre = (genre) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleApply = () => {
    onApply({
      genres: selectedGenres,
      decade: selectedDecade,
      contentType: contentType,
      maxDuration: maxDuration
    });
    onClose();
  };

  const handleReset = () => {
    setSelectedGenres([]);
    setSelectedDecade("all");
    setContentType("movie");
    setMaxDuration(0);
  };

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose}>
        <motion.div
          className="filters-modal-card"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="filters-header">
            <h3>⚙️ Пре-фильтры сессии свайпов</h3>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="filters-body">
            {/* Content Type */}
            <div className="filter-section">
              <label className="filter-label">Тип контента</label>
              <div className="filter-chips">
                <button
                  className={`chip ${contentType === "all" ? "active" : ""}`}
                  onClick={() => setContentType("all")}
                >
                  Все
                </button>
                <button
                  className={`chip ${contentType === "movie" ? "active" : ""}`}
                  onClick={() => setContentType("movie")}
                >
                  🎬 Фильмы
                </button>
                <button
                  className={`chip ${contentType === "series" ? "active" : ""}`}
                  onClick={() => setContentType("series")}
                >
                  📺 Сериалы
                </button>
                <button
                  className={`chip ${contentType === "anime" ? "active" : ""}`}
                  onClick={() => setContentType("anime")}
                >
                  ⛩️ Аниме
                </button>
              </div>
            </div>

            {/* Genres */}
            <div className="filter-section">
              <label className="filter-label">Жанры {selectedGenres.length > 0 ? `(${selectedGenres.length})` : "(Все)"}</label>
              <div className="filter-chips wrap">
                {ALL_GENRES.map((g) => (
                  <button
                    key={g}
                    className={`chip ${selectedGenres.includes(g) ? "active" : ""}`}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Decade / Year range */}
            <div className="filter-section">
              <label className="filter-label">Период выхода</label>
              <div className="filter-chips wrap">
                {DECADES.map((d) => (
                  <button
                    key={d.value}
                    className={`chip ${selectedDecade === d.value ? "active" : ""}`}
                    onClick={() => setSelectedDecade(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Duration */}
            <div className="filter-section">
              <label className="filter-label">Хронометраж</label>
              <div className="filter-chips">
                <button
                  className={`chip ${maxDuration === 0 ? "active" : ""}`}
                  onClick={() => setMaxDuration(0)}
                >
                  Любой
                </button>
                <button
                  className={`chip ${maxDuration === 90 ? "active" : ""}`}
                  onClick={() => setMaxDuration(90)}
                >
                  ⚡ До 90 мин
                </button>
                <button
                  className={`chip ${maxDuration === 120 ? "active" : ""}`}
                  onClick={() => setMaxDuration(120)}
                >
                  🍿 До 2 часов
                </button>
              </div>
            </div>
          </div>

          <div className="filters-footer">
            <button className="reset-btn" onClick={handleReset}>
              Сбросить
            </button>
            <button className="apply-btn" onClick={handleApply}>
              Применить и продолжить 🚀
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
