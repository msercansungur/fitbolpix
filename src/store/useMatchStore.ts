import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MatchResult, TeamStanding } from '../types/matchResult';
import { KnockoutResult } from '../types/knockout';
import { GROUP_FIXTURES } from '../constants/fixtures';
import { NATIONS_BY_ID } from '../constants/nations';

// Set of fixture IDs that are real group-stage fixtures (for standings recalc guard)
const GROUP_FIXTURE_IDS = new Set(GROUP_FIXTURES.map((f) => f.id));

interface MatchStoreState {
  results: Record<string, MatchResult>;          // keyed by fixtureId (group stage)
  standings: Record<string, TeamStanding>;       // keyed by teamId
  knockoutResults: Record<number, KnockoutResult>; // keyed by match ID (73–104)
  saveResult: (result: MatchResult) => void;
  saveKnockoutResult: (result: KnockoutResult) => void;
  clearGroupResults: (group: string) => void;
  clearAllKnockoutResults: () => void;
  clearAll: () => void;
}

// ─── Standings recalculation ─────────────────────────────────────────────────
// Rebuilds standings for every team in a group from scratch using all saved
// results. Called after every saveResult to keep standings consistent even
// when a match is re-simulated.

function recalcGroupStandings(
  group: string,
  results: Record<string, MatchResult>,
): Record<string, TeamStanding> {
  // Get the fixture IDs that belong to this group
  const groupFixtures = GROUP_FIXTURES.filter((f) => f.group === group);

  // Initialise a blank standing for each team in the group
  const teamIds = new Set<string>();
  groupFixtures.forEach((f) => {
    teamIds.add(f.homeTeamId);
    teamIds.add(f.awayTeamId);
  });

  const map: Record<string, TeamStanding> = {};
  teamIds.forEach((id) => {
    const team = NATIONS_BY_ID[id];
    map[id] = {
      teamId: id,
      group: team?.group ?? group,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
  });

  // Accumulate stats from every saved result in this group
  groupFixtures.forEach((fixture) => {
    const result = results[fixture.id];
    if (!result) return;

    const h = map[result.homeTeamId];
    const a = map[result.awayTeamId];
    if (!h || !a) return;

    h.played++;
    a.played++;
    h.goalsFor += result.homeScore;
    h.goalsAgainst += result.awayScore;
    a.goalsFor += result.awayScore;
    a.goalsAgainst += result.homeScore;

    if (result.homeScore > result.awayScore) {
      h.won++;    h.points += 3;
      a.lost++;
    } else if (result.homeScore < result.awayScore) {
      a.won++;    a.points += 3;
      h.lost++;
    } else {
      h.drawn++;  h.points++;
      a.drawn++;  a.points++;
    }
  });

  return map;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useMatchStore = create<MatchStoreState>()(
  persist(
    (set) => ({
      results: {},
      standings: {},
      knockoutResults: {},

      saveResult: (result) =>
        set((state) => {
          const newResults = { ...state.results, [result.fixtureId]: result };

          // Only recalculate standings for real group-stage fixtures
          if (!GROUP_FIXTURE_IDS.has(result.fixtureId)) {
            return { results: newResults };
          }

          // Find which group this fixture belongs to
          const fixture = GROUP_FIXTURES.find((f) => f.id === result.fixtureId);
          if (!fixture) return { results: newResults };

          const updatedGroupStandings = recalcGroupStandings(fixture.group, newResults);

          return {
            results: newResults,
            standings: { ...state.standings, ...updatedGroupStandings },
          };
        }),

      saveKnockoutResult: (result) =>
        set((state) => ({
          knockoutResults: { ...state.knockoutResults, [result.matchId]: result },
        })),

      clearGroupResults: (group) =>
        set((state) => {
          const groupFixtureIds = new Set(
            GROUP_FIXTURES.filter((f) => f.group === group).map((f) => f.id),
          );
          const newResults = Object.fromEntries(
            Object.entries(state.results).filter(([id]) => !groupFixtureIds.has(id)),
          );

          // Zero-out standings for the cleared group's teams
          const clearedStandings = recalcGroupStandings(group, newResults);

          return {
            results: newResults,
            standings: { ...state.standings, ...clearedStandings },
          };
        }),

      clearAllKnockoutResults: () =>
        set(() => ({ knockoutResults: {} })),

      clearAll: () =>
        set(() => ({ results: {}, standings: {}, knockoutResults: {} })),
    }),
    {
      name: 'fitbolpix-match-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// ─── Selectors ───────────────────────────────────────────────────────────────

export function selectStandings(
  standings: Record<string, TeamStanding>,
  group: string,
): TeamStanding[] {
  return Object.values(standings)
    .filter((s) => s.group === group)
    .sort((a, b) => {
      // 1. Points
      if (b.points !== a.points) return b.points - a.points;
      // 2. Goal difference
      const gdB = b.goalsFor - b.goalsAgainst;
      const gdA = a.goalsFor - a.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      // 3. Goals for
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      // 4. Alphabetical by teamId (stable)
      return a.teamId.localeCompare(b.teamId);
    });
}

export function selectMatchResult(
  results: Record<string, MatchResult>,
  fixtureId: string,
): MatchResult | null {
  return results[fixtureId] ?? null;
}

export function hasBeenSimulated(
  results: Record<string, MatchResult>,
  fixtureId: string,
): boolean {
  return fixtureId in results;
}
