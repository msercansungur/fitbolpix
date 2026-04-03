import { useState, useEffect, useCallback } from 'react';
import { Team, SimulatorState } from '../types/simulator';
import { simulateMatch, computeScore } from '../utils/simulator';

// How long each event is displayed before the next one appears (ms)
const EVENT_INTERVAL_MS = 1400;

const INITIAL_STATE: SimulatorState = {
  homeTeam: null,
  awayTeam: null,
  homeScore: 0,
  awayScore: 0,
  events: [],
  pendingEvents: [],
  currentMinute: 0,
  status: 'idle',
};

export function useSimulator() {
  const [state, setState] = useState<SimulatorState>(INITIAL_STATE);

  const selectHomeTeam = useCallback((team: Team) => {
    setState((s) => ({ ...s, homeTeam: team }));
  }, []);

  const selectAwayTeam = useCallback((team: Team) => {
    setState((s) => ({ ...s, awayTeam: team }));
  }, []);

  const startMatch = useCallback(() => {
    setState((s) => {
      if (!s.homeTeam || !s.awayTeam) return s;
      const allEvents = simulateMatch(s.homeTeam, s.awayTeam, 'en');
      return {
        ...s,
        homeScore: 0,
        awayScore: 0,
        events: [],
        pendingEvents: allEvents,
        currentMinute: 0,
        status: 'running',
      };
    });
  }, []);

  const resetMatch = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // Drive the playback: reveal one event at a time on an interval
  useEffect(() => {
    if (state.status !== 'running') return;

    const interval = setInterval(() => {
      setState((s) => {
        if (s.pendingEvents.length === 0) {
          return { ...s, status: 'finished' };
        }

        const [next, ...rest] = s.pendingEvents;
        const newEvents = [...s.events, next];
        const score =
          s.homeTeam && s.awayTeam
            ? computeScore(newEvents, s.homeTeam.id, s.awayTeam.id)
            : { home: 0, away: 0 };

        return {
          ...s,
          events: newEvents,
          pendingEvents: rest,
          currentMinute: next.minute,
          homeScore: score.home,
          awayScore: score.away,
          status: rest.length === 0 ? 'finished' : 'running',
        };
      });
    }, EVENT_INTERVAL_MS);

    return () => clearInterval(interval);
  // Re-run only when match status changes (running → finished)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return { state, selectHomeTeam, selectAwayTeam, startMatch, resetMatch };
}
