import { Fixture } from '../types/fixture';

// All 72 WC2026 group stage fixtures — source: Wikipedia group pages (fetched April 2026)
// Venues abbreviated: full name, city
export const GROUP_FIXTURES: Fixture[] = [
  // ── GROUP A ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'A1', group: 'A', matchday: 1, homeTeamId: 'mex', awayTeamId: 'rsa',  date: '2026-06-11', venue: 'Estadio Azteca, Mexico City' },
  { id: 'A2', group: 'A', matchday: 1, homeTeamId: 'kor', awayTeamId: 'cze',  date: '2026-06-11', venue: 'Estadio Akron, Zapopan' },
  // MD2
  { id: 'A3', group: 'A', matchday: 2, homeTeamId: 'cze', awayTeamId: 'rsa',  date: '2026-06-18', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'A4', group: 'A', matchday: 2, homeTeamId: 'mex', awayTeamId: 'kor',  date: '2026-06-18', venue: 'Estadio Akron, Zapopan' },
  // MD3
  { id: 'A5', group: 'A', matchday: 3, homeTeamId: 'cze', awayTeamId: 'mex',  date: '2026-06-24', venue: 'Estadio Azteca, Mexico City' },
  { id: 'A6', group: 'A', matchday: 3, homeTeamId: 'rsa', awayTeamId: 'kor',  date: '2026-06-24', venue: 'Estadio BBVA, Guadalupe' },

  // ── GROUP B ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'B1', group: 'B', matchday: 1, homeTeamId: 'can', awayTeamId: 'bih',  date: '2026-06-12', venue: 'BMO Field, Toronto' },
  { id: 'B2', group: 'B', matchday: 1, homeTeamId: 'qat', awayTeamId: 'swi',  date: '2026-06-13', venue: "Levi's Stadium, Santa Clara" },
  // MD2
  { id: 'B3', group: 'B', matchday: 2, homeTeamId: 'swi', awayTeamId: 'bih',  date: '2026-06-18', venue: 'SoFi Stadium, Inglewood' },
  { id: 'B4', group: 'B', matchday: 2, homeTeamId: 'can', awayTeamId: 'qat',  date: '2026-06-18', venue: 'BC Place, Vancouver' },
  // MD3
  { id: 'B5', group: 'B', matchday: 3, homeTeamId: 'swi', awayTeamId: 'can',  date: '2026-06-24', venue: 'BC Place, Vancouver' },
  { id: 'B6', group: 'B', matchday: 3, homeTeamId: 'bih', awayTeamId: 'qat',  date: '2026-06-24', venue: 'Lumen Field, Seattle' },

  // ── GROUP C ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'C1', group: 'C', matchday: 1, homeTeamId: 'bra', awayTeamId: 'mor',  date: '2026-06-13', venue: 'MetLife Stadium, East Rutherford' },
  { id: 'C2', group: 'C', matchday: 1, homeTeamId: 'hai', awayTeamId: 'sco',  date: '2026-06-13', venue: 'Gillette Stadium, Foxborough' },
  // MD2
  { id: 'C3', group: 'C', matchday: 2, homeTeamId: 'sco', awayTeamId: 'mor',  date: '2026-06-19', venue: 'Gillette Stadium, Foxborough' },
  { id: 'C4', group: 'C', matchday: 2, homeTeamId: 'bra', awayTeamId: 'hai',  date: '2026-06-19', venue: 'Lincoln Financial Field, Philadelphia' },
  // MD3
  { id: 'C5', group: 'C', matchday: 3, homeTeamId: 'sco', awayTeamId: 'bra',  date: '2026-06-24', venue: 'Hard Rock Stadium, Miami Gardens' },
  { id: 'C6', group: 'C', matchday: 3, homeTeamId: 'mor', awayTeamId: 'hai',  date: '2026-06-24', venue: 'Mercedes-Benz Stadium, Atlanta' },

  // ── GROUP D ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'D1', group: 'D', matchday: 1, homeTeamId: 'usa', awayTeamId: 'par',  date: '2026-06-12', venue: 'SoFi Stadium, Inglewood' },
  { id: 'D2', group: 'D', matchday: 1, homeTeamId: 'aus', awayTeamId: 'tur',  date: '2026-06-13', venue: 'BC Place, Vancouver' },
  // MD2
  { id: 'D3', group: 'D', matchday: 2, homeTeamId: 'usa', awayTeamId: 'aus',  date: '2026-06-19', venue: 'Lumen Field, Seattle' },
  { id: 'D4', group: 'D', matchday: 2, homeTeamId: 'tur', awayTeamId: 'par',  date: '2026-06-19', venue: "Levi's Stadium, Santa Clara" },
  // MD3
  { id: 'D5', group: 'D', matchday: 3, homeTeamId: 'tur', awayTeamId: 'usa',  date: '2026-06-25', venue: 'SoFi Stadium, Inglewood' },
  { id: 'D6', group: 'D', matchday: 3, homeTeamId: 'par', awayTeamId: 'aus',  date: '2026-06-25', venue: "Levi's Stadium, Santa Clara" },

  // ── GROUP E ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'E1', group: 'E', matchday: 1, homeTeamId: 'ger', awayTeamId: 'cur',  date: '2026-06-14', venue: 'NRG Stadium, Houston' },
  { id: 'E2', group: 'E', matchday: 1, homeTeamId: 'civ', awayTeamId: 'ecua', date: '2026-06-14', venue: 'Lincoln Financial Field, Philadelphia' },
  // MD2
  { id: 'E3', group: 'E', matchday: 2, homeTeamId: 'ger', awayTeamId: 'civ',  date: '2026-06-20', venue: 'BMO Field, Toronto' },
  { id: 'E4', group: 'E', matchday: 2, homeTeamId: 'ecua', awayTeamId: 'cur', date: '2026-06-20', venue: 'Arrowhead Stadium, Kansas City' },
  // MD3
  { id: 'E5', group: 'E', matchday: 3, homeTeamId: 'cur', awayTeamId: 'civ',  date: '2026-06-25', venue: 'Lincoln Financial Field, Philadelphia' },
  { id: 'E6', group: 'E', matchday: 3, homeTeamId: 'ecua', awayTeamId: 'ger', date: '2026-06-25', venue: 'MetLife Stadium, East Rutherford' },

  // ── GROUP F ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'F1', group: 'F', matchday: 1, homeTeamId: 'ned', awayTeamId: 'jpn',  date: '2026-06-14', venue: 'AT&T Stadium, Arlington' },
  { id: 'F2', group: 'F', matchday: 1, homeTeamId: 'swe', awayTeamId: 'tun',  date: '2026-06-14', venue: 'Estadio BBVA, Guadalupe' },
  // MD2
  { id: 'F3', group: 'F', matchday: 2, homeTeamId: 'ned', awayTeamId: 'swe',  date: '2026-06-20', venue: 'NRG Stadium, Houston' },
  { id: 'F4', group: 'F', matchday: 2, homeTeamId: 'tun', awayTeamId: 'jpn',  date: '2026-06-20', venue: 'Estadio BBVA, Guadalupe' },
  // MD3
  { id: 'F5', group: 'F', matchday: 3, homeTeamId: 'jpn', awayTeamId: 'swe',  date: '2026-06-25', venue: 'AT&T Stadium, Arlington' },
  { id: 'F6', group: 'F', matchday: 3, homeTeamId: 'tun', awayTeamId: 'ned',  date: '2026-06-25', venue: 'Arrowhead Stadium, Kansas City' },

  // ── GROUP G ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'G1', group: 'G', matchday: 1, homeTeamId: 'bel', awayTeamId: 'egy',  date: '2026-06-15', venue: 'Lumen Field, Seattle' },
  { id: 'G2', group: 'G', matchday: 1, homeTeamId: 'iri', awayTeamId: 'nzl',  date: '2026-06-15', venue: 'SoFi Stadium, Inglewood' },
  // MD2
  { id: 'G3', group: 'G', matchday: 2, homeTeamId: 'bel', awayTeamId: 'iri',  date: '2026-06-21', venue: 'SoFi Stadium, Inglewood' },
  { id: 'G4', group: 'G', matchday: 2, homeTeamId: 'nzl', awayTeamId: 'egy',  date: '2026-06-21', venue: 'BC Place, Vancouver' },
  // MD3
  { id: 'G5', group: 'G', matchday: 3, homeTeamId: 'egy', awayTeamId: 'iri',  date: '2026-06-26', venue: 'Lumen Field, Seattle' },
  { id: 'G6', group: 'G', matchday: 3, homeTeamId: 'nzl', awayTeamId: 'bel',  date: '2026-06-26', venue: 'BC Place, Vancouver' },

  // ── GROUP H ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'H1', group: 'H', matchday: 1, homeTeamId: 'spa', awayTeamId: 'cpv',  date: '2026-06-15', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'H2', group: 'H', matchday: 1, homeTeamId: 'ksa', awayTeamId: 'uru',  date: '2026-06-15', venue: 'Hard Rock Stadium, Miami Gardens' },
  // MD2
  { id: 'H3', group: 'H', matchday: 2, homeTeamId: 'spa', awayTeamId: 'ksa',  date: '2026-06-21', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'H4', group: 'H', matchday: 2, homeTeamId: 'uru', awayTeamId: 'cpv',  date: '2026-06-21', venue: 'Hard Rock Stadium, Miami Gardens' },
  // MD3
  { id: 'H5', group: 'H', matchday: 3, homeTeamId: 'cpv', awayTeamId: 'ksa',  date: '2026-06-26', venue: 'NRG Stadium, Houston' },
  { id: 'H6', group: 'H', matchday: 3, homeTeamId: 'uru', awayTeamId: 'spa',  date: '2026-06-26', venue: 'Estadio Akron, Zapopan' },

  // ── GROUP I ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'I1', group: 'I', matchday: 1, homeTeamId: 'fra', awayTeamId: 'sen',  date: '2026-06-16', venue: 'MetLife Stadium, East Rutherford' },
  { id: 'I2', group: 'I', matchday: 1, homeTeamId: 'irq', awayTeamId: 'nor',  date: '2026-06-16', venue: 'Gillette Stadium, Foxborough' },
  // MD2
  { id: 'I3', group: 'I', matchday: 2, homeTeamId: 'fra', awayTeamId: 'irq',  date: '2026-06-22', venue: 'Lincoln Financial Field, Philadelphia' },
  { id: 'I4', group: 'I', matchday: 2, homeTeamId: 'nor', awayTeamId: 'sen',  date: '2026-06-22', venue: 'MetLife Stadium, East Rutherford' },
  // MD3
  { id: 'I5', group: 'I', matchday: 3, homeTeamId: 'nor', awayTeamId: 'fra',  date: '2026-06-26', venue: 'Gillette Stadium, Foxborough' },
  { id: 'I6', group: 'I', matchday: 3, homeTeamId: 'sen', awayTeamId: 'irq',  date: '2026-06-26', venue: 'BMO Field, Toronto' },

  // ── GROUP J ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'J1', group: 'J', matchday: 1, homeTeamId: 'arg', awayTeamId: 'alg',  date: '2026-06-16', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'J2', group: 'J', matchday: 1, homeTeamId: 'aut', awayTeamId: 'jor',  date: '2026-06-16', venue: "Levi's Stadium, Santa Clara" },
  // MD2
  { id: 'J3', group: 'J', matchday: 2, homeTeamId: 'arg', awayTeamId: 'aut',  date: '2026-06-22', venue: 'AT&T Stadium, Arlington' },
  { id: 'J4', group: 'J', matchday: 2, homeTeamId: 'jor', awayTeamId: 'alg',  date: '2026-06-22', venue: "Levi's Stadium, Santa Clara" },
  // MD3
  { id: 'J5', group: 'J', matchday: 3, homeTeamId: 'alg', awayTeamId: 'aut',  date: '2026-06-27', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'J6', group: 'J', matchday: 3, homeTeamId: 'jor', awayTeamId: 'arg',  date: '2026-06-27', venue: 'AT&T Stadium, Arlington' },

  // ── GROUP K ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'K1', group: 'K', matchday: 1, homeTeamId: 'por', awayTeamId: 'cod',  date: '2026-06-17', venue: 'NRG Stadium, Houston' },
  { id: 'K2', group: 'K', matchday: 1, homeTeamId: 'uzb', awayTeamId: 'col',  date: '2026-06-17', venue: 'Estadio Azteca, Mexico City' },
  // MD2
  { id: 'K3', group: 'K', matchday: 2, homeTeamId: 'por', awayTeamId: 'uzb',  date: '2026-06-23', venue: 'NRG Stadium, Houston' },
  { id: 'K4', group: 'K', matchday: 2, homeTeamId: 'col', awayTeamId: 'cod',  date: '2026-06-23', venue: 'Estadio Akron, Zapopan' },
  // MD3
  { id: 'K5', group: 'K', matchday: 3, homeTeamId: 'col', awayTeamId: 'por',  date: '2026-06-27', venue: 'Hard Rock Stadium, Miami Gardens' },
  { id: 'K6', group: 'K', matchday: 3, homeTeamId: 'cod', awayTeamId: 'uzb',  date: '2026-06-27', venue: 'Mercedes-Benz Stadium, Atlanta' },

  // ── GROUP L ──────────────────────────────────────────────────────────────
  // MD1
  { id: 'L1', group: 'L', matchday: 1, homeTeamId: 'eng', awayTeamId: 'cro',  date: '2026-06-17', venue: 'AT&T Stadium, Arlington' },
  { id: 'L2', group: 'L', matchday: 1, homeTeamId: 'gha', awayTeamId: 'pan',  date: '2026-06-17', venue: 'BMO Field, Toronto' },
  // MD2
  { id: 'L3', group: 'L', matchday: 2, homeTeamId: 'eng', awayTeamId: 'gha',  date: '2026-06-23', venue: 'Gillette Stadium, Foxborough' },
  { id: 'L4', group: 'L', matchday: 2, homeTeamId: 'pan', awayTeamId: 'cro',  date: '2026-06-23', venue: 'BMO Field, Toronto' },
  // MD3
  { id: 'L5', group: 'L', matchday: 3, homeTeamId: 'pan', awayTeamId: 'eng',  date: '2026-06-27', venue: 'MetLife Stadium, East Rutherford' },
  { id: 'L6', group: 'L', matchday: 3, homeTeamId: 'cro', awayTeamId: 'gha',  date: '2026-06-27', venue: 'Lincoln Financial Field, Philadelphia' },
];

export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

export function fixturesByGroup(group: string): Fixture[] {
  return GROUP_FIXTURES.filter((f) => f.group === group);
}
