import { motion } from "framer-motion";

export default function FinalScreen({ activeCategory, onChangeCategory, onOpenLiked, onWatchNew }) {
  const getCategoryName = (cat) => {
    switch (cat) {
      case "movie": return "все фильмы";
      case "series": return "все сериалы";
      case "anime": return "все аниме";
      default: return "все карточки";
    }
  };

  const getOtherCategories = () => {
    const all = [
      { id: "movie", label: "Фильмы", icon: "🎬" },
      { id: "series", label: "Сериалы", icon: "📺" },
      { id: "anime", label: "Аниме", icon: "👾" }
    ];
    return all.filter(c => c.id !== activeCategory);
  };

  const otherCategories = getOtherCategories();

  return (
    <div className="final-screen-container">
      <motion.div 
        className="final-screen-content"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="final-icon">🏁</div>
        <h2>Вы просмотрели {getCategoryName(activeCategory)}!</h2>
        <p style={{ marginBottom: "25px", color: "rgba(255, 255, 255, 0.6)" }}>
          Хотите продолжить выбор в других категориях?
        </p>

        {/* 2-Column Grid for other categories */}
        <div className="final-categories-grid">
          {otherCategories.map(cat => (
            <div 
              key={cat.id} 
              className="final-category-card" 
              onClick={() => onChangeCategory(cat.id)}
            >
              <div className="final-category-icon">{cat.icon}</div>
              <div className="final-category-label">{cat.label}</div>
            </div>
          ))}
        </div>

        {/* Secondary Actions */}
        <div className="final-actions" style={{ marginTop: "20px" }}>
          <button className="btn btn-primary btn-large" onClick={onOpenLiked} style={{ width: "100%" }}>
            ❤️ Посмотреть любимые
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={onWatchNew} 
            style={{ width: "100%", marginTop: "10px" }}
          >
            🔄 Начать сначала (Сбросить дизлайки в этой категории)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
