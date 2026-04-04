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
- **matchStore** (`src/store/useMatchStore.ts`): all simulated match results, live group standings, and knockout results
- **tournamentStore**: current tournament run, selected nation, group results, bracket state
- **collectionStore**: owned player cards, pack count, coin balance, pack open history
- **settingsStore**: language (tr/en), sound on/off, ad preference

All stores persist to AsyncStorage via Zustand `persist` middleware.

### matchStore — key details
- `results: Record<fixtureId, MatchResult>` — stores full event log + score per fixture
- `standings: Record<teamId, TeamStanding>` — rebuilt from scratch on every `saveResult` call to prevent double-counting on re-simulate
- `knockoutResults: Record<matchId, KnockoutResult>` — keyed by numeric match ID (73–104); written by `saveKnockoutResult()`; cleared in bulk by `clearAllKnockoutResults()`
- Standings are only recalculated for fixture IDs present in `GROUP_FIXTURES` (guards against ad-hoc matches polluting group tables)
- `selectStandings(standings, group)` returns 4 rows sorted: Pts → GD → GF → teamId
- `fixtureId` bridge: navigation params `{ homeTeamId, awayTeamId, fixtureId? }` link a Fixtures card to its saved result. Ad-hoc matches get an `adhoc-{home}-{away}-{ts}` key. Knockout simulate navigations use `fixtureId: 'ko-{matchId}'`.
- `SimulatorScreen` saves on `status === 'finished'` via `useEffect` on `state.status`

## Knockout Stage System

### Types — `src/types/knockout.ts`
- `KnockoutRound`: `'R32' | 'R16' | 'QF' | 'SF' | '3rd' | 'Final'`
- `SlotSource`: discriminated union describing where a team comes from:
  - `{ kind: 'group', position: 1|2, group }` — group winner or runner-up
  - `{ kind: 'third_variable', slot: number }` — one of 8 best 3rd-placers, slot resolved at runtime
  - `{ kind: 'winner'|'loser', matchId: number }` — winner/loser of a prior knockout match
- `KnockoutMatchDef`: static bracket definition `{ id, round, homeSource, awaySource, date, venue }`
- `KnockoutResult`: same shape as `MatchResult` but keyed by numeric `matchId`
- `ResolvedKnockoutMatch`: runtime `{ def, homeTeamId: string|null, awayTeamId: string|null, result: KnockoutResult|null }`

### Constants — `src/constants/knockoutBracket.ts`
- `KNOCKOUT_MATCHES`: 32 match definitions, IDs 73–104, with real WC2026 dates/venues
- `THIRD_SLOT_ELIGIBLE`: eligibility map `Record<slotMatchId, string[]>` — which groups' 3rd-placers can fill each variable slot (8 slots: 74, 77, 79, 80, 81, 82, 85, 87)
- `R32_ORDER`, `R16_ORDER`, `QF_ORDER`, `SF_ORDER`, `ROUND_ORDERS` — display order arrays for `KnockoutBracket` columns

### Engine — `src/utils/knockoutEngine.ts`
- `getGroupThirdPlacer(group, standings, results)` — returns 3rd-place team for a completed group, or null
- `getBestThirdPlacers(standings, results)` — collects 3rd-placers from all 12 groups; returns top 8 sorted by Pts→GD→GF→group, or null if fewer than 8 complete groups
- `assignThirdPlacerSlots(qualifyingGroups)` — backtracking bipartite matching assigning 8 qualifying groups to the 8 variable slots respecting `THIRD_SLOT_ELIGIBLE`; returns `Record<slotId, group>` or null
- `resolveKnockoutBracket(standings, results, knockoutResults)` — main function; processes matches 73→104 in order so dependencies always resolve before they are needed; returns `ResolvedKnockoutMatch[]`

### Component — `src/components/KnockoutBracket.tsx`
- Horizontal `ScrollView` with one `BracketColumn` per round (R32→R16→QF→SF→Final)
- Cards are 168×72px, positioned absolutely within columns using growing vertical gaps so pairs align across rounds
- Third-place match rendered in a separate row below the bracket, aligned under the SF column
- Each `KnockoutMatchCard` shows: round accent, match number, team flags + names, score or "vs", ⚡ quick-sim and ▶/↺ simulate buttons (buttons hidden until both teams are known)

