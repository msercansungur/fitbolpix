import { MatchEvent } from './simulator';

export interface MatchResult {
  fixtureId: string;       // matches GROUP_FIXTURES[x].id, or 'adhoc-...' for free play
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];    // full event log — used for DETAILS modal
  simulatedAt: number;     // Date.now()
}

export interface TeamStanding {
  teamId: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}
