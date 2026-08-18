# Project: MatchWatch Integrity & Realtime Overhaul

## Architecture
MatchWatch is a modern dual-platform (Mobile Web & Desktop Web) movie recommendation and interactive matchmaking application built with React 19 and Vite.

### Key Subsystems:
1. **Catalog & Recommendation Engine**:
   - `src/data/movies.js`: 849 curated titles with 5D sensation vectors, Kinopoisk IDs, poster URLs, backdrops, and strict categorization (`movie`, `series`, `anime`).
   - `src/engine/recommendationEngine.js`: Taste-vector matching, category/genre filters, swipe deck generator, and midpoint compromise calculation for multiplayer rooms.
   - `src/utils/imagePrefetcher.js`: Multi-tier fallback pipeline for high-res posters, Kinopoisk CDN, Yandex CDN, frames, and stylized fallback cards.
2. **Star Hub & Actor Graph**:
   - `src/data/actors.js`: 270 curated actors with verified Wikimedia CDN portraits and 3-bullet biographical trivia.
   - `src/engine/actorResolver.js`: Dynamic actor profile resolver with Kinopoisk Unofficial API fallback and in-memory caching.
   - `src/components/views/StarHubView.jsx` (Mobile) & `src/components/desktop/DesktopStarHubView.jsx` (Desktop): Interactive actor catalogs, biographies, trivia facts, and normalized filmography filtering.
3. **Multiplayer Rooms & Firebase Synchronization**:
   - `src/firebase.js`: Firebase Realtime Database and Auth initialization.
   - `src/engine/realtimeRooms.js`: 4-character room codes, live member presence tracking, midpoint compromise deck synchronization, swipe event recording, and mutual match detection.
   - `src/components/views/RoomsView.jsx` (Mobile) & `src/components/desktop/DesktopRoomsView.jsx` (Desktop): Room lobby, shareable links, member list, and synchronized swipe session launch.
   - `src/App.jsx`: Global room subscription and reactive match celebration modal with confetti and fanfare audio across all connected tabs.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Strict Database Categorization | Clean classification of all titles into movie/series/anime with zero cross-contamination. | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Kinopoisk ID Deduplication & Resolution | 100% unique Kinopoisk IDs with 0 duplicate collisions across all entries. | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Poster Integrity & Multi-tier Fallback | Valid HTTPS poster URLs for all items and multi-tier fallback chains in all consumers. | M1 | ORIGINAL_REQUEST §R1 |
| F4 | Missing Titles Restoration | Restore 8 missing titles from MW2 catalog (Memento, Fargo, etc.) to form complete 849-title database. | M1 | Survey Explorer 1 |
| F5 | UI & Engine Category Filter Harmonization | Align mobile DiscoveryView, desktop DiscoveryView, and recommendationEngine room deck filter. | M1 | Survey Explorer 1 |
| F6 | Actor Dataset & High-Res Portraits | 270 curated actors rendered with genuine high-res Wikimedia portraits across Mobile & Desktop. | M2 | ORIGINAL_REQUEST §R2 |
| F7 | Dynamic Actor Resolver & Live Fallback | Kinopoisk Unofficial API person search & caching in `src/engine/actorResolver.js`. | M2 | ORIGINAL_REQUEST §R2 |
| F8 | Desktop Star Hub Parity | Left directory portraits + Right hero panel portrait, English name, facts, and filmography. | M2 | ORIGINAL_REQUEST §R2 |
| F9 | Substring-Safe Filmography Mapping | Comma-split normalized actor matching in filmography views and recommendation engine. | M2 | Survey Explorer 2 |
| F10 | Movie Details Actor Chip Navigation | Interactive actor chips in MovieDetailsSheet and DesktopMovieDetailsModal navigating to Star Hub. | M2 | Survey Explorer 2 |
| F11 | Environment & Keys Configuration | `.env` configuration with Firebase & Telegram credentials from matchwatch2. | M3 | ORIGINAL_REQUEST §R4 |
| F12 | Firebase Client Initialization | `src/firebase.js` initialized with Realtime Database and Auth. | M3 | ORIGINAL_REQUEST §R3 |
| F13 | 4-Character Room Codes & Shareable Links | Alphanumeric uppercase 4-character room codes with clipboard link sharing. | M3 | ORIGINAL_REQUEST §R3 |
| F14 | Live Member Presence Tracking | Realtime presence tracking (`online: true/false`) and member joining in RTDB. | M3 | ORIGINAL_REQUEST §R3 |
| F15 | Synchronized Compromise Deck | Shared 25-movie compromise deck computed and stored in room state. | M3 | ORIGINAL_REQUEST §R3 |
| F16 | Multi-User Swipes & Mutual Match Triggers | Live swipe recording and instantaneous mutual match celebration across all tabs. | M3 | ORIGINAL_REQUEST §R3 |
| F17 | Desktop/Mobile Rooms API Harmonization | Standardized parameter handling and deck usage in DesktopRoomsView and RoomsView. | M3 | Survey Explorer 3 |
| F18 | Production Build Verification | `npm run build` passes with 0 errors and 0 warnings. | M4 | ORIGINAL_REQUEST §R4 |
| F19 | Comprehensive E2E Test Suite (Tiers 1-4) | Automated tests covering schema, actors, rooms, and end-to-end flows. | M4 | Project Architecture |
| F20 | Adversarial Coverage Hardening (Tier 5) | White-box stress tests, edge cases, and fault tolerance verification. | M4 | Project Architecture |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database & Poster Integrity | F1, F2, F3, F4, F5: Overhaul `src/data/movies.js`, create `scripts/validate_database.mjs`, align UI filters | none | IN_PROGRESS |
| M2 | Star Hub & Actor Graph | F6, F7, F8, F9, F10: Create `actorResolver.js`, refactor `StarHubView`, `DesktopStarHubView`, modals | M1 | PLANNED |
| M3 | Firebase Backend & Realtime Rooms | F11, F12, F13, F14, F15, F16, F17: Create `.env`, `firebase.js`, overhaul `realtimeRooms.js`, App celebration listener | none | IN_PROGRESS |
| M4 | Final Acceptance, E2E & Hardening | F18, F19, F20: 100% Pass on E2E Test Suite (Tiers 1-4) + Tier 5 Adversarial Coverage Hardening | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### `src/data/movies.js`
- Exports `movies: MovieItem[]` (849 items, sequential IDs 1..849).
- Schema:
  - `id: number` (unique)
  - `title: string`, `titleRu: string`
  - `year: number`, `rating: number`
  - `poster: string` (valid HTTPS URL)
  - `description: string`, `fullDescription: string`
  - `country: string`, `genres: string`, `actors?: string`, `director?: string`
  - `duration?: string`, `trailer?: string`
  - `kinopoiskId: number | null` (unique if non-null)
  - `sensationVector: { energy: number, darkness: number, intellect: number, emotion: number, dynamism: number }`
  - `vibeBadges: string[]`
  - `category: "movie" | "series" | "anime"` (STRICT)
  - `type?: "movie" | "series" | "anime"` (synchronized with category)

