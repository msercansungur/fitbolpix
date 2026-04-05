import { FOOTBALL_API_KEY, FOOTBALL_API_BASE, WC2026_LEAGUE_ID, WC2026_SEASON } from '../constants/apiConfig';
import { GROUP_FIXTURES } from '../constants/fixtures';

export interface LiveResult {
  homeScore: number;
  awayScore: number;
  // Short status from API: NS, 1H, HT, 2H, ET, PEN, FT, AET, etc.
  status: string;
  // Elapsed minutes when live, null otherwise
  elapsed: number | null;
}

// ─── Name normalisation map ───────────────────────────────────────────────────
// API-Football may return different names than our local data.
// Map API name → our nation id.
const API_NAME_TO_ID: Record<string, string> = {
  // Common variations
  'Ivory Coast':         'civ',
  "Côte d'Ivoire":       'civ',
  'Cote d\'Ivoire':      'civ',
  'South Korea':         'kor',
  'Korea Republic':      'kor',
  'USA':                 'usa',
  'United States':       'usa',
  'Bosnia':              'bih',
  'Bosnia And Herzegovina': 'bih',
  'Bosnia and Herzegovina': 'bih',
  'Bosnia & Herzegovina': 'bih',
  'DR Congo':            'cod',
  'Congo DR':            'cod',
  'Congo':               'cod',
  'New Zealand':         'nzl',
  'Iran':                'iri',
  'IR Iran':             'iri',
  'Turkey':              'tur',
  'Türkiye':             'tur',
  'Cape Verde':          'cpv',
  'Saudi Arabia':        'ksa',
  'Czech Republic':      'cze',
  'Czechia':             'cze',
  'South Africa':        'rsa',
  'Qatar':               'qat',
  'Switzerland':         'swi',
  'Brazil':              'bra',
  'Morocco':             'mor',
  'Haiti':               'hai',
  'Scotland':            'sco',
  'Paraguay':            'par',
  'Australia':           'aus',
  'Germany':             'ger',
  'Curaçao':             'cur',
  'Curacao':             'cur',
  'Ecuador':             'ecua',
  'Netherlands':         'ned',
  'Japan':               'jpn',
  'Sweden':              'swe',
  'Tunisia':             'tun',
  'Belgium':             'bel',
  'Egypt':               'egy',
  'Spain':               'spa',
  'Uruguay':             'uru',
  'France':              'fra',
  'Senegal':             'sen',
  'Iraq':                'irq',
  'Norway':              'nor',
  'Argentina':           'arg',
  'Algeria':             'alg',
  'Austria':             'aut',
  'Jordan':              'jor',
  'Portugal':            'por',
  'Uzbekistan':          'uzb',
  'Colombia':            'col',
  'England':             'eng',
  'Croatia':             'cro',
  'Ghana':               'gha',
  'Panama':              'pan',
  'Mexico':              'mex',
  'Canada':              'can',
};

// Build a reverse-lookup: our fixture id → { homeId, awayId } for matching
const FIXTURE_TEAM_PAIRS: Array<{ id: string; homeId: string; awayId: string }> =
  GROUP_FIXTURES.map((f) => ({ id: f.id, homeId: f.homeTeamId, awayId: f.awayTeamId }));

function resolveTeamId(apiName: string): string | null {
  return API_NAME_TO_ID[apiName] ?? null;
}

// Match an API fixture to our local fixture ID by home+away team IDs
function matchToLocalId(homeId: string | null, awayId: string | null): string | null {
  if (!homeId || !awayId) return null;
  const found = FIXTURE_TEAM_PAIRS.find(
    (p) => p.homeId === homeId && p.awayId === awayId,
  );
  return found?.id ?? null;
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchLiveResults(): Promise<Record<string, LiveResult>> {
  if (!FOOTBALL_API_KEY) {
    // No key configured — return empty gracefully
    return {};
  }

  const url = `${FOOTBALL_API_BASE}/fixtures?league=${WC2026_LEAGUE_ID}&season=${WC2026_SEASON}`;

  let data: any;
  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': FOOTBALL_API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    });
    if (!response.ok) return {};
    data = await response.json();
  } catch {
    return {};
  }

  if (!Array.isArray(data?.response)) return {};

  const mapped: Record<string, LiveResult> = {};

  for (const item of data.response) {
    const homeApiName: string = item?.teams?.home?.name ?? '';
    const awayApiName: string = item?.teams?.away?.name ?? '';
    const homeId = resolveTeamId(homeApiName);
    const awayId = resolveTeamId(awayApiName);
    const localId = matchToLocalId(homeId, awayId);
    if (!localId) continue;

    const status: string  = item?.fixture?.status?.short ?? 'NS';
    const elapsed: number | null = item?.fixture?.status?.elapsed ?? null;
    const homeScore: number = item?.goals?.home ?? 0;
    const awayScore: number = item?.goals?.away ?? 0;

    mapped[localId] = { homeScore, awayScore, status, elapsed };
  }

  return mapped;
}
