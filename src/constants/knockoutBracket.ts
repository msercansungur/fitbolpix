import { KnockoutMatchDef } from '../types/knockout';

// ─── Bracket match definitions ────────────────────────────────────────────────
// Source: Wikipedia 2026 FIFA World Cup knockout stage
// Match IDs follow FIFA official numbering (73–104)

export const KNOCKOUT_MATCHES: KnockoutMatchDef[] = [
  // ── Round of 32 ────────────────────────────────────────────────────────────
  { id: 73,  round: 'R32',   date: '2026-06-28', venue: 'SoFi Stadium, Inglewood',
    homeSource: { kind: 'group', position: 2, group: 'A' },
    awaySource: { kind: 'group', position: 2, group: 'B' } },

  { id: 74,  round: 'R32',   date: '2026-06-29', venue: 'MetLife Stadium, East Rutherford',
    homeSource: { kind: 'group', position: 1, group: 'E' },
    awaySource: { kind: 'third_variable', slot: 74 } },

  { id: 75,  round: 'R32',   date: '2026-06-29', venue: 'AT&T Stadium, Arlington',
    homeSource: { kind: 'group', position: 1, group: 'F' },
    awaySource: { kind: 'group', position: 2, group: 'C' } },

  { id: 76,  round: 'R32',   date: '2026-06-29', venue: 'Gillette Stadium, Foxborough',
    homeSource: { kind: 'group', position: 1, group: 'C' },
    awaySource: { kind: 'group', position: 2, group: 'F' } },

  { id: 77,  round: 'R32',   date: '2026-06-30', venue: 'Lumen Field, Seattle',
    homeSource: { kind: 'group', position: 1, group: 'I' },
    awaySource: { kind: 'third_variable', slot: 77 } },

  { id: 78,  round: 'R32',   date: '2026-06-30', venue: 'Hard Rock Stadium, Miami Gardens',
    homeSource: { kind: 'group', position: 2, group: 'E' },
    awaySource: { kind: 'group', position: 2, group: 'I' } },

  { id: 79,  round: 'R32',   date: '2026-07-01', venue: 'NRG Stadium, Houston',
    homeSource: { kind: 'group', position: 1, group: 'A' },
    awaySource: { kind: 'third_variable', slot: 79 } },

  { id: 80,  round: 'R32',   date: '2026-07-01', venue: 'BC Place, Vancouver',
    homeSource: { kind: 'group', position: 1, group: 'L' },
    awaySource: { kind: 'third_variable', slot: 80 } },

  { id: 81,  round: 'R32',   date: '2026-07-02', venue: 'Estadio Azteca, Mexico City',
    homeSource: { kind: 'group', position: 1, group: 'D' },
    awaySource: { kind: 'third_variable', slot: 81 } },

  { id: 82,  round: 'R32',   date: '2026-07-02', venue: "Levi's Stadium, Santa Clara",
    homeSource: { kind: 'group', position: 1, group: 'G' },
    awaySource: { kind: 'third_variable', slot: 82 } },

  { id: 83,  round: 'R32',   date: '2026-07-02', venue: 'Mercedes-Benz Stadium, Atlanta',
    homeSource: { kind: 'group', position: 2, group: 'K' },
    awaySource: { kind: 'group', position: 2, group: 'L' } },

  { id: 84,  round: 'R32',   date: '2026-07-03', venue: 'BMO Field, Toronto',
    homeSource: { kind: 'group', position: 1, group: 'H' },
    awaySource: { kind: 'group', position: 2, group: 'J' } },

  { id: 85,  round: 'R32',   date: '2026-07-03', venue: 'Lincoln Financial Field, Philadelphia',
    homeSource: { kind: 'group', position: 1, group: 'B' },
    awaySource: { kind: 'third_variable', slot: 85 } },

  { id: 86,  round: 'R32',   date: '2026-07-03', venue: 'Arrowhead Stadium, Kansas City',
    homeSource: { kind: 'group', position: 1, group: 'J' },
    awaySource: { kind: 'group', position: 2, group: 'H' } },

  { id: 87,  round: 'R32',   date: '2026-07-04', venue: 'Estadio BBVA, Guadalupe',
    homeSource: { kind: 'group', position: 1, group: 'K' },
    awaySource: { kind: 'third_variable', slot: 87 } },

  { id: 88,  round: 'R32',   date: '2026-07-04', venue: 'Estadio Akron, Zapopan',
    homeSource: { kind: 'group', position: 2, group: 'D' },
    awaySource: { kind: 'group', position: 2, group: 'G' } },

  // ── Round of 16 ────────────────────────────────────────────────────────────
  { id: 89,  round: 'R16',   date: '2026-07-04', venue: 'MetLife Stadium, East Rutherford',
    homeSource: { kind: 'winner', matchId: 74 },
    awaySource: { kind: 'winner', matchId: 77 } },

  { id: 90,  round: 'R16',   date: '2026-07-05', venue: 'SoFi Stadium, Inglewood',
    homeSource: { kind: 'winner', matchId: 73 },
    awaySource: { kind: 'winner', matchId: 75 } },

  { id: 91,  round: 'R16',   date: '2026-07-05', venue: 'AT&T Stadium, Arlington',
    homeSource: { kind: 'winner', matchId: 76 },
    awaySource: { kind: 'winner', matchId: 78 } },

  { id: 92,  round: 'R16',   date: '2026-07-06', venue: 'NRG Stadium, Houston',
    homeSource: { kind: 'winner', matchId: 79 },
    awaySource: { kind: 'winner', matchId: 80 } },

  { id: 93,  round: 'R16',   date: '2026-07-06', venue: 'Lumen Field, Seattle',
    homeSource: { kind: 'winner', matchId: 83 },
    awaySource: { kind: 'winner', matchId: 84 } },

  { id: 94,  round: 'R16',   date: '2026-07-07', venue: 'Gillette Stadium, Foxborough',
    homeSource: { kind: 'winner', matchId: 81 },
    awaySource: { kind: 'winner', matchId: 82 } },

  { id: 95,  round: 'R16',   date: '2026-07-07', venue: 'Hard Rock Stadium, Miami Gardens',
    homeSource: { kind: 'winner', matchId: 86 },
    awaySource: { kind: 'winner', matchId: 88 } },

  { id: 96,  round: 'R16',   date: '2026-07-07', venue: 'BC Place, Vancouver',
    homeSource: { kind: 'winner', matchId: 85 },
    awaySource: { kind: 'winner', matchId: 87 } },

  // ── Quarter-finals ──────────────────────────────────────────────────────────
  { id: 97,  round: 'QF',    date: '2026-07-09', venue: 'MetLife Stadium, East Rutherford',
    homeSource: { kind: 'winner', matchId: 89 },
    awaySource: { kind: 'winner', matchId: 90 } },

  { id: 98,  round: 'QF',    date: '2026-07-10', venue: 'SoFi Stadium, Inglewood',
    homeSource: { kind: 'winner', matchId: 93 },
    awaySource: { kind: 'winner', matchId: 94 } },

  { id: 99,  round: 'QF',    date: '2026-07-10', venue: 'AT&T Stadium, Arlington',
    homeSource: { kind: 'winner', matchId: 91 },
    awaySource: { kind: 'winner', matchId: 92 } },

  { id: 100, round: 'QF',    date: '2026-07-11', venue: 'NRG Stadium, Houston',
    homeSource: { kind: 'winner', matchId: 95 },
    awaySource: { kind: 'winner', matchId: 96 } },

  // ── Semi-finals ─────────────────────────────────────────────────────────────
  { id: 101, round: 'SF',    date: '2026-07-14', venue: 'MetLife Stadium, East Rutherford',
    homeSource: { kind: 'winner', matchId: 97 },
    awaySource: { kind: 'winner', matchId: 98 } },

  { id: 102, round: 'SF',    date: '2026-07-15', venue: 'SoFi Stadium, Inglewood',
    homeSource: { kind: 'winner', matchId: 99 },
    awaySource: { kind: 'winner', matchId: 100 } },

  // ── Third-place match ───────────────────────────────────────────────────────
  { id: 103, round: '3rd',   date: '2026-07-18', venue: 'Hard Rock Stadium, Miami Gardens',
    homeSource: { kind: 'loser', matchId: 101 },
    awaySource: { kind: 'loser', matchId: 102 } },

  // ── Final ───────────────────────────────────────────────────────────────────
  { id: 104, round: 'Final', date: '2026-07-19', venue: 'MetLife Stadium, East Rutherford',
    homeSource: { kind: 'winner', matchId: 101 },
    awaySource: { kind: 'winner', matchId: 102 } },
];

