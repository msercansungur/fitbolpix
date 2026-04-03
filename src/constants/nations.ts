import { Team } from '../types/simulator';

// All 48 WC2026 qualified nations — groups from the official FIFA draw
// Strength ratings are FIFA ranking-based approximations (0–100 scale)
export const NATIONS: Team[] = [
  // ── GROUP A ──────────────────────────────────────────────────────────────
  { id: 'mex', name: 'Mexico',               flag: '🇲🇽', strength: 73, group: 'A' },
  { id: 'rsa', name: 'South Africa',         flag: '🇿🇦', strength: 62, group: 'A' },
  { id: 'kor', name: 'South Korea',          flag: '🇰🇷', strength: 73, group: 'A' },
  { id: 'cze', name: 'Czech Republic',       flag: '🇨🇿', strength: 72, group: 'A' },

  // ── GROUP B ──────────────────────────────────────────────────────────────
  { id: 'can', name: 'Canada',               flag: '🇨🇦', strength: 70, group: 'B' },
  { id: 'bih', name: 'Bosnia & Herzegovina', flag: '🇧🇦', strength: 68, group: 'B' },
  { id: 'qat', name: 'Qatar',                flag: '🇶🇦', strength: 62, group: 'B' },
  { id: 'swi', name: 'Switzerland',          flag: '🇨🇭', strength: 78, group: 'B' },

  // ── GROUP C ──────────────────────────────────────────────────────────────
  { id: 'bra', name: 'Brazil',               flag: '🇧🇷', strength: 88, group: 'C' },
  { id: 'mor', name: 'Morocco',              flag: '🇲🇦', strength: 78, group: 'C' },
  { id: 'hai', name: 'Haiti',                flag: '🇭🇹', strength: 55, group: 'C' },
  { id: 'sco', name: 'Scotland',             flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', strength: 72, group: 'C' },

  // ── GROUP D ──────────────────────────────────────────────────────────────
  { id: 'usa', name: 'USA',                  flag: '🇺🇸', strength: 74, group: 'D' },
  { id: 'par', name: 'Paraguay',             flag: '🇵🇾', strength: 68, group: 'D' },
  { id: 'aus', name: 'Australia',            flag: '🇦🇺', strength: 68, group: 'D' },
  { id: 'tur', name: 'Türkiye',              flag: '🇹🇷', strength: 76, group: 'D' },

  // ── GROUP E ──────────────────────────────────────────────────────────────
  { id: 'ger', name: 'Germany',              flag: '🇩🇪', strength: 84, group: 'E' },
  { id: 'cur', name: 'Curaçao',              flag: '🇨🇼', strength: 55, group: 'E' },
  { id: 'civ', name: 'Ivory Coast',          flag: '🇨🇮', strength: 72, group: 'E' },
  { id: 'ecua', name: 'Ecuador',             flag: '🇪🇨', strength: 69, group: 'E' },

  // ── GROUP F ──────────────────────────────────────────────────────────────
  { id: 'ned', name: 'Netherlands',          flag: '🇳🇱', strength: 83, group: 'F' },
  { id: 'jpn', name: 'Japan',                flag: '🇯🇵', strength: 76, group: 'F' },
  { id: 'swe', name: 'Sweden',               flag: '🇸🇪', strength: 74, group: 'F' },
  { id: 'tun', name: 'Tunisia',              flag: '🇹🇳', strength: 65, group: 'F' },

  // ── GROUP G ──────────────────────────────────────────────────────────────
  { id: 'bel', name: 'Belgium',              flag: '🇧🇪', strength: 82, group: 'G' },
  { id: 'egy', name: 'Egypt',                flag: '🇪🇬', strength: 65, group: 'G' },
  { id: 'iri', name: 'Iran',                 flag: '🇮🇷', strength: 68, group: 'G' },
  { id: 'nzl', name: 'New Zealand',          flag: '🇳🇿', strength: 58, group: 'G' },

  // ── GROUP H ──────────────────────────────────────────────────────────────
  { id: 'spa', name: 'Spain',                flag: '🇪🇸', strength: 86, group: 'H' },
  { id: 'cpv', name: 'Cape Verde',           flag: '🇨🇻', strength: 63, group: 'H' },
  { id: 'ksa', name: 'Saudi Arabia',         flag: '🇸🇦', strength: 66, group: 'H' },
  { id: 'uru', name: 'Uruguay',              flag: '🇺🇾', strength: 79, group: 'H' },

  // ── GROUP I ──────────────────────────────────────────────────────────────
  { id: 'fra', name: 'France',               flag: '🇫🇷', strength: 87, group: 'I' },
  { id: 'sen', name: 'Senegal',              flag: '🇸🇳', strength: 75, group: 'I' },
  { id: 'irq', name: 'Iraq',                 flag: '🇮🇶', strength: 60, group: 'I' },
  { id: 'nor', name: 'Norway',               flag: '🇳🇴', strength: 75, group: 'I' },

  // ── GROUP J ──────────────────────────────────────────────────────────────
  { id: 'arg', name: 'Argentina',            flag: '🇦🇷', strength: 91, group: 'J' },
  { id: 'alg', name: 'Algeria',              flag: '🇩🇿', strength: 70, group: 'J' },
  { id: 'aut', name: 'Austria',              flag: '🇦🇹', strength: 74, group: 'J' },
  { id: 'jor', name: 'Jordan',               flag: '🇯🇴', strength: 58, group: 'J' },

  // ── GROUP K ──────────────────────────────────────────────────────────────
  { id: 'por', name: 'Portugal',             flag: '🇵🇹', strength: 84, group: 'K' },
  { id: 'cod', name: 'DR Congo',             flag: '🇨🇩', strength: 63, group: 'K' },
  { id: 'uzb', name: 'Uzbekistan',           flag: '🇺🇿', strength: 60, group: 'K' },
  { id: 'col', name: 'Colombia',             flag: '🇨🇴', strength: 78, group: 'K' },

  // ── GROUP L ──────────────────────────────────────────────────────────────
  { id: 'eng', name: 'England',              flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', strength: 85, group: 'L' },
  { id: 'cro', name: 'Croatia',              flag: '🇭🇷', strength: 80, group: 'L' },
  { id: 'gha', name: 'Ghana',                flag: '🇬🇭', strength: 66, group: 'L' },
  { id: 'pan', name: 'Panama',               flag: '🇵🇦', strength: 63, group: 'L' },
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