### `src/engine/actorResolver.js`
- `normalizeActorName(name: string): string`
- `getActorProfile(actorName: string): { name: string, nameEn: string, photo: string | null, facts: string[], kinopoiskId?: number }`
- `fetchRealActorProfile(actorName: string): Promise<{ name: string, nameEn: string, photo: string, kinopoiskId: number } | null>`

### `src/firebase.js`
- Exports `app`, `database`, `auth`, `isFirebaseConfigured(): boolean`.

### `src/engine/realtimeRooms.js`
- `generateRoomCode(): string` (4-char alphanumeric uppercase)
- `createRoom(optionsOrUser: { hostUser, preset } | User): Promise<RoomState>`
- `joinRoom(optionsOrCode: { roomCode, user } | string, maybeUser?: User): Promise<RoomState>`
- `leaveRoom(roomCode?: string, userId?: string): Promise<void>`
- `recordRoomSwipe(options: { roomCode?, movieId, liked, userId }): Promise<{ matched: boolean, movie?: MovieItem }>`
- `subscribeToRoom(roomCode: string, callback: (room: RoomState | null) => void): () => void`

---

## Code Layout
```
/Users/tehnicno/projects/matchwatch3/
├── .env                               # Environment variables (Firebase & Telegram)
├── package.json                       # Dependencies (firebase, react 19, vite)
├── scripts/
│   ├── validate_database.mjs          # Automated database integrity validator
│   └── run_e2e_tests.mjs              # E2E test runner
├── src/
│   ├── App.jsx                        # Root application shell & room match celebration listener
│   ├── firebase.js                    # Firebase app and RTDB initialization
│   ├── data/
│   │   ├── movies.js                  # 849 curated movie, series, and anime records
│   │   ├── actors.js                  # 270 curated actors with Wikimedia photos & trivia
│   │   └── presets.js                 # Mood & theme presets
│   ├── engine/
│   │   ├── recommendationEngine.js    # Recommendation & compromise deck engine
│   │   ├── realtimeRooms.js           # Firebase RTDB multiplayer room engine
│   │   └── actorResolver.js           # Dynamic actor profile & photo resolver
│   ├── utils/
│   │   ├── imagePrefetcher.js         # Multi-tier poster & frame fallback pipeline
│   │   └── soundEffects.js            # Match & swipe audio effects
│   └── components/
│       ├── views/
│       │   ├── DiscoveryView.jsx      # Mobile catalog & category tabs
│       │   ├── StarHubView.jsx        # Mobile Star Hub actor explorer
│       │   └── RoomsView.jsx          # Mobile Room creation & join lobby
│       ├── desktop/
│       │   ├── DesktopDiscoveryView.jsx # Desktop catalog & category tabs
│       │   ├── DesktopStarHubView.jsx # Desktop Star Hub 2-pane actor explorer
│       │   └── DesktopRoomsView.jsx   # Desktop Room lobby
│       └── modals/
│           ├── MovieDetailsSheet.jsx  # Mobile movie detail bottom sheet
│           ├── DesktopMovieDetailsModal.jsx # Desktop movie detail modal
│           └── MatchCelebrationModal.jsx # Mutual match celebration modal
```
