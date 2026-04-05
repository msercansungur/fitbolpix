// Store for real API-Football live/final results.
// Used exclusively by FixturesScreen.
// Caching strategy:
//   - Never fetch if last fetch < 5 min ago AND a live match is not currently active
//   - Never fetch more than once per hour if no matches are live
//   - Never fetch if API key is empty
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LiveResult, fetchLiveResults } from '../services/fixtureService';
import { FOOTBALL_API_KEY } from '../constants/apiConfig';

const FIVE_MIN_MS  = 5  * 60 * 1000;
const ONE_HOUR_MS  = 60 * 60 * 1000;

interface FixtureStoreState {
  // keyed by our local fixture ID (e.g. 'A1', 'B3')
  liveResults: Record<string, LiveResult>;
  lastFetched: number | null;
  isLoading: boolean;
  fetchResults: () => Promise<void>;
}

export const useFixtureStore = create<FixtureStoreState>()(
  persist(
    (set, get) => ({
      liveResults:  {},
      lastFetched:  null,
      isLoading:    false,

      fetchResults: async () => {
        if (!FOOTBALL_API_KEY) return;

        const { liveResults, lastFetched, isLoading } = get();
        if (isLoading) return;

        const now = Date.now();
        const hasLiveMatch = Object.values(liveResults).some(
          (r) => r.status !== 'NS' && r.status !== 'FT' && r.status !== 'AET' && r.status !== 'PEN',
        );

        if (lastFetched !== null) {
          const age = now - lastFetched;
          // If a live match is ongoing: allow refresh after 5 min
          // Otherwise: allow refresh only after 1 hour
          const threshold = hasLiveMatch ? FIVE_MIN_MS : ONE_HOUR_MS;
          if (age < threshold) return;
        }

        set({ isLoading: true });
        try {
          const results = await fetchLiveResults();
          set({ liveResults: results, lastFetched: Date.now(), isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'fitbolpix-fixture-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist isLoading — always reset to false on hydration
      partialize: (state) => ({
        liveResults: state.liveResults,
        lastFetched: state.lastFetched,
      }),
    },
  ),
);
