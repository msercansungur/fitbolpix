# Fitbolpix — Project Architecture

## Overview
Fitbolpix is a World Cup 2026 companion app built with React Native Expo. It combines real fixture data, a chaotic pixel art match simulator, a playable penalty shootout, a full tournament mode, and a player card collection system — all wrapped in Turkish & global football meme culture.

## Tech Stack
| Technology | Version | Purpose |
|---|---|---|
| Expo (managed workflow) | ~53 | Build & deploy |
| React Native | bundled with Expo | UI framework |
| TypeScript | ~5 | Type safety |
| React Navigation | ^7 | Screen routing |
| Zustand | ^5 | Global state management |
| AsyncStorage | ^2 | Persistent local storage |
| API-Football | v3 | Real fixture & results data |
| AdMob (expo-ads-admob) | TBD | Ad monetization |
| expo-in-app-purchases | TBD | IAP monetization |

## Folder Structure
```
fitbolpix/
├── App.tsx                  # Entry point — NavigationContainer + BottomTabNavigator
├── app.json                 # Expo config
├── CLAUDE.md                # This file
├── src/
│   ├── screens/             # One file per top-level screen
│   │   ├── HomeScreen.tsx
│   │   ├── FixturesScreen.tsx
│   │   ├── SimulatorScreen.tsx
│   │   ├── TournamentScreen.tsx
│   │   └── CollectionScreen.tsx
│   ├── navigation/
│   │   ├── BottomTabNavigator.tsx   # 5-tab bottom nav
│   │   └── RootNavigator.tsx        # Future: stack nav wrapping tabs (modals etc.)
│   ├── store/               # Zustand stores
│   │   ├── tournamentStore.ts       # Tournament state, selected nation, bracket
│   │   ├── collectionStore.ts       # Owned cards, packs, currency
│   │   └── settingsStore.ts         # Language, sound, preferences
│   ├── components/          # Shared reusable UI components
│   │   ├── PixelText.tsx            # Custom pixel font text
│   │   ├── PlayerCard.tsx           # Card component for collection
│   │   └── MatchEventFeed.tsx       # Live commentary feed in simulator
│   ├── assets/              # Static assets
│   │   ├── sprites/                 # Pixel art sprite sheets (players, pitch, ball)
│   │   ├── sounds/                  # SFX (crowd, whistle, goal)
│   │   └── fonts/                   # Pixel fonts
│   ├── hooks/               # Custom React hooks
│   │   ├── useFixtures.ts           # Fetches & caches fixture data
│   │   ├── useSimulator.ts          # Match simulation engine hook
│   │   └── usePenaltyGame.ts        # Penalty shootout game logic
│   ├── utils/               # Pure utility functions
│   │   ├── simulator.ts             # Match event generation algorithm
│   │   ├── memeCommentary.ts        # Commentary line picker (TR + EN)
│   │   ├── cardDrop.ts              # Card pack drop rate logic
│   │   └── apiFootball.ts           # API-Football client & endpoints
│   ├── types/               # Shared TypeScript interfaces
│   │   ├── fixture.ts               # Fixture, Team, Score types
│   │   ├── player.ts                # PlayerCard, Rarity types
│   │   ├── tournament.ts            # Bracket, Group, Nation types
│   │   └── navigation.ts            # Nav param list types
│   └── constants/           # App-wide constants
│       ├── theme.ts                 # Colors, spacing, typography
│       ├── nations.ts               # All 48 World Cup 2026 nations with metadata
│       └── config.ts                # API keys (via env), feature flags
```

## Features

### 1. Match Simulator
- Procedurally generated 90-minute match events (goals, cards, saves, fouls)
- Driven by team strength ratings and RNG with weighted probabilities
- Pixel art field with animated sprites for key moments
- Commentary lines pulled from `memeCommentary.ts` — supports Turkish (TR) and English (EN)
- Located: `src/screens/SimulatorScreen.tsx`, `src/hooks/useSimulator.ts`, `src/utils/simulator.ts`

