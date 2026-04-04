import { TeamStanding, MatchResult } from '../types/matchResult';
import { KnockoutResult, ResolvedKnockoutMatch } from '../types/knockout';
import { KNOCKOUT_MATCHES, THIRD_SLOT_ELIGIBLE } from '../constants/knockoutBracket';
import { GROUP_FIXTURES } from '../constants/fixtures';
import { GROUPS } from '../constants/fixtures';

// ─── Third-place ranking ──────────────────────────────────────────────────────

interface ThirdPlacer {
  teamId: string;
  group: string;
  standing: TeamStanding;
}

// Returns the team finishing 3rd in a group, or null if not all 6 matches played
export function getGroupThirdPlacer(
  group: string,
  standings: Record<string, TeamStanding>,
  results: Record<string, MatchResult>,
): ThirdPlacer | null {
  const groupFixtures = GROUP_FIXTURES.filter((f) => f.group === group);
  if (groupFixtures.some((f) => !(f.id in results))) return null; // group not complete

  const groupStandings = Object.values(standings)
    .filter((s) => s.group === group)
    .sort(standingComparator);

  if (groupStandings.length < 3) return null;
  const third = groupStandings[2];
  return { teamId: third.teamId, group, standing: third };
}

function standingComparator(a: TeamStanding, b: TeamStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  const gdB = b.goalsFor - b.goalsAgainst;
  const gdA = a.goalsFor - a.goalsAgainst;
  if (gdB !== gdA) return gdB - gdA;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.teamId.localeCompare(b.teamId);
}

// Returns the 8 best third-place teams, or null if not enough groups are complete
export function getBestThirdPlacers(
  standings: Record<string, TeamStanding>,
  results: Record<string, MatchResult>,
): ThirdPlacer[] | null {
  const allThirds: ThirdPlacer[] = [];

  for (const group of GROUPS) {
    const third = getGroupThirdPlacer(group, standings, results);
    if (third) allThirds.push(third);
  }

  if (allThirds.length < 8) return null; // need all 12 groups done to pick best 8

  // Rank by: points → GD → GF → group letter (stable)
  allThirds.sort((a, b) => {
    const sa = a.standing;
    const sb = b.standing;
    if (sb.points !== sa.points) return sb.points - sa.points;
    const gdB = sb.goalsFor - sb.goalsAgainst;
    const gdA = sa.goalsFor - sa.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (sb.goalsFor !== sa.goalsFor) return sb.goalsFor - sa.goalsFor;
    return a.group.localeCompare(b.group);
  });

  return allThirds.slice(0, 8);
}

// ─── Bipartite matching — assign 3rd-placers to variable slots ───────────────
// Uses backtracking to find a valid 1-to-1 assignment of 8 qualifying groups
// to the 8 variable slot match IDs, respecting THIRD_SLOT_ELIGIBLE constraints.

const VARIABLE_SLOTS = [74, 77, 79, 80, 81, 82, 85, 87];

export function assignThirdPlacerSlots(
  qualifyingGroups: string[], // the 8 groups that produce qualifying 3rd-placers
): Record<number, string> | null {
  // slot → group assignment
  const assignment: Record<number, string> = {};
  const usedGroups = new Set<string>();

  function backtrack(slotIdx: number): boolean {
    if (slotIdx === VARIABLE_SLOTS.length) return true;
    const slotId = VARIABLE_SLOTS[slotIdx];
    const eligible = THIRD_SLOT_ELIGIBLE[slotId];

    for (const group of eligible) {
      if (!qualifyingGroups.includes(group)) continue;
      if (usedGroups.has(group)) continue;

      assignment[slotId] = group;
      usedGroups.add(group);
      if (backtrack(slotIdx + 1)) return true;
      delete assignment[slotId];
      usedGroups.delete(group);
    }
    return false;
  }

  return backtrack(0) ? assignment : null;
}

// ─── Main resolution function ─────────────────────────────────────────────────

function getGroupPositionTeam(
  position: 1 | 2,
  group: string,
  standings: Record<string, TeamStanding>,
  results: Record<string, MatchResult>,
): string | null {
  const groupFixtures = GROUP_FIXTURES.filter((f) => f.group === group);
  if (groupFixtures.some((f) => !(f.id in results))) return null;

  const sorted = Object.values(standings)
    .filter((s) => s.group === group)
    .sort(standingComparator);

  return sorted[position - 1]?.teamId ?? null;
}

export function resolveKnockoutBracket(
  standings: Record<string, TeamStanding>,
  results: Record<string, MatchResult>,
  knockoutResults: Record<number, KnockoutResult>,
): ResolvedKnockoutMatch[] {
  // Pre-compute best 3rd-placers and their slot assignments
  const best8 = getBestThirdPlacers(standings, results);
  const qualifyingGroups = best8?.map((t) => t.group) ?? [];
  const slotAssignment = best8 ? (assignThirdPlacerSlots(qualifyingGroups) ?? {}) : {};

  // Map from group → teamId for 3rd-placers
  const thirdPlacerByGroup: Record<string, string> = {};
  if (best8) best8.forEach((t) => { thirdPlacerByGroup[t.group] = t.teamId; });

  // Helper: resolve a single SlotSource to a teamId
  function resolveSlot(
    source: (typeof KNOCKOUT_MATCHES)[0]['homeSource'],
    resolvedMatches: Map<number, ResolvedKnockoutMatch>,
  ): string | null {
    switch (source.kind) {
      case 'group':
        return getGroupPositionTeam(source.position, source.group, standings, results);

      case 'third_variable': {
        const group = slotAssignment[source.slot];
        if (!group) return null;
        return thirdPlacerByGroup[group] ?? null;
      }

      case 'winner': {
        const prior = resolvedMatches.get(source.matchId);
        if (!prior?.result) return null;
        const { homeTeamId, awayTeamId, homeScore, awayScore } = prior.result;
        return homeScore >= awayScore ? homeTeamId : awayTeamId; // home wins ties
      }

      case 'loser': {
        const prior = resolvedMatches.get(source.matchId);
        if (!prior?.result) return null;
        const { homeTeamId, awayTeamId, homeScore, awayScore } = prior.result;
        return homeScore < awayScore ? homeTeamId : awayTeamId;
      }
    }
  }

  // Process matches in ID order (73 → 104) so dependencies resolve correctly
  const resolvedMap = new Map<number, ResolvedKnockoutMatch>();

  for (const def of KNOCKOUT_MATCHES) {
    const homeTeamId = resolveSlot(def.homeSource, resolvedMap);
    const awayTeamId = resolveSlot(def.awaySource, resolvedMap);
    const result = knockoutResults[def.id] ?? null;

    resolvedMap.set(def.id, { def, homeTeamId, awayTeamId, result });
  }

  return Array.from(resolvedMap.values());
}
