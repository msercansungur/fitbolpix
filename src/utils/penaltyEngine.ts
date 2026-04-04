import {
  GoalZone,
  ShotTechnique,
  ShotInput,
  GKDive,
  GKDiveDirection,
  GKDiveHeight,
  ShotOutcome,
  KickRecord,
  ShootoutMode,
} from '../types/penalty';

// ─── Zone helpers ─────────────────────────────────────────────────────────────
// Zones 0–8, row-major:  0 1 2  (top)
//                        3 4 5  (mid)
//                        6 7 8  (low)

function zoneColumn(zone: GoalZone): GKDiveDirection {
  const col = zone % 3;
  return col === 0 ? 'left' : col === 1 ? 'center' : 'right';
}

function zoneRow(zone: GoalZone): GKDiveHeight {
  return zone < 3 ? 'high' : 'low';
}

// ─── Accuracy ring speed ──────────────────────────────────────────────────────

/**
 * Returns the full-cycle duration (ms) of the accuracy ring oscillation.
 * Higher penalty_skill → longer cycle → easier to time the tap.
 * Range: ~900ms (skill=0) → ~2200ms (skill=100)
 */
export function getRingDuration(penaltySkill: number): number {
  return 900 + penaltySkill * 13;
}

// ─── GK dive AI ──────────────────────────────────────────────────────────────

/**
 * Generates the GK's dive. The GK never sees the user's chosen zone,
 * so it is a weighted random choice. Higher goalkeeper_rating gives a
 * slightly higher chance of staying center (harder to beat low).
 */
export function generateGKDive(gkRating: number): GKDive {
  // Center stay probability scales with rating (5%–22%)
  const centerProb = 0.05 + (gkRating / 100) * 0.17;
  const sideProb   = (1 - centerProb) / 2;

  const r = Math.random();
  let direction: GKDiveDirection;
  if (r < sideProb) {
    direction = 'left';
  } else if (r < sideProb * 2) {
    direction = 'right';
  } else {
    direction = 'center';
  }

  const height: GKDiveHeight = Math.random() < 0.5 ? 'high' : 'low';
  return { direction, height };
}

// ─── User shot resolution ─────────────────────────────────────────────────────

/**
 * Resolves the outcome of a user-taken penalty.
 *
 * Rules:
 * - accuracy < 20  → always miss (off target)
 * - power < 15     → feeble, auto-saved if GK in range
 * - Panenka + GK dives  → always goal (regardless of other stats)
 * - Panenka + GK stays  → save prob = gkRating * 0.5 / 100
 * - GK direction matches shot column:
 *     save prob = 0.25 + (gkRating/100)*0.5   (up to 75%)
 * - GK height matches zone row: +0.10 additional save chance
 * - GK misses column: save prob = 0.03
 */
export function resolveUserShot(
  shot: ShotInput,
  gkDive: GKDive,
  gkRating: number,
): ShotOutcome {
  const { zone, power, accuracy, technique } = shot;

  // Off-target miss
  if (accuracy < 20) return 'miss';

  // Panenka special rules
  if (technique === 'panenka') {
    if (gkDive.direction !== 'center') return 'goal'; // GK committed — chip goes in
    const saveChance = (gkRating / 100) * 0.5;
    return Math.random() < saveChance ? 'saved' : 'goal';
  }

  // Feeble shot
  if (power < 15) {
    return Math.random() < 0.85 ? 'saved' : 'goal';
  }

  const shotCol = zoneColumn(zone);
  const shotRow = zoneRow(zone);

  let saveProb: number;

  if (gkDive.direction === shotCol) {
    // GK dived the right way
    saveProb = 0.25 + (gkRating / 100) * 0.50;
    if (gkDive.height === shotRow) saveProb += 0.10;
  } else {
    // GK dived the wrong way
    saveProb = 0.03;
  }

  // Power shot lowers save probability (harder to hold)
  if (technique === 'power') {
    saveProb *= 0.70;
  }

  // Great accuracy reduces save chance further
  if (accuracy > 80) {
    saveProb *= 0.80;
  }

  return Math.random() < saveProb ? 'saved' : 'goal';
}

// ─── CPU shot resolution ──────────────────────────────────────────────────────

/**
 * Fully auto-resolves a CPU penalty.
 * Goal probability = 0.55 + (penaltySkill/100)*0.35  → range 55%–90%
 */
