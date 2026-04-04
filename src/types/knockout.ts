import { MatchEvent } from './simulator';

export type KnockoutRound = 'R32' | 'R16' | 'QF' | 'SF' | '3rd' | 'Final';

// Describes how a slot in a knockout match is determined
export type SlotSource =
  | { kind: 'group'; position: 1 | 2; group: string }      // e.g. winner/runner-up of Group A
  | { kind: 'third_variable'; slot: number }                // 3rd-place qualifier — match slot# determines which group
  | { kind: 'winner'; matchId: number }                     // winner of a prior knockout match
  | { kind: 'loser'; matchId: number };                     // loser of a prior knockout match (3rd-place match)

export interface KnockoutMatchDef {
  id: number;            // FIFA match number 73–104
  round: KnockoutRound;
  homeSource: SlotSource;
  awaySource: SlotSource;
  date: string;          // ISO date
  venue: string;
}

export interface KnockoutResult {
  matchId: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  simulatedAt: number;
}

// A fully resolved match ready to render — slots may be null if not yet determined
export interface ResolvedKnockoutMatch {
  def: KnockoutMatchDef;
  homeTeamId: string | null;
  awayTeamId: string | null;
  result: KnockoutResult | null;
}
