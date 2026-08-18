# E2E Test Infra: MatchWatch Overhaul

## Test Philosophy
- **Requirement-Driven & Opaque-Box**: Tests verify user-observable behavior, schema conformance, API contracts, and real-time multiplayer synchronization without relying on internal implementation secrets.
- **Progressive Testability**: Verification steps must be reproducible, automated via Node.js scripts (`scripts/run_e2e_tests.mjs` and `scripts/validate_database.mjs`), and runnable without browser UI dependencies for CI/CD parity.
- **Methodology**: 4-Tier verification (Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Real-World Workload Scenarios) followed by Tier 5 Adversarial Hardening.

---

## Feature Inventory & Test Mapping
| # | Feature | Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) |
|---|---------|--------|:----------------:|:-----------------:|:----------------------:|
| F1 | Strict Database Categorization | ORIGINAL_REQUEST §R1 | ≥5 cases | ≥5 cases | ✓ |
| F2 | Kinopoisk ID Deduplication & Resolution | ORIGINAL_REQUEST §R1 | ≥5 cases | ≥5 cases | ✓ |
| F3 | Poster Integrity & Multi-tier Fallback | ORIGINAL_REQUEST §R1 | ≥5 cases | ≥5 cases | ✓ |
| F4 | Missing Titles Restoration | Survey Explorer 1 | ≥5 cases | ≥5 cases | ✓ |
| F5 | UI & Engine Category Filter Harmonization | Survey Explorer 1 | ≥5 cases | ≥5 cases | ✓ |
| F6 | Actor Dataset & High-Res Portraits | ORIGINAL_REQUEST §R2 | ≥5 cases | ≥5 cases | ✓ |
| F7 | Dynamic Actor Resolver & Live Fallback | ORIGINAL_REQUEST §R2 | ≥5 cases | ≥5 cases | ✓ |
| F8 | Desktop Star Hub Parity | ORIGINAL_REQUEST §R2 | ≥5 cases | ≥5 cases | ✓ |
| F9 | Substring-Safe Filmography Mapping | Survey Explorer 2 | ≥5 cases | ≥5 cases | ✓ |
| F10 | Movie Details Actor Chip Navigation | Survey Explorer 2 | ≥5 cases | ≥5 cases | ✓ |
| F11 | Environment & Keys Configuration | ORIGINAL_REQUEST §R4 | ≥5 cases | ≥5 cases | ✓ |
| F12 | Firebase Client Initialization | ORIGINAL_REQUEST §R3 | ≥5 cases | ≥5 cases | ✓ |
| F13 | 4-Character Room Codes & Shareable Links | ORIGINAL_REQUEST §R3 | ≥5 cases | ≥5 cases | ✓ |
| F14 | Live Member Presence Tracking | ORIGINAL_REQUEST §R3 | ≥5 cases | ≥5 cases | ✓ |
| F15 | Synchronized Compromise Deck | ORIGINAL_REQUEST §R3 | ≥5 cases | ≥5 cases | ✓ |
| F16 | Multi-User Swipes & Mutual Match Triggers | ORIGINAL_REQUEST §R3 | ≥5 cases | ≥5 cases | ✓ |
| F17 | Desktop/Mobile Rooms API Harmonization | Survey Explorer 3 | ≥5 cases | ≥5 cases | ✓ |
| F18 | Production Build Verification | ORIGINAL_REQUEST §R4 | ≥5 cases | ≥5 cases | ✓ |

---

## Test Architecture
- **Automated Test Runners**:
  - `node scripts/validate_database.mjs`: Exhaustive database validation (IDs, schemas, categories, posters, KP IDs, vectors).
  - `node scripts/run_e2e_tests.mjs`: Complete automated E2E testing suite executing all Tiers 1-4.
  - `npm run build`: Production bundle verification with 0 errors.
- **Pass/Fail Semantics**: All test scripts exit with code `0` on 100% pass, or non-zero exit code on any assertion failure.

---

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Database Integrity & Category Isolation Walkthrough | F1, F2, F3, F4, F5 | High |
| 2 | Star Hub Actor Discovery, Biography, & Filmography Flow | F6, F7, F8, F9, F10 | High |
| 3 | Two-User Multiplayer Room Creation, Join, Sync, & Match Trigger | F11, F12, F13, F14, F15, F16, F17 | High |
| 4 | Offline / Missing Data Graceful Degradation & Fallback Chain | F3, F7, F12, F16 | Medium |
| 5 | End-to-End Build & Cross-Platform UI Module Integrity | F18, F5, F8, F17 | Medium |

---

## Coverage Thresholds
- Tier 1: ≥5 test cases per feature (18 features × 5 = 90 test cases)
- Tier 2: ≥5 boundary/error cases per feature (18 features × 5 = 90 test cases)
- Tier 3: ≥18 pairwise cross-feature interaction cases
- Tier 4: ≥5 realistic end-to-end user application workflows
- **Total Minimum Target**: ≥203 automated test cases
