import { Team, MatchEvent, EventType } from '../types/simulator';
import { getCommentary } from './memeCommentary';

type Lang = 'tr' | 'en';

let _uid = 0;
function uid(): string {
  return String(++_uid);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Poisson distribution — generates a random integer drawn from Poisson(λ)
function poisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function makeEvent(
  minute: number,
  type: EventType,
  teamId: string,
  lang: Lang,
): MatchEvent {
  return { id: uid(), minute, type, teamId, commentary: getCommentary(type, lang) };
}

// Generate `count` random minutes in [min, max], sorted ascending
function randomMinutes(count: number, min: number, max: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) result.push(randomInt(min, max));
  return result.sort((a, b) => a - b);
}

export function simulateMatch(home: Team, away: Team, lang: Lang = 'en'): MatchEvent[] {
  const pool: MatchEvent[] = [];

  // Expected goals — weighted by relative strength, avg ~2.5 goals per match
  const total = home.strength + away.strength;
  const homeLambda = (home.strength / total) * 2.8;
  const awayLambda = (away.strength / total) * 2.8;

  const homeGoals = Math.min(poisson(homeLambda), 7);
  const awayGoals = Math.min(poisson(awayLambda), 7);

  // Goals (can happen in injury time up to 95')
  randomMinutes(homeGoals, 1, 95).forEach((m) =>
    pool.push(makeEvent(m, 'goal', home.id, lang)),
  );
  randomMinutes(awayGoals, 1, 95).forEach((m) =>
    pool.push(makeEvent(m, 'goal', away.id, lang)),
  );

  // Yellow cards (2–5)
  randomMinutes(randomInt(2, 5), 10, 88).forEach((m) => {
    const teamId = Math.random() > 0.5 ? home.id : away.id;
    pool.push(makeEvent(m, 'yellow_card', teamId, lang));
  });

  // Red card (~15% chance)
  if (Math.random() < 0.15) {
    const teamId = Math.random() > 0.5 ? home.id : away.id;
    pool.push(makeEvent(randomInt(30, 85), 'red_card', teamId, lang));
  }

  // Saves (3–7)
  randomMinutes(randomInt(3, 7), 5, 90).forEach((m) => {
    const teamId = Math.random() > 0.5 ? home.id : away.id;
    pool.push(makeEvent(m, 'save', teamId, lang));
  });

  // Fouls (2–5)
  randomMinutes(randomInt(2, 5), 5, 88).forEach((m) => {
    const teamId = Math.random() > 0.5 ? home.id : away.id;
    pool.push(makeEvent(m, 'foul', teamId, lang));
  });

  // VAR check (~40% chance, 1 check)
  if (Math.random() < 0.4) {
    const teamId = Math.random() > 0.5 ? home.id : away.id;
    pool.push(makeEvent(randomInt(20, 85), 'var_check', teamId, lang));
  }

  // Injury (~50% chance, 1 stoppage)
  if (Math.random() < 0.5) {
    const teamId = Math.random() > 0.5 ? home.id : away.id;
    pool.push(makeEvent(randomInt(15, 80), 'injury', teamId, lang));
  }

  // Sort raw events by minute, then split around half-time
  const sorted = pool.sort((a, b) => a.minute - b.minute);
  const firstHalf = sorted.filter((e) => e.minute <= 45);
  const secondHalf = sorted.filter((e) => e.minute > 45);

  return [
    makeEvent(0, 'kickoff', '', lang),
    ...firstHalf,
    makeEvent(45, 'halftime', '', lang),
    ...secondHalf,
    makeEvent(90, 'fulltime', '', lang),
  ];
}

// Compute running score from a slice of revealed events
export function computeScore(
  events: MatchEvent[],
  homeId: string,
  awayId: string,
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.type === 'goal') {
      if (e.teamId === homeId) home++;
      else if (e.teamId === awayId) away++;
    }
  }
  return { home, away };
}
