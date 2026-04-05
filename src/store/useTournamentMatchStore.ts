// Isolated store for the Tournament tab match results.
// NEVER read or write from Fixtures tab or Simulator tab.
// Cleared on resetTournament() via clearAll().
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MatchResult, TeamStanding } from '../types/matchResult';
import { KnockoutResult } from '../types/knockout';
import { GROUP_FIXTURES } from '../constants/fixtures';
import { NATIONS_BY_ID } from '../constants/nations';

const GROUP_FIXTURE_IDS = new Set(GROUP_FIXTURES.map((f) => f.id));

interface TournamentMatchStoreState {
  results: Record<string, MatchResult>;
  standings: Record<string, TeamStanding>;
  knockoutResults: Record<number, KnockoutResult>;
  saveResult: (result: MatchResult) => void;
  saveKnockoutResult: (result: KnockoutResult) => void;
  clearGroupResults: (group: string) => void;
  clearAllKnockoutResults: () => void;
  clearAll: () => void;
}

function recalcGroupStandings(
  group: string,
  results: Record<string, MatchResult>,
): Record<string, TeamStanding> {
  const groupFixtures = GROUP_FIXTURES.filter((f) => f.group === group);
  const teamIds = new Set<string>();
  groupFixtures.forEach((f) => { teamIds.add(f.homeTeamId); teamIds.add(f.awayTeamId); });

  const map: Record<string, TeamStanding> = {};
  teamIds.forEach((id) => {
    const team = NATIONS_BY_ID[id];
    map[id] = { teamId: id, group: team?.group ?? group, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
  });

  groupFixtures.forEach((fixture) => {
    const result = results[fixture.id];
    if (!result) return;
    const h = map[result.homeTeamId];
    const a = map[result.awayTeamId];
    if (!h || !a) return;
    h.played++; a.played++;
    h.goalsFor += result.homeScore; h.goalsAgainst += result.awayScore;
    a.goalsFor += result.awayScore; a.goalsAgainst += result.homeScore;
    if (result.homeScore > result.awayScore) { h.won++; h.points += 3; a.lost++; }
    else if (result.homeScore < result.awayScore) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; h.points++; a.drawn++; a.points++; }
  });

  return map;
}

export const useTournamentMatchStore = create<TournamentMatchStoreState>()(
  persist(
    (set) => ({
      results: {},
      standings: {},
      knockoutResults: {},

      saveResult: (result) =>
        set((state) => {
          const newResults = { ...state.results, [result.fixtureId]: result };
          if (!GROUP_FIXTURE_IDS.has(result.fixtureId)) return { results: newResults };
          const fixture = GROUP_FIXTURES.find((f) => f.id === result.fixtureId);
          if (!fixture) return { results: newResults };
          const updatedStandings = recalcGroupStandings(fixture.group, newResults);
          return { results: newResults, standings: { ...state.standings, ...updatedStandings } };
        }),

      saveKnockoutResult: (result) =>
        set((state) => ({
          knockoutResults: { ...state.knockoutResults, [result.matchId]: result },
        })),

      clearGroupResults: (group) =>
        set((state) => {
          const ids = new Set(GROUP_FIXTURES.filter((f) => f.group === group).map((f) => f.id));
          const newResults = Object.fromEntries(Object.entries(state.results).filter(([id]) => !ids.has(id)));
          const clearedStandings = recalcGroupStandings(group, newResults);
          return { results: newResults, standings: { ...state.standings, ...clearedStandings } };
        }),

      clearAllKnockoutResults: () => set(() => ({ knockoutResults: {} })),

      clearAll: () => set(() => ({ results: {}, standings: {}, knockoutResults: {} })),
    }),
    {
      name: 'fitbolpix-tournament-match-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export function selectTournamentStandings(
  standings: Record<string, TeamStanding>,
  group: string,
): TeamStanding[] {
  return Object.values(standings)
    .filter((s) => s.group === group)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdB = b.goalsFor - b.goalsAgainst;
      const gdA = a.goalsFor - a.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.teamId.localeCompare(b.teamId);
    });
}
