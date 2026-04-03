export interface Fixture {
  id: string;
  group: string;          // 'A'–'L'
  matchday: 1 | 2 | 3;
  homeTeamId: string;
  awayTeamId: string;
  date: string;           // ISO 8601: '2026-06-12'
  venue: string;          // 'Estadio Azteca, Mexico City'
}
