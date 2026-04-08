import { NATIONS_BY_ID } from '../constants/nations';

/**
 * Check if two hex kit colors are too similar to distinguish visually.
 * Returns true if all RGB channels are within `threshold` of each other.
 */
export function areColorsSimilar(c1: number, c2: number, threshold = 40): boolean {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  return Math.abs(r1 - r2) < threshold && Math.abs(g1 - g2) < threshold && Math.abs(b1 - b2) < threshold;
}

/**
 * Resolve kit colors for a home vs away matchup.
 * If primary colors clash, the away team switches to their altKitColor.
 */
export function resolveKitColors(
  homeId: string,
  awayId: string,
  kitColors: Record<string, number>,
): { homeColor: number; awayColor: number } {
  const homeColor = kitColors[homeId] ?? 0x2196f3;
  const awayColor = kitColors[awayId] ?? 0xf44336;
  if (areColorsSimilar(homeColor, awayColor)) {
    const awayTeam = NATIONS_BY_ID[awayId];
    const altColor = awayTeam?.altKitColor ?? 0xFFFFFF;
    return { homeColor, awayColor: altColor };
  }
  return { homeColor, awayColor };
}