### FixturesScreen knockout integration
- `ViewMode` = `'groups' | 'knockout' | 'matchdays'`; tab bar hidden in knockout mode
- `handleKnockoutQuickSim(match)` — calls `simulateMatch` + `computeScore` synchronously; if draw, home gets +1 (no extra time)
- `handleKnockoutSimulate(match)` — navigates to SimulatorScreen with `fixtureId: 'ko-{matchId}'`; SimulatorScreen saves via `saveKnockoutResult` when it detects a `ko-` prefix
- `resolvedBracket` is recomputed on every render from `resolveKnockoutBracket(standings, results, knockoutResults)`
- `refreshKey` counter state forces ScrollView subtree remount on refresh tap (fixes React 18 `Object.is` bailout when same state value is set)

## Penalty Shootout System

### Types — `src/types/penalty.ts`
- `GoalZone`: `0–8` (3×3 grid, row-major: 0=top-left, 8=bottom-right)
- `ShotTechnique`: `'regular' | 'power' | 'panenka'`
- `GKDive`: `{ direction: 'left'|'center'|'right', height: 'high'|'low' }`
- `ShotOutcome`: `'goal' | 'saved' | 'miss'`
- `ShotInput`: `{ zone, power: 0–100, accuracy: 0–100, technique }`
- `KickRecord`: `{ teamId, outcome: ShotOutcome | null }`
- `ShootoutMode`: `'best_of_5' | 'sudden_death'`
- `ShootoutPhase`: `'mode_select' | 'team_select' | 'kicking' | 'finished'`
- `KickPhase`: `'technique_select' | 'aiming' | 'power' | 'accuracy' | 'resolving' | 'cpu_kicking'`
- `ShootoutState`: full state machine snapshot including teams, scores, kicks, phases, pendingShot, lastKickResult

### Team ratings — `src/types/simulator.ts` + `src/constants/nations.ts`
- `penalty_skill?: number` — 0–100: higher = slower accuracy ring = easier timing for player
- `goalkeeper_rating?: number` — 0–100: higher = better penalty saves
- Notable values: Türkiye=77, England=52 (notorious penalty history), Argentina=90, Germany=85
- `getRingDuration(penaltySkill)` → `900 + skill * 13` ms (range 900ms–2200ms full cycle)

### Engine — `src/utils/penaltyEngine.ts`
- `getRingDuration(penaltySkill)` — returns accuracy ring oscillation cycle ms
- `generateGKDive(gkRating)` — weighted random GK dive; higher rating = higher chance of staying center
- `resolveUserShot(shot, gkDive, gkRating)` — outcome logic:
  - accuracy < 20 → always miss
  - power < 15 → near-certain save
  - Panenka + GK dives → always goal; GK stays center → save prob = `gkRating * 0.5 / 100`
  - GK correct column: save prob = `0.25 + (gkRating/100)*0.5` (+ 0.10 if height matches)
  - GK wrong column: save prob = 0.03; power shot reduces save prob by 30%; accuracy>80 reduces by 20%
- `resolveCPUShot(penaltySkill, gkRating)` — auto CPU kick; goal prob = `0.55 + (skill/100)*0.35`
- `checkShootoutEnd(kicks, mode, homeId, awayId)` — checks early-finish and final conditions
- `getPenaltyCommentary(outcome, technique, lang)` — 30+ meme lines per outcome×technique combo, TR + EN

### Components — `src/components/penalty/`
- `GoalView` — pixel art goal with crowd stands, ad boards, GK sprite, net, ball animation; shows outcome overlay
- `AimOverlay` — 3×3 `TouchableOpacity` grid overlaid on goal; highlights selected zone
- `PowerBar` — hold-and-release vertical bar; fill color green→yellow→red; locks power on release (max 1500ms)
- `AccuracyRing` — `Animated.loop` shrinking ring; tap to freeze; accuracy = 100 - (currentRadius/maxRadius)*100
- `ScoreTracker` — top bar with team flags, kick dot history (●=goal, ✕=miss, ○=pending), live score

### Screen — `src/screens/PenaltyScreen.tsx`
State machine with 4 top-level phases:
1. `mode_select` — user picks Best of 5 or Sudden Death
2. `team_select` — user picks home + away from full 48-nation list
3. `kicking` — alternating turns; user kicks = technique→aim→power→accuracy→resolving; CPU = auto-resolve after 1200ms delay
4. `finished` — result screen with winner, final score, Play Again / Back

Kick ordering: home always kicks first in each round; sudden death activates after round 5 if tied.
Navigation params `{ homeTeamId?, awayTeamId? }` skip mode/team select if provided (e.g. from SimulatorScreen after fulltime).

### Navigation
`Penalty: { homeTeamId?: string; awayTeamId?: string } | undefined` in `BottomTabParamList`.
Penalty is the 4th tab (between Simulator and Tournament).

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