export function resolveCPUShot(
  penaltySkill: number,
  gkRating: number,
): { shot: ShotInput; gkDive: GKDive; outcome: ShotOutcome } {
  const goalProb = 0.55 + (penaltySkill / 100) * 0.35;
  const isGoal = Math.random() < goalProb;

  // Pick a random zone biased away from center for CPU (more realistic)
  const zones: GoalZone[] = [0, 1, 2, 3, 5, 6, 7, 8]; // avoid dead-center (4)
  const zone = zones[Math.floor(Math.random() * zones.length)] as GoalZone;

  // Choose technique (CPU rarely does panenka)
  const techRoll = Math.random();
  const technique: ShotTechnique =
    techRoll < 0.05 ? 'panenka' : techRoll < 0.25 ? 'power' : 'regular';

  const shot: ShotInput = {
    zone,
    power: isGoal ? 65 + Math.random() * 35 : 40 + Math.random() * 30,
    accuracy: isGoal ? 70 + Math.random() * 30 : 20 + Math.random() * 40,
    technique,
  };

  const gkDive = generateGKDive(gkRating);

  // Panenka override for CPU
  let outcome: ShotOutcome;
  if (technique === 'panenka') {
    outcome = gkDive.direction !== 'center' ? 'goal' : (isGoal ? 'goal' : 'saved');
  } else {
    outcome = isGoal ? 'goal' : (Math.random() < 0.6 ? 'saved' : 'miss');
  }

  return { shot, gkDive, outcome };
}

// ─── Shootout end check ───────────────────────────────────────────────────────

/**
 * After every kick, checks if the shootout is mathematically decided.
 * Returns { ended: true, winner: teamId } or { ended: false, winner: null }.
 */
export function checkShootoutEnd(
  kicks: KickRecord[],
  mode: ShootoutMode,
  homeTeamId: string,
  awayTeamId: string,
): { ended: boolean; winner: string | null } {
  const homeKicks = kicks.filter((k) => k.teamId === homeTeamId);
  const awayKicks = kicks.filter((k) => k.teamId === awayTeamId);

  const homeScore = homeKicks.filter((k) => k.outcome === 'goal').length;
  const awayScore = awayKicks.filter((k) => k.outcome === 'goal').length;

  const homeTaken = homeKicks.length;
  const awayTaken = awayKicks.length;

  if (mode === 'sudden_death') {
    // Sudden death: after round 5 ended (both taken same number of kicks),
    // if scores equal continue; if one ahead after equal kicks, that team wins
    if (homeTaken === awayTaken && homeTaken >= 5) {
      if (homeScore !== awayScore) {
        return { ended: true, winner: homeScore > awayScore ? homeTeamId : awayTeamId };
      }
    }
    // Not yet equal kicks — keep going
    return { ended: false, winner: null };
  }

  // Best of 5 logic: rounds 1–5, check early finish
  const maxRounds = 5;

  if (homeTaken === awayTaken) {
    const roundsDone = homeTaken;

    // After all 5 rounds equal kicks
    if (roundsDone === maxRounds) {
      if (homeScore !== awayScore) {
        return { ended: true, winner: homeScore > awayScore ? homeTeamId : awayTeamId };
      }
      // Tied after 5 — go to sudden death (caller handles mode switch)
      return { ended: true, winner: null };
    }

    // Early finish: can the loser still catch up?
    const remaining = maxRounds - roundsDone;
    if (homeScore - awayScore > remaining) {
      return { ended: true, winner: homeTeamId };
    }
    if (awayScore - homeScore > remaining) {
      return { ended: true, winner: awayTeamId };
    }
  }

  // Mid-round check (away still to kick in this round)
  if (homeTaken === awayTaken + 1) {
    const remaining = maxRounds - homeTaken;
    // Home so far ahead that even if away scores all remaining, can't catch up
    if (homeScore > awayScore + remaining + (awayTaken < maxRounds ? 1 : 0)) {
      return { ended: true, winner: homeTeamId };
    }
    // Away can't catch up even if home misses all remaining
    if (awayScore > homeScore + remaining) {
      return { ended: true, winner: awayTeamId };
    }
  }

  return { ended: false, winner: null };
}

// ─── Commentary ───────────────────────────────────────────────────────────────

type Lang = 'tr' | 'en';

