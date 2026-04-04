// ─── Shot mechanics ───────────────────────────────────────────────────────────

/** The 3×3 goal grid, row-major (0=top-left … 8=bottom-right) */
export type GoalZone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type ShotTechnique = 'regular' | 'power' | 'panenka';

export type GKDiveDirection = 'left' | 'center' | 'right';
export type GKDiveHeight    = 'high'  | 'low';

export interface GKDive {
  direction: GKDiveDirection;
  height:    GKDiveHeight;
}

export type ShotOutcome = 'goal' | 'saved' | 'miss';

export interface ShotInput {
  zone:      GoalZone;
  power:     number; // 0–100
  accuracy:  number; // 0–100 (from accuracy ring timing)
  technique: ShotTechnique;
}

// ─── Shootout structure ───────────────────────────────────────────────────────

export type ShootoutMode = 'best_of_5' | 'sudden_death';

export interface KickRecord {
  teamId:  string;
  outcome: ShotOutcome | null; // null = not yet taken
}

// ─── Phase enums ─────────────────────────────────────────────────────────────

/** Top-level flow of the entire PenaltyScreen */
export type ShootoutPhase = 'mode_select' | 'team_select' | 'kicking' | 'finished';

/** Sub-phases within a single kick turn */
export type KickPhase =
  | 'technique_select' // user picks Regular / Power / Panenka
  | 'aiming'           // user drags to select a zone
  | 'power'            // user holds & releases power bar
  | 'accuracy'         // user taps shrinking accuracy ring
  | 'resolving'        // animating GK dive + outcome reveal
  | 'cpu_kicking';     // CPU turn — auto-resolves after short delay

// ─── Full shootout state ──────────────────────────────────────────────────────

export interface ShootoutState {
  homeTeamId:      string;
  awayTeamId:      string;
  userTeamId:      string;          // which side the human controls
  mode:            ShootoutMode;
  phase:           ShootoutPhase;
  kickPhase:       KickPhase;
  round:           number;          // 1-based kick round
  kicks:           KickRecord[];    // full ordered history
  homeScore:       number;
  awayScore:       number;
  currentKickTeam: 'home' | 'away'; // whose turn it is
  winner:          string | null;   // teamId of winner, or null
  pendingShot:     Partial<ShotInput>;
  lastKickResult:  { outcome: ShotOutcome; commentary: string; gkDive: GKDive } | null;
}
