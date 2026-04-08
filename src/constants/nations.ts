import { Team } from '../types/simulator';

// All 48 WC2026 qualified nations — groups from the official FIFA draw
// strength: ELO rating
// penalty_skill: higher = slower accuracy ring = easier for player (0–100)
// goalkeeper_rating: penalty save ability (0–100)
// isoCode: ISO alpha-2 for react-native-circle-flags
// code3: 3-char display code
// formation: default tactical formation
export const NATIONS: Team[] = [
  // ── GROUP A ──────────────────────────────────────────────────────────────
  { id: 'mex',  name: 'Mexico',               flag: '🇲🇽', isoCode: 'mx',     code3: 'MEX', strength: 1677, group: 'A', penalty_skill: 68, goalkeeper_rating: 66, formation: '4-4-2' },
  { id: 'rsa',  name: 'South Africa',         flag: '🇿🇦', isoCode: 'za',     code3: 'RSA', strength: 1440, group: 'A', penalty_skill: 58, goalkeeper_rating: 55, formation: '4-2-3-1' },
  { id: 'kor',  name: 'South Korea',          flag: '🇰🇷', isoCode: 'kr',     code3: 'KOR', strength: 1599, group: 'A', penalty_skill: 65, goalkeeper_rating: 64, formation: '4-4-2' },
  { id: 'cze',  name: 'Czech Republic',       flag: '🇨🇿', isoCode: 'cz',     code3: 'CZE', strength: 1532, group: 'A', penalty_skill: 70, goalkeeper_rating: 68, formation: '3-5-2' },

  // ── GROUP B ──────────────────────────────────────────────────────────────
  { id: 'can',  name: 'Canada',               flag: '🇨🇦', isoCode: 'ca',     code3: 'CAN', strength: 1559, group: 'B', penalty_skill: 62, goalkeeper_rating: 63, formation: '4-4-2' },
  { id: 'bih',  name: 'Bosnia & Herzegovina', flag: '🇧🇦', isoCode: 'ba',     code3: 'BIH', strength: 1490, group: 'B', penalty_skill: 66, goalkeeper_rating: 62, formation: '4-2-3-1' },
  { id: 'qat',  name: 'Qatar',                flag: '🇶🇦', isoCode: 'qa',     code3: 'QAT', strength: 1420, group: 'B', penalty_skill: 55, goalkeeper_rating: 58, formation: '3-5-2' },
  { id: 'swi',  name: 'Switzerland',          flag: '🇨🇭', isoCode: 'ch',     code3: 'SUI', strength: 1650, group: 'B', penalty_skill: 74, goalkeeper_rating: 73, formation: '4-4-2' },

  // ── GROUP C ──────────────────────────────────────────────────────────────
  { id: 'bra',  name: 'Brazil',               flag: '🇧🇷', isoCode: 'br',     code3: 'BRA', strength: 1761, group: 'C', penalty_skill: 82, goalkeeper_rating: 80, formation: '4-3-3' },
  { id: 'mor',  name: 'Morocco',              flag: '🇲🇦', isoCode: 'ma',     code3: 'MAR', strength: 1737, group: 'C', penalty_skill: 70, goalkeeper_rating: 74, formation: '4-3-3' },
  { id: 'hai',  name: 'Haiti',                flag: '🇭🇹', isoCode: 'ht',     code3: 'HAI', strength: 1350, group: 'C', penalty_skill: 50, goalkeeper_rating: 48, formation: '4-2-3-1' },
  { id: 'sco',  name: 'Scotland',             flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', isoCode: 'gb-sct', code3: 'SCO', strength: 1498, group: 'C', penalty_skill: 60, goalkeeper_rating: 67, formation: '3-5-2' },

  // ── GROUP D ──────────────────────────────────────────────────────────────
  { id: 'usa',  name: 'USA',                  flag: '🇺🇸', isoCode: 'us',     code3: 'USA', strength: 1673, group: 'D', penalty_skill: 63, goalkeeper_rating: 68, formation: '4-4-2' },
  { id: 'par',  name: 'Paraguay',             flag: '🇵🇾', isoCode: 'py',     code3: 'PAR', strength: 1502, group: 'D', penalty_skill: 67, goalkeeper_rating: 62, formation: '4-2-3-1' },
  { id: 'aus',  name: 'Australia',            flag: '🇦🇺', isoCode: 'au',     code3: 'AUS', strength: 1574, group: 'D', penalty_skill: 61, goalkeeper_rating: 63, formation: '4-4-2' },
  { id: 'tur',  name: 'Türkiye',              flag: '🇹🇷', isoCode: 'tr',     code3: 'TUR', strength: 1606, group: 'D', penalty_skill: 77, goalkeeper_rating: 72, formation: '4-2-3-1' },

  // ── GROUP E ──────────────────────────────────────────────────────────────
  { id: 'ger',  name: 'Germany',              flag: '🇩🇪', isoCode: 'de',     code3: 'GER', strength: 1730, group: 'E', penalty_skill: 85, goalkeeper_rating: 82, formation: '4-2-3-1' },
  { id: 'cur',  name: 'Curaçao',              flag: '🇨🇼', isoCode: 'cw',     code3: 'CUW', strength: 1380, group: 'E', penalty_skill: 52, goalkeeper_rating: 50, formation: '3-5-2' },
  { id: 'civ',  name: 'Ivory Coast',          flag: '🇨🇮', isoCode: 'ci',     code3: 'CIV', strength: 1527, group: 'E', penalty_skill: 66, goalkeeper_rating: 63, formation: '4-2-3-1' },
  { id: 'ecua', name: 'Ecuador',              flag: '🇪🇨', isoCode: 'ec',     code3: 'ECU', strength: 1592, group: 'E', penalty_skill: 64, goalkeeper_rating: 61, formation: '4-4-2' },

  // ── GROUP F ──────────────────────────────────────────────────────────────
  { id: 'ned',  name: 'Netherlands',          flag: '🇳🇱', isoCode: 'nl',     code3: 'NED', strength: 1756, group: 'F', penalty_skill: 78, goalkeeper_rating: 80, formation: '4-3-3' },
  { id: 'jpn',  name: 'Japan',                flag: '🇯🇵', isoCode: 'jp',     code3: 'JPN', strength: 1660, group: 'F', penalty_skill: 72, goalkeeper_rating: 70, formation: '4-4-2' },
  { id: 'swe',  name: 'Sweden',               flag: '🇸🇪', isoCode: 'se',     code3: 'SWE', strength: 1565, group: 'F', penalty_skill: 71, goalkeeper_rating: 69, formation: '4-4-2' },
  { id: 'tun',  name: 'Tunisia',              flag: '🇹🇳', isoCode: 'tn',     code3: 'TUN', strength: 1510, group: 'F', penalty_skill: 60, goalkeeper_rating: 60, formation: '3-5-2' },

  // ── GROUP G ──────────────────────────────────────────────────────────────
  { id: 'bel',  name: 'Belgium',              flag: '🇧🇪', isoCode: 'be',     code3: 'BEL', strength: 1735, group: 'G', penalty_skill: 76, goalkeeper_rating: 74, formation: '4-3-3' },
  { id: 'egy',  name: 'Egypt',                flag: '🇪🇬', isoCode: 'eg',     code3: 'EGY', strength: 1559, group: 'G', penalty_skill: 63, goalkeeper_rating: 65, formation: '4-4-2' },
  { id: 'iri',  name: 'Iran',                 flag: '🇮🇷', isoCode: 'ir',     code3: 'IRN', strength: 1617, group: 'G', penalty_skill: 62, goalkeeper_rating: 64, formation: '4-4-2' },
  { id: 'nzl',  name: 'New Zealand',          flag: '🇳🇿', isoCode: 'nz',     code3: 'NZL', strength: 1279, group: 'G', penalty_skill: 54, goalkeeper_rating: 55, formation: '4-2-3-1' },

  // ── GROUP H ──────────────────────────────────────────────────────────────
  { id: 'spa',  name: 'Spain',                flag: '🇪🇸', isoCode: 'es',     code3: 'ESP', strength: 1876, group: 'H', penalty_skill: 80, goalkeeper_rating: 83, formation: '4-3-3' },
  { id: 'cpv',  name: 'Cape Verde',           flag: '🇨🇻', isoCode: 'cv',     code3: 'CPV', strength: 1485, group: 'H', penalty_skill: 58, goalkeeper_rating: 57, formation: '3-5-2' },
  { id: 'ksa',  name: 'Saudi Arabia',         flag: '🇸🇦', isoCode: 'sa',     code3: 'KSA', strength: 1460, group: 'H', penalty_skill: 60, goalkeeper_rating: 61, formation: '4-2-3-1' },
  { id: 'uru',  name: 'Uruguay',              flag: '🇺🇾', isoCode: 'uy',     code3: 'URU', strength: 1672, group: 'H', penalty_skill: 75, goalkeeper_rating: 72, formation: '4-4-2' },

  // ── GROUP I ──────────────────────────────────────────────────────────────
  { id: 'fra',  name: 'France',               flag: '🇫🇷', isoCode: 'fr',     code3: 'FRA', strength: 1877, group: 'I', penalty_skill: 84, goalkeeper_rating: 86, formation: '4-3-3' },
  { id: 'sen',  name: 'Senegal',              flag: '🇸🇳', isoCode: 'sn',     code3: 'SEN', strength: 1711, group: 'I', penalty_skill: 70, goalkeeper_rating: 68, formation: '4-3-3' },
  { id: 'irq',  name: 'Iraq',                 flag: '🇮🇶', isoCode: 'iq',     code3: 'IRQ', strength: 1445, group: 'I', penalty_skill: 56, goalkeeper_rating: 55, formation: '4-2-3-1' },
  { id: 'nor',  name: 'Norway',               flag: '🇳🇴', isoCode: 'no',     code3: 'NOR', strength: 1553, group: 'I', penalty_skill: 72, goalkeeper_rating: 70, formation: '4-4-2' },

  // ── GROUP J ──────────────────────────────────────────────────────────────
  { id: 'arg',  name: 'Argentina',            flag: '🇦🇷', isoCode: 'ar',     code3: 'ARG', strength: 1875, group: 'J', penalty_skill: 90, goalkeeper_rating: 86, formation: '4-3-3' },
  { id: 'alg',  name: 'Algeria',              flag: '🇩🇿', isoCode: 'dz',     code3: 'ALG', strength: 1564, group: 'J', penalty_skill: 65, goalkeeper_rating: 62, formation: '4-4-2' },
  { id: 'aut',  name: 'Austria',              flag: '🇦🇹', isoCode: 'at',     code3: 'AUT', strength: 1588, group: 'J', penalty_skill: 68, goalkeeper_rating: 67, formation: '4-4-2' },
  { id: 'jor',  name: 'Jordan',               flag: '🇯🇴', isoCode: 'jo',     code3: 'JOR', strength: 1410, group: 'J', penalty_skill: 54, goalkeeper_rating: 53, formation: '3-5-2' },

  // ── GROUP K ──────────────────────────────────────────────────────────────
  { id: 'por',  name: 'Portugal',             flag: '🇵🇹', isoCode: 'pt',     code3: 'POR', strength: 1765, group: 'K', penalty_skill: 86, goalkeeper_rating: 79, formation: '4-3-3' },
  { id: 'cod',  name: 'DR Congo',             flag: '🇨🇩', isoCode: 'cd',     code3: 'COD', strength: 1450, group: 'K', penalty_skill: 59, goalkeeper_rating: 57, formation: '4-2-3-1' },
  { id: 'uzb',  name: 'Uzbekistan',           flag: '🇺🇿', isoCode: 'uz',     code3: 'UZB', strength: 1375, group: 'K', penalty_skill: 55, goalkeeper_rating: 54, formation: '3-5-2' },
  { id: 'col',  name: 'Colombia',             flag: '🇨🇴', isoCode: 'co',     code3: 'COL', strength: 1693, group: 'K', penalty_skill: 73, goalkeeper_rating: 70, formation: '4-4-2' },

  // ── GROUP L ──────────────────────────────────────────────────────────────
  { id: 'eng',  name: 'England',              flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', isoCode: 'gb-eng', code3: 'ENG', strength: 1827, group: 'L', penalty_skill: 52, goalkeeper_rating: 78, formation: '4-2-3-1' },
  { id: 'cro',  name: 'Croatia',              flag: '🇭🇷', isoCode: 'hr',     code3: 'CRO', strength: 1717, group: 'L', penalty_skill: 74, goalkeeper_rating: 73, formation: '4-3-3' },
  { id: 'gha',  name: 'Ghana',                flag: '🇬🇭', isoCode: 'gh',     code3: 'GHA', strength: 1490, group: 'L', penalty_skill: 61, goalkeeper_rating: 60, formation: '4-2-3-1' },
  { id: 'pan',  name: 'Panama',               flag: '🇵🇦', isoCode: 'pa',     code3: 'PAN', strength: 1542, group: 'L', penalty_skill: 57, goalkeeper_rating: 58, formation: '3-5-2' },
];

// Lookup helpers
export const NATIONS_BY_ID: Record<string, Team> = Object.fromEntries(
  NATIONS.map((t) => [t.id, t]),
);

export const NATIONS_BY_GROUP: Record<string, Team[]> = NATIONS.reduce<Record<string, Team[]>>(
  (acc, t) => {
    if (!acc[t.group]) acc[t.group] = [];
    acc[t.group].push(t);
    return acc;
  },
  {},
);