const PENALTY_LINES: Record<ShotOutcome, Record<ShotTechnique | 'generic', Record<Lang, string[]>>> = {
  goal: {
    regular: {
      tr: [
        'GOL! Penaltıyı soğukkanlılıkla tamamladı!',
        'İçeri! Kaleci hiçbir şans bulamadı!',
        'Köşeye yerleştirdi! Mükemmel penaltı!',
        'Penaltılarda her şey olur — ama bu kesin bir goldü!',
        'VURDU GİRDİİİ! Seyirciler çılgına döndü!',
      ],
      en: [
        'GOAL! Nerves of steel!',
        'Right in the corner! The keeper had no chance!',
        'Clinical penalty! Cool as you like!',
        'Stepped up and delivered! GOAL!',
        'Perfect penalty! Bottom corner!',
      ],
    },
    power: {
      tr: [
        'GÜÇLÜ VURUŞ! Kaleci eli de değmedi!',
        'TOP ROKET GİBİ! File havalandı!',
        'PAAAAAAT! Top filenin içinde!',
        'Bu güç bu hız! Kaleci donup kaldı!',
      ],
      en: [
        'ROCKET! The keeper didn\'t even move!',
        'THUNDERBOLT! Right through the net!',
        'Pure power! Unstoppable!',
        'Blasted in! No chance for the keeper!',
      ],
    },
    panenka: {
      tr: [
        'PANENKA! İNANILMAZ CÜRET! Kaleci daldı, top tam ortadan geçti!',
        'Çip vuruş! Kaleci bir yere daldı, top öbür tarafa! Deha!',
        'PANEN-KAAAAAA! Bu cesaret bu özgüven! Efsane!',
        'Kaleci daldı, top yavaşça içeri yürüdü. Utanç verici mi? Hayır, MÜKEMMELLİK!',
      ],
      en: [
        'PANENKA! UNBELIEVABLE CHEEK! The keeper dived and the ball rolled in!',
        'The audacity! Chip shot right down the middle! Genius!',
        'He chipped the keeper! ICONIC!',
        'Coolest penalty ever taken! The keeper is furious!',
      ],
    },
    generic: {
      tr: ['GOL! Penaltı atıldı ve gol oldu!'],
      en: ['GOAL! Penalty scored!'],
    },
  },
  saved: {
    regular: {
      tr: [
        'KALECİ KURTARDI! Muhteşem refleks!',
        'Kaleci çuval oldu! Eh, değil aslında — iyi kurtarıştı!',
        'GÖRKEMLİ KURTARIŞ! Kaleci bu maçın kahramanı!',
        'Kaleci doğru tarafa atladı ve tuttu! Felaket!',
        'Direkten döndü! Çerçeveye çarptı, içeri girmedi!',
      ],
      en: [
        'SAVED! The keeper guessed right!',
        'Brilliant save! Right to the corner and he held it!',
        'The keeper is the hero! Outstanding!',
        'Saved! The keeper dives the right way!',
        'Off the post! So close!',
      ],
    },
    power: {
      tr: [
        'GÜÇLÜ VURDU AMA KALECİ TUTTU! Nasıl tuttu bunu?!',
        'Bu kadar güçlü bir vuruşu tutmak... inanılmaz!',
        'Kaleci refleks yaptı! Power shot yetmedi!',
      ],
      en: [
        'What a save! Even that power shot was stopped!',
        'Incredible reflexes! That was hit so hard!',
        'The keeper tips it over! Power wasn\'t enough!',
      ],
    },
    panenka: {
      tr: [
        'KALECİ PANENKA\'YI OKU! Ortada durdu ve tuttu! Rezalet!',
        'Çip vuruş kurtarıldı! Kaleci oynamadı, kazandı!',
        'PANENKA TAHMİN EDİLDİ! Kaleci tebessüm ediyor!',
      ],
      en: [
        'THE KEEPER DIDN\'T MOVE! Panenka saved! How embarrassing!',
        'He read the chip shot and stayed! What a save!',
        'Panenka attempt denied! The keeper is laughing!',
      ],
    },
    generic: {
      tr: ['Kaleci kurtardı!'],
      en: ['Saved by the keeper!'],
    },
  },
  miss: {
    regular: {
      tr: [
        'KAÇIRDI! Top direğe çarptı ve dışarı!',
        'Direkten döndü! Ah, ne acı!',
        'ÜSTÜNDEN GEÇTİ! Tribünlere gitti top!',
        'Penaltılarda her şey olur — bu da olmadı!',
        'Vuruş saptı! Top auta gitti, seyirciler sessiz!',
        'Hata! Penaltı çizgisinde dondu ve kaçırdı!',
      ],
      en: [
        'MISSED! Over the bar! What a miss!',
        'Off the post and out! Agonising!',
        'He blazed it over! The crowd can\'t believe it!',
        'Wide! That was never in danger of going in!',
        'Penalty missed! The pressure got to him!',
      ],
    },
    power: {
      tr: [
        'GÜÇLÜ VURDU AMA ÇIKTI! Tutamazsın ama hedefi de bulamazsın!',
        'Roket ama yanlış yöne! Feci miss!',
        'TOK VURDU, YANLIŞ YERE! Felaket!',
      ],
      en: [
        'Blazed it wide! All that power and none of the accuracy!',
        'Hit it like a missile — unfortunately a missile with no guidance!',
        'Skied! Way too much power, not enough aim!',
      ],
    },
    panenka: {
      tr: [
        'PANENKA TUTULDU! Kaleci orada durdu ve aldı! Rezalet rezalet rezalet!',
        'Çip vuruş başarısız! Kaleci çuval olmadı! Utanç verici son!',
        'PANENKA FOYASI ÇIKTI! Kaleci güldü, seyirciler ağladı!',
      ],
      en: [
        'Panenka saved! The keeper didn\'t move! How embarrassing!',
        'Chip shot caught! The keeper had it covered all along!',
        'Panenka attempt failed spectacularly! The keeper is delighted!',
      ],
    },
    generic: {
      tr: ['Penaltı kaçırıldı!'],
      en: ['Penalty missed!'],
    },
  },
};

function pickLine(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getPenaltyCommentary(
  outcome: ShotOutcome,
  technique: ShotTechnique,
  lang: Lang = 'en',
): string {
  const byOutcome = PENALTY_LINES[outcome];
  const byTech    = byOutcome[technique] ?? byOutcome.generic;
  const pool      = byTech[lang] ?? byTech.en;
  return pickLine(pool);
}
