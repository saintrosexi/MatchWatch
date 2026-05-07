# MatchWatch

Веб‑приложение для выбора фильма свайпами.

## Локальный запуск

```bash
npm install
npm start
```

Если нужно открыть с другого компьютера в LAN:
- Создай `.env` по примеру `.env.example`
- Запусти `npm start`
- Открой `http://<LAN-IP>:3000`

## Деплой на Vercel

- **Framework Preset**: Create React App
- **Build Command**: `npm run build`
- **Output Directory**: `build`

Если добавим Firebase, значения конфигурации задавай в **Project → Settings → Environment Variables** (не коммить `.env`).

## SPA routing

В репозитории есть `vercel.json` с rewrite на `index.html`, чтобы прямые заходы по URL работали корректно.

# 🎬❤️ MatchWatch - Movie Swiping App

A Tinder-like movie matching web application built with React and Framer Motion, designed for collaborative movie selection and discovery.

## ✨ Features

### 🎬 Core Features
- **Swipe-based movie selection** - Swipe left to reject, right to like
- **Movie details modal** - Click "Подробнее" to see full details, trailer links, and IMDb links
- **Top rated movies** - Browse the highest-rated films with detailed information
- **Movie search** - Search movies by title or director, filter by year
- **Mood-based selection** - Choose a mood (Relax, Smart, Romance, Epic) and get personalized recommendations

### 💑 MatchWatch Features (Multiplayer)
- **Create or join rooms** - Start a MatchWatch session with a unique code
- **Collaborative swiping** - Both users swipe through movies in real-time (Firebase integration ready)
- **Match notifications** - Get alerted when you both like the same movie
- **Movie chemistry** - See compatibility metrics between users

### 👤 Profile & Analytics
- **Taste Profile** - Analyze your movie preferences:
  - Total movies liked
  - Average rating preference
  - Favorite decades and years
  - Favorite directors
  - Taste compatibility score

### 🎨 User Experience
- **Dark theme** - Modern dark interface with gradient accents
- **Smooth animations** - Powered by Framer Motion
- **Responsive design** - Works on desktop and mobile
- **Real-time sync** - Firebase integration for multiplayer features

## 🚀 Getting Started

### Prerequisites
- Node.js 14+ and npm
- React 18

### Installation

1. **Clone or navigate to the project directory**
```bash
cd movieswap
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the development server**
```bash
npm start
```

The app will open at `http://localhost:3000`

## 📖 Usage

### Main Navigation
- **🎬 Выбрать фильм** - Main swipe screen with stacked cards
- **💑 MatchWatch** - Create or join a room for collaborative swiping
- **🎲 По настроению** - Choose a mood and get personalized recommendations
- **🔍 Поиск** - Search and filter movies
- **⭐ Топ фильмов** - Browse top-rated movies
- **❤️ Любимые** - View your liked movies and taste profile

### Swiping
- Drag cards left to reject, right to like
- Click "ℹ️ Подробнее" to open movie details modal
- Watch for visual feedback (👍 LIKE / 👎 NOPE)
- Animated heart appears when liking a movie

### Searching
- Type a movie title or director name
- Filter by year using the dropdown
- Results update in real-time
- Click any movie to see full details

### Mood Picker
- Select one of four moods
- View all movies categorized for that mood
- Click movies to see details
- Helps discover films matching your current vibe

### MatchWatch (Multiplayer)
1. **Create a room**
   - Click "Создать комнату"
   - Enter your name
   - Share the generated code with a friend

2. **Join a room**
   - Click "Присоединиться к комнате"
   - Enter the room code
   - Enter your name

3. **Swipe together**
   - Both users swipe through movies
   - System detects when both users like the same movie
   - Celebration notification appears on match!

## 🗄️ Database Setup (Firebase)

To enable multiplayer features and data persistence:

### 1. Create a Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com/)
- Click "Create a new project"
- Name it "MatchWatch"
- Enable Google Analytics (optional)

