import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KnockoutRound } from '../types/knockout';

export type EliminationRound = KnockoutRound | 'groups';

interface TournamentState {
  // ── Status ──────────────────────────────────────────────────────────────
  isActive:         boolean;
  hasWon:           boolean;
  isEliminated:     boolean;
  eliminatedAt:     EliminationRound | null;
  // Who eliminated the user (teamId)
  eliminatedBy:     string | null;

  // ── Selection ───────────────────────────────────────────────────────────
  selectedNationId: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────
  startTournament:  (nationId: string) => void;
  setEliminated:    (round: EliminationRound, byTeamId: string) => void;
  setWon:           () => void;
  resetTournament:  () => void;
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set) => ({
      isActive:         false,
      hasWon:           false,
      isEliminated:     false,
      eliminatedAt:     null,
      eliminatedBy:     null,
      selectedNationId: null,

      startTournament: (nationId) =>
        set({
          isActive:         true,
          hasWon:           false,
          isEliminated:     false,
          eliminatedAt:     null,
          eliminatedBy:     null,
          selectedNationId: nationId,
        }),

      setEliminated: (round, byTeamId) =>
        set({
          isEliminated: true,
          eliminatedAt: round,
          eliminatedBy: byTeamId,
        }),

      setWon: () =>
        set({ hasWon: true }),

      resetTournament: () =>
        set({
          isActive:         false,
          hasWon:           false,
          isEliminated:     false,
          eliminatedAt:     null,
          eliminatedBy:     null,
          selectedNationId: null,
        }),
    }),
    {
      name: 'fitbolpix-tournament-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
