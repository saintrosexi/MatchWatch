import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setAuthError("Эта почта уже зарегистрирована");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setAuthError("Неверная почта или пароль");
      } else if (err.code === "auth/weak-password") {
        setAuthError("Пароль должен быть не менее 6 символов");
      } else {
        setAuthError("Произошла ошибка. Проверьте настройки Firebase.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Ошибка выхода", err);
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <h2 className="page-title">Загрузка профиля...</h2>
      </div>
    );
  }

  if (user) {
    return (
      <div className="profile-container">
        <h2 className="page-title">👤 Мой Профиль</h2>
        <motion.div className="profile-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="profile-header">
            <div className="profile-avatar">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <h3>Вы вошли как:</h3>
              <p>{user.email}</p>
            </div>
          </div>
          
          <div className="profile-actions">
            <button className="btn-secondary" onClick={handleLogout}>🚪 Выйти из аккаунта</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <h2 className="page-title">👤 Аккаунт</h2>
      
      <motion.div className="auth-form-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h3>{isLoginMode ? "Вход" : "Регистрация"}</h3>
        
        {authError && <div className="auth-error">{authError}</div>}
        
        <form onSubmit={handleAuth} className="auth-form">
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="example@mail.com" 
              required 
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label>Пароль</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Минимум 6 символов" 
              required 
              className="form-input"
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={authLoading} style={{ width: "100%", marginTop: "10px" }}>
            {authLoading ? "Загрузка..." : (isLoginMode ? "Войти" : "Зарегистрироваться")}
          </button>
        </form>
        
        <div className="auth-toggle">
          {isLoginMode ? "Нет аккаунта?" : "Уже есть аккаунт?"}
          <button 
            type="button" 
            className="btn-text" 
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setAuthError("");
            }}
          >
            {isLoginMode ? "Создать" : "Войти"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
