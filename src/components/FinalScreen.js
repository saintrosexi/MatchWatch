import { motion } from "framer-motion";

export default function FinalScreen({ onOpenLiked, onWatchNew }) {
  return (
    <div className="final-screen-container">
      <motion.div 
        className="final-screen-content"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="final-icon">🎉</div>
        <h2>Вы просмотрели все карточки!</h2>
        <p>Ваша коллекция любимых фильмов пополнена.</p>
        <div className="final-actions">
          <button className="btn-primary btn-large" onClick={onOpenLiked} style={{width: "100%", marginBottom: "15px"}}>
            ❤️ Посмотреть любимые
          </button>
          <button className="btn-secondary btn-large" onClick={onWatchNew} style={{width: "100%"}}>
            🔄 Искать новые (Сбросить дизлайки)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
