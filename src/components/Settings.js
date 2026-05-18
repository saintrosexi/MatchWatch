import React from "react";
import { motion } from "framer-motion";

export default function Settings({ theme, setTheme, language, setLanguage }) {
  return (
    <div className="profile-container">
      <h2 className="page-title">⚙️ Параметры</h2>

      <motion.div className="profile-card profile-card-settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h3>Внешний вид и язык</h3>

        <div className="setting-group" style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Тема оформления</label>
          <div className="toggle-container" style={{ display: "flex", gap: "10px" }}>
            <button
              className={`btn-secondary ${theme === "dark" ? "active-theme" : ""}`}
              onClick={() => setTheme("dark")}
              style={{
                flex: 1,
                border: theme === "dark" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                opacity: theme === "dark" ? 1 : 0.7
              }}
            >
              🌙 Темная
            </button>
            <button
              className={`btn-secondary ${theme === "light" ? "active-theme" : ""}`}
              onClick={() => setTheme("light")}
              style={{
                flex: 1,
                border: theme === "light" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                opacity: theme === "light" ? 1 : 0.7
              }}
            >
              ☀️ Светлая
            </button>
          </div>
        </div>

        <div className="setting-group">
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Язык</label>
          <div className="toggle-container" style={{ display: "flex", gap: "10px" }}>
            <button
              className={`btn-secondary ${language === "ru" ? "active-lang" : ""}`}
              onClick={() => setLanguage("ru")}
              style={{
                flex: 1,
                border: language === "ru" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                opacity: language === "ru" ? 1 : 0.7
              }}
            >
              🇷🇺 Русский
            </button>
            <button
              className={`btn-secondary ${language === "en" ? "active-lang" : ""}`}
              onClick={() => setLanguage("en")}
              style={{
                flex: 1,
                border: language === "en" ? "2px solid #ff8a50" : "1px solid rgba(255,255,255,0.2)",
                opacity: language === "en" ? 1 : 0.7
              }}
            >
              🇬🇧 Английский
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
