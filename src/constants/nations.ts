import { Team } from '../types/simulator';

// All 48 WC2026 qualified nations — groups from the official FIFA draw
// strength: FIFA ranking-based approximations (0–100)
// penalty_skill: higher = slower accuracy ring = easier for player (0–100)
// goalkeeper_rating: penalty save ability (0–100)
export const NATIONS: Team[] = [
  // ── GROUP A ──────────────────────────────────────────────────────────────
  { id: 'mex', name: 'Mexico',               flag: '🇲🇽', strength: 73, group: 'A', penalty_skill: 68, goalkeeper_rating: 66 },
  { id: 'rsa', name: 'South Africa',         flag: '🇿🇦', strength: 62, group: 'A', penalty_skill: 58, goalkeeper_rating: 55 },
  { id: 'kor', name: 'South Korea',          flag: '🇰🇷', strength: 73, group: 'A', penalty_skill: 65, goalkeeper_rating: 64 },
  { id: 'cze', name: 'Czech Republic',       flag: '🇨🇿', strength: 72, group: 'A', penalty_skill: 70, goalkeeper_rating: 68 },

  // ── GROUP B ──────────────────────────────────────────────────────────────
  { id: 'can', name: 'Canada',               flag: '🇨🇦', strength: 70, group: 'B', penalty_skill: 62, goalkeeper_rating: 63 },
  { id: 'bih', name: 'Bosnia & Herzegovina', flag: '🇧🇦', strength: 68, group: 'B', penalty_skill: 66, goalkeeper_rating: 62 },
  { id: 'qat', name: 'Qatar',                flag: '🇶🇦', strength: 62, group: 'B', penalty_skill: 55, goalkeeper_rating: 58 },
  { id: 'swi', name: 'Switzerland',          flag: '🇨🇭', strength: 78, group: 'B', penalty_skill: 74, goalkeeper_rating: 73 },

  // ── GROUP C ──────────────────────────────────────────────────────────────
  { id: 'bra', name: 'Brazil',               flag: '🇧🇷', strength: 88, group: 'C', penalty_skill: 82, goalkeeper_rating: 80 },
  { id: 'mor', name: 'Morocco',              flag: '🇲🇦', strength: 78, group: 'C', penalty_skill: 70, goalkeeper_rating: 74 },
  { id: 'hai', name: 'Haiti',                flag: '🇭🇹', strength: 55, group: 'C', penalty_skill: 50, goalkeeper_rating: 48 },
  { id: 'sco', name: 'Scotland',             flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', strength: 72, group: 'C', penalty_skill: 60, goalkeeper_rating: 67 },

  // ── GROUP D ──────────────────────────────────────────────────────────────
  { id: 'usa', name: 'USA',                  flag: '🇺🇸', strength: 74, group: 'D', penalty_skill: 63, goalkeeper_rating: 68 },
  { id: 'par', name: 'Paraguay',             flag: '🇵🇾', strength: 68, group: 'D', penalty_skill: 67, goalkeeper_rating: 62 },
  { id: 'aus', name: 'Australia',            flag: '🇦🇺', strength: 68, group: 'D', penalty_skill: 61, goalkeeper_rating: 63 },
  { id: 'tur', name: 'Türkiye',              flag: '🇹🇷', strength: 76, group: 'D', penalty_skill: 77, goalkeeper_rating: 72 },

  // ── GROUP E ──────────────────────────────────────────────────────────────
  { id: 'ger', name: 'Germany',              flag: '🇩🇪', strength: 84, group: 'E', penalty_skill: 85, goalkeeper_rating: 82 },
  { id: 'cur', name: 'Curaçao',              flag: '🇨🇼', strength: 55, group: 'E', penalty_skill: 52, goalkeeper_rating: 50 },
  { id: 'civ', name: 'Ivory Coast',          flag: '🇨🇮', strength: 72, group: 'E', penalty_skill: 66, goalkeeper_rating: 63 },
  { id: 'ecua', name: 'Ecuador',             flag: '🇪🇨', strength: 69, group: 'E', penalty_skill: 64, goalkeeper_rating: 61 },

  // ── GROUP F ──────────────────────────────────────────────────────────────
  { id: 'ned', name: 'Netherlands',          flag: '🇳🇱', strength: 83, group: 'F', penalty_skill: 78, goalkeeper_rating: 80 },
  { id: 'jpn', name: 'Japan',                flag: '🇯🇵', strength: 76, group: 'F', penalty_skill: 72, goalkeeper_rating: 70 },
  { id: 'swe', name: 'Sweden',               flag: '🇸🇪', strength: 74, group: 'F', penalty_skill: 71, goalkeeper_rating: 69 },
  { id: 'tun', name: 'Tunisia',              flag: '🇹🇳', strength: 65, group: 'F', penalty_skill: 60, goalkeeper_rating: 60 },

  // ── GROUP G ──────────────────────────────────────────────────────────────
  { id: 'bel', name: 'Belgium',              flag: '🇧🇪', strength: 82, group: 'G', penalty_skill: 76, goalkeeper_rating: 74 },
  { id: 'egy', name: 'Egypt',                flag: '🇪🇬', strength: 65, group: 'G', penalty_skill: 63, goalkeeper_rating: 65 },
  { id: 'iri', name: 'Iran',                 flag: '🇮🇷', strength: 68, group: 'G', penalty_skill: 62, goalkeeper_rating: 64 },
  { id: 'nzl', name: 'New Zealand',          flag: '🇳🇿', strength: 58, group: 'G', penalty_skill: 54, goalkeeper_rating: 55 },

  // ── GROUP H ──────────────────────────────────────────────────────────────
  { id: 'spa', name: 'Spain',                flag: '🇪🇸', strength: 86, group: 'H', penalty_skill: 80, goalkeeper_rating: 83 },
  { id: 'cpv', name: 'Cape Verde',           flag: '🇨🇻', strength: 63, group: 'H', penalty_skill: 58, goalkeeper_rating: 57 },
  { id: 'ksa', name: 'Saudi Arabia',         flag: '🇸🇦', strength: 66, group: 'H', penalty_skill: 60, goalkeeper_rating: 61 },
  { id: 'uru', name: 'Uruguay',              flag: '🇺🇾', strength: 79, group: 'H', penalty_skill: 75, goalkeeper_rating: 72 },

  // ── GROUP I ──────────────────────────────────────────────────────────────
  { id: 'fra', name: 'France',               flag: '🇫🇷', strength: 87, group: 'I', penalty_skill: 84, goalkeeper_rating: 86 },
  { id: 'sen', name: 'Senegal',              flag: '🇸🇳', strength: 75, group: 'I', penalty_skill: 70, goalkeeper_rating: 68 },
  { id: 'irq', name: 'Iraq',                 flag: '🇮🇶', strength: 60, group: 'I', penalty_skill: 56, goalkeeper_rating: 55 },
  { id: 'nor', name: 'Norway',               flag: '🇳🇴', strength: 75, group: 'I', penalty_skill: 72, goalkeeper_rating: 70 },

  // ── GROUP J ──────────────────────────────────────────────────────────────
  { id: 'arg', name: 'Argentina',            flag: '🇦🇷', strength: 91, group: 'J', penalty_skill: 90, goalkeeper_rating: 86 },
  { id: 'alg', name: 'Algeria',              flag: '🇩🇿', strength: 70, group: 'J', penalty_skill: 65, goalkeeper_rating: 62 },
  { id: 'aut', name: 'Austria',              flag: '🇦🇹', strength: 74, group: 'J', penalty_skill: 68, goalkeeper_rating: 67 },
  { id: 'jor', name: 'Jordan',               flag: '🇯🇴', strength: 58, group: 'J', penalty_skill: 54, goalkeeper_rating: 53 },

  // ── GROUP K ──────────────────────────────────────────────────────────────
  { id: 'por', name: 'Portugal',             flag: '🇵🇹', strength: 84, group: 'K', penalty_skill: 86, goalkeeper_rating: 79 },
  { id: 'cod', name: 'DR Congo',             flag: '🇨🇩', strength: 63, group: 'K', penalty_skill: 59, goalkeeper_rating: 57 },
  { id: 'uzb', name: 'Uzbekistan',           flag: '🇺🇿', strength: 60, group: 'K', penalty_skill: 55, goalkeeper_rating: 54 },
  { id: 'col', name: 'Colombia',             flag: '🇨🇴', strength: 78, group: 'K', penalty_skill: 73, goalkeeper_rating: 70 },

  // ── GROUP L ──────────────────────────────────────────────────────────────
  { id: 'eng', name: 'England',              flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', strength: 85, group: 'L', penalty_skill: 52, goalkeeper_rating: 78 },
  { id: 'cro', name: 'Croatia',              flag: '🇭🇷', strength: 80, group: 'L', penalty_skill: 74, goalkeeper_rating: 73 },
  { id: 'gha', name: 'Ghana',                flag: '🇬🇭', strength: 66, group: 'L', penalty_skill: 61, goalkeeper_rating: 60 },
  { id: 'pan', name: 'Panama',               flag: '🇵🇦', strength: 63, group: 'L', penalty_skill: 57, goalkeeper_rating: 58 },
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
