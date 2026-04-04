export type EventType =
  | 'goal'
  | 'yellow_card'
  | 'red_card'
  | 'save'
  | 'foul'
  | 'var_check'
  | 'injury'
  | 'kickoff'
  | 'halftime'
  | 'fulltime';

export interface Team {
  id: string;
  name: string;
  flag: string;
  strength: number;          // 0–100
  group: string;             // 'A'–'L'
  penalty_skill?: number;    // 0–100: higher = slower accuracy ring = easier timing
  goalkeeper_rating?: number; // 0–100: higher = better penalty saves
}

export interface MatchEvent {
  id: string;
  minute: number;
  type: EventType;
  teamId: string; // empty string for neutral events (kickoff, halftime, fulltime)
  commentary: string;
}

export type MatchStatus = 'idle' | 'running' | 'finished';

export interface SimulatorState {
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];        // events revealed so far
  pendingEvents: MatchEvent[]; // events yet to be revealed
  currentMinute: number;
  status: MatchStatus;
}
