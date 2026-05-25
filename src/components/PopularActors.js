import React from "react";
import { actorsData } from "../actorsData";
import { motion } from "framer-motion";

export default function PopularActors({ onActorSelect }) {
  const actorEntries = Object.entries(actorsData);
  return (
    <motion.div
      className="popular-actors-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="page-title">Популярные актеры</h2>
      <div className="popular-actors-grid">
        {actorEntries.map(([key, actor]) => (
          <div
            key={key}
            className="actor-card"
            onClick={() => onActorSelect?.(key)}
            title={actor.name}
          >
            <img src={actor.photo} alt={actor.name} className="actor-photo" />
            <div className="actor-name">{actor.name}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