// ─── Third-place slot eligibility ────────────────────────────────────────────
// For each variable slot (match ID), which groups' 3rd-placers are eligible.
// Source: FIFA Annex C bracket rules — the bipartite assignment must be solved
// at runtime given which 8 groups actually qualify.

export const THIRD_SLOT_ELIGIBLE: Record<number, string[]> = {
  74: ['A', 'B', 'C', 'D', 'F'],
  77: ['C', 'D', 'F', 'G', 'H'],
  79: ['C', 'E', 'F', 'H', 'I'],
  80: ['E', 'H', 'I', 'J', 'K'],
  81: ['B', 'E', 'F', 'I', 'J'],
  82: ['A', 'E', 'H', 'I', 'J'],
  85: ['E', 'F', 'G', 'I', 'J'],
  87: ['D', 'E', 'I', 'J', 'L'],
};

// ─── Bracket display order ────────────────────────────────────────────────────
// Matches ordered top-to-bottom per round so that winner lines connect cleanly.

export const R32_ORDER  = [74, 77, 73, 75, 76, 78, 79, 80, 83, 84, 81, 82, 86, 88, 85, 87];
export const R16_ORDER  = [89, 90, 93, 94, 91, 92, 95, 96];
export const QF_ORDER   = [97, 98, 99, 100];
export const SF_ORDER   = [101, 102];
export const ROUND_ORDERS: Record<string, number[]> = {
  R32: R32_ORDER,
  R16: R16_ORDER,
  QF:  QF_ORDER,
  SF:  SF_ORDER,
};