### 2. Set Up Realtime Database
- In your Firebase project, go to "Build" > "Realtime Database"
- Click "Create Database"
- Start in test mode (for development)
- Select your preferred region

### 3. Get Configuration
- Go to Project Settings (gear icon)
- Click "Service accounts"
- Select "Node.js" and copy the config object
- Alternatively, go to "Project settings" and find your Web API config

### 4. Configure the App
1. **Option A: Using Environment Variables**
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

2. **Option B: Direct Configuration**
Edit `src/firebase.js` and uncomment the configuration section:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 5. Database Security Rules
For development (test mode):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

For production, restrict access:
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "userLikes": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "matchRooms": {
      ".read": true,
      ".write": true
    }
  }
}
```

### 6. Install Firebase Package
```bash
npm install firebase
```

### 7. Enable Firebase Functions
After configuring, uncomment the imports in `src/firebase.js` and restart the app.

## 🎨 Design & Colors

**Color Scheme:**
- Primary: `#0d0d0d` (Dark background)
- Accent: `#ff8a50` (Orange)
- Secondary: `#ff6b6b` (Red)
- Text: `rgba(255, 255, 255, 0.85)` (Light gray-white)

**Typography:**
- Primary font: Inter, Roboto
- Modern, clean sans-serif stack

## 📱 Responsive Design

The app is fully responsive:
- **Desktop**: Full features with optimized layouts
- **Tablet**: Adjusted grid columns and spacing
- **Mobile**: Touch-friendly interface with optimized touch targets

## 🔧 Technologies Used

- **React 18** - UI framework
- **Framer Motion** - Animations
- **Firebase Realtime Database** - Multiplayer sync and data storage
- **CSS3** - Styling with gradients and animations
- **JavaScript ES6+** - Modern JavaScript

## 📂 Project Structure

```
movieswap/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Header.js          # Navigation header
│   │   ├── SwipeCard.js       # Main swipe card component
│   │   ├── LikedGrid.js       # Liked movies grid with profile
│   │   ├── TopMovies.js       # Top-rated movies list
│   │   ├── SearchMovies.js    # Search and filter page
│   │   ├── MoodPicker.js      # Mood-based recommendations
│   │   ├── MatchWatch.js      # Multiplayer room feature
│   │   ├── TasteProfile.js    # User taste analysis
│   │   ├── MovieModal.js      # Movie details modal
│   │   ├── MovieModal.css     # Modal styling
│   │   └── FinalScreen.js     # End of swipe screen
│   ├── App.js                 # Main app component
│   ├── data.js                # Movie database
│   ├── db.js                  # Local database utilities
│   ├── firebase.js            # Firebase configuration
│   ├── styles.css             # Global styles
│   └── index.js               # React entry point
├── package.json
└── README.md
```

## 🎯 Future Enhancements

- [ ] User authentication (Google, GitHub, email)
- [ ] Persistent user profiles
- [ ] Advanced recommendation algorithm
- [ ] Integration with real movie APIs (TMDb, IMDb)
- [ ] User reviews and ratings
- [ ] Social features (follow friends, share lists)
- [ ] Dark/Light theme toggle
- [ ] Multi-language support
- [ ] Movie watching history
- [ ] Watchlist sharing

## 🐛 Troubleshooting

**Issue**: Cards not swiping smoothly
- Clear browser cache
- Check that Framer Motion is properly installed
- Verify React version is 18 or higher

**Issue**: Firebase functions not working
- Verify Firebase config is correct
- Check database security rules
- Ensure Firebase package is installed
- Check browser console for errors

**Issue**: Styles not loading
- Clear CSS cache (Ctrl+Shift+Delete on Windows, Cmd+Shift+Delete on Mac)
- Verify styles.css is imported in App.js
- Check for CSS syntax errors

## 📄 License

This project is open source. Feel free to use it for learning and personal projects.

## 🙏 Credits

Built with ❤️ using React and Framer Motion

---

**Ready to start matching?** 🎬❤️ Launch the app and start swiping!