### 2. Penalty Shootout Mini-Game
- Interactive: player swipes/taps to aim and shoot
- Keeper AI with difficulty scaling
- Triggered at the end of knockout matches or from the Simulator screen
- Located: `src/hooks/usePenaltyGame.ts`

### 3. Tournament Mode
- Full 48-team World Cup 2026 bracket (group stage → round of 32 → knockouts → final)
- Player picks a nation at start; controls that nation's matches
- CPU vs CPU for all other matches (simulated automatically)
- State persisted via Zustand + AsyncStorage
- Located: `src/screens/TournamentScreen.tsx`, `src/store/tournamentStore.ts`

### 4. Player Card Collection
- Pixel art cards for players from all 48 nations
- Rarity tiers: Common, Rare, Epic, Legend
- Pack opening with animated reveal
- Earn free packs via gameplay (match wins, tournament progress)
- Premium packs via IAP
- Located: `src/screens/CollectionScreen.tsx`, `src/store/collectionStore.ts`, `src/utils/cardDrop.ts`

### 5. Fixtures
- Real World Cup 2026 fixture data from API-Football v3
- Cached locally with AsyncStorage (TTL: 5 min for live, 1 hr for upcoming)
- Group stage and knockout bracket views
- Located: `src/screens/FixturesScreen.tsx`, `src/hooks/useFixtures.ts`, `src/utils/apiFootball.ts`

### 6. Meme Commentary System
- Pool of ~200+ commentary lines in Turkish and English
- Lines are tagged by event type: goal, miss, red_card, var_check, injury_time, penalty, etc.
- Randomly selected with weighting (rare lines appear less often)
- Language follows device locale, overridable in settings
- Located: `src/utils/memeCommentary.ts`

## State Management (Zustand)
- **tournamentStore**: current tournament run, selected nation, group results, bracket state
- **collectionStore**: owned player cards, pack count, coin balance, pack open history
- **settingsStore**: language (tr/en), sound on/off, ad preference

All stores persist to AsyncStorage via Zustand `persist` middleware.

## Data Flow
```
API-Football → useFixtures (hook) → FixturesScreen
                                  → SimulatorScreen (team data)
                                  → TournamentScreen (bracket seeding)

Zustand stores ←→ AsyncStorage (persist middleware)
     ↓
All screens read/write via store hooks (no prop drilling)
```

## Monetization

### AdMob
| Placement | Trigger |
|---|---|
| Interstitial | After each simulated match |
| Rewarded | Watch ad → earn free pack |
| Banner | Collection screen bottom |

### IAP
| Product | Type | Description |
|---|---|---|
| pack_basic | Consumable | 5-card pack |
| pack_premium | Consumable | 10-card pack, higher rarity |
| pack_mega | Consumable | 20-card pack, guaranteed Epic |
| no_ads | Non-consumable | Removes interstitials permanently |

## API-Football Integration
- Base URL: `https://v3.football.api-sports.io`
- Auth: `x-rapidapi-key` header (stored in `constants/config.ts` via env var)
- Key endpoints:
  - `GET /fixtures?league=1&season=2026` — World Cup fixtures
  - `GET /standings?league=1&season=2026` — Group standings
  - `GET /teams?league=1&season=2026` — Team metadata

## Development Conventions
- **Naming**: PascalCase for components/screens, camelCase for hooks/utils, SCREAMING_SNAKE for constants
- **Files**: One component per file, named same as the export
- **Types**: All types in `src/types/`, imported explicitly (no `any`)
- **Stores**: Never mutate state directly — always use Zustand setters
- **Screens**: Screens are thin — logic lives in hooks, pure functions in utils
- **Assets**: All pixel sprites are PNG, spritesheet format where possible for performance
- **i18n**: No i18n library — simple key lookup via `memeCommentary.ts` pattern, extended to UI strings in `constants/strings.ts` if needed
