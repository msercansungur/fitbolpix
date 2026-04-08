import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { NATIONS, NATIONS_BY_ID } from '../constants/nations';
import { GROUP_FIXTURES } from '../constants/fixtures';
import { useTournamentMatchStore, selectTournamentStandings } from '../store/useTournamentMatchStore';
import { useTournamentStore } from '../store/useTournamentStore';
import { resolveKnockoutBracket, getBestThirdPlacers } from '../utils/knockoutEngine';
import { simulateMatch, computeScore } from '../utils/simulator';
import { TeamStanding } from '../types/matchResult';
import { KnockoutRound } from '../types/knockout';
import { Team } from '../types/simulator';
import PixelFlag from '../components/PixelFlag';
import { animateScore } from '../utils/scoreAnimation';
import { PENALTY_GAME_HTML } from '../assets/penalty-game/penaltyGame';
import { getMatchSimHTML, MatchSimConfig } from '../assets/match-sim/matchSim';
import { resolveKitColors } from '../utils/kitColors';

type Props = BottomTabScreenProps<BottomTabParamList, 'Tournament'>;

// ─── Kit colours for penalty/sim WebView config ──────────────────────────────
const KIT_COLORS: Record<string, number> = {
  mex:0x006847,rsa:0x007A4D,kor:0xC60C30,cze:0xD7141A,
  can:0xFF0000,bih:0x002395,qat:0x8D1B3D,swi:0xFF0000,
  bra:0xF7D116,mor:0xC1272D,hai:0x00209F,sco:0x003078,
  usa:0x002868,par:0xD52B1E,aus:0xFFD700,tur:0xE30A17,
  ger:0xFFFFFF,cur:0x003DA5,civ:0xF77F00,ecua:0xFFD100,
  ned:0xFF6200,jpn:0x002B7F,swe:0x006AA7,tun:0xE70013,
  bel:0xED2939,egy:0xC8102E,iri:0x239F40,nzl:0x000000,
  spa:0xAA151B,cpv:0x003893,ksa:0x006C35,uru:0x5EB6E4,
  fra:0x002395,sen:0x00853F,irq:0x007A3D,nor:0xEF2B2D,
  arg:0x74ACDF,alg:0x006233,aut:0xED2939,jor:0x007A3D,
  por:0x006600,cod:0x007FFF,uzb:0x1EB53A,col:0xFCD116,
  eng:0xFFFFFF,cro:0xFF0000,gha:0x006B3F,pan:0xD21034,
};

function buildPenaltyConfig(home: Team, away: Team, mode: 'best_of_5' | 'sudden_death', userTeam: 'home' | 'away'): string {
  const { homeColor, awayColor } = resolveKitColors(home.id, away.id, KIT_COLORS);
  const cfg = {
    homeTeam: { id:home.id, name:home.name, flag:home.flag, kitColor:homeColor, penalty_skill:home.penalty_skill??65, goalkeeper_rating:home.goalkeeper_rating??65 },
    awayTeam: { id:away.id, name:away.name, flag:away.flag, kitColor:awayColor, penalty_skill:away.penalty_skill??65, goalkeeper_rating:away.goalkeeper_rating??65 },
    mode, userTeam,
  };
  return `window.GAME_CONFIG = ${JSON.stringify(cfg)}; true;`;
}

function buildSimConfig(home: Team, away: Team): { html: string; events: ReturnType<typeof simulateMatch>; score: { home: number; away: number } } {
  const events = simulateMatch(home, away, 'en');
  const score  = computeScore(events, home.id, away.id);
  const { homeColor, awayColor } = resolveKitColors(home.id, away.id, KIT_COLORS);
  const config: MatchSimConfig = {
    homeId: home.id, homeName: home.name, homeCode: home.code3,
    homeColor, homeStrength: home.strength, homeFormation: home.formation ?? '4-4-2',
    awayId: away.id, awayName: away.name, awayCode: away.code3,
    awayColor, awayStrength: away.strength, awayFormation: away.formation ?? '4-4-2',
    events: events.map((e) => ({ type: e.type, teamId: e.teamId, minute: e.minute })),
    seed: Date.now() % 99991,
  };
  return { html: getMatchSimHTML(config), events, score };
}

// ─── Overlay state types ─────────────────────────────────────────────────────
type PenaltyOverlay = {
  key: string;
  homeTeamId: string;
  awayTeamId: string;
  mode: 'best_of_5' | 'sudden_death';
  userTeam: 'home' | 'away';
  fixtureId?: string;      // group fixture id
  matchId?: number;         // knockout match id
};

type SimOverlay = {
  key: string;
  homeTeamId: string;
  awayTeamId: string;
  html: string;
  fixtureId?: string;
  matchId?: number;
  simScore: { home: number; away: number };
  simEvents: import('../types/simulator').MatchEvent[];
  contextLabel?: string;  // e.g. "GROUP D · MATCHDAY 1"
  teamsLabel?: string;    // e.g. "AUS vs TUR"
};

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Round display labels ─────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  R32: 'ROUND OF 32',
  R16: 'ROUND OF 16',
  QF:  'QUARTER-FINAL',
  SF:  'SEMI-FINAL',
  '3rd': 'THIRD PLACE',
  Final: 'THE FINAL',
};

// ─── ELO bar (replaces star rating) ──────────────────────────────────────────
const ELO_MIN = 1400;
const ELO_MAX = 1950;

function EloBar({ strength, label }: { strength: number; label?: boolean }) {
  const pct = Math.min(1, Math.max(0, (strength - ELO_MIN) / (ELO_MAX - ELO_MIN)));
  // colour: green → yellow → red by how strong (green = strong)
  const barColor = pct > 0.7 ? COLORS.success : pct > 0.4 ? COLORS.warning : COLORS.textMuted;
  return (
    <View style={styles.eloBarWrap}>
      <View style={[styles.eloBarTrack]}>
        <View style={[styles.eloBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: barColor }]} />
      </View>
      {label !== false && (
        <Text style={styles.eloBarLabel}>ELO {strength}</Text>
      )}
    </View>
  );
}

// ─── Group match card (stateful score animation) ──────────────────────────────
function GroupMatchCard({
  fixture, homeTeam, awayTeam, result, isUserHome, isAnimating,
  selectedNationId, onQuickSim, onLongSim, onPenalties, onReset,
  showReset = true, locked = false,
}: {
  fixture: typeof GROUP_FIXTURES[number];
  homeTeam: import('../types/simulator').Team | undefined;
  awayTeam: import('../types/simulator').Team | undefined;
  result: import('../types/matchResult').MatchResult | null;
  isUserHome: boolean;
  isAnimating: boolean;
  selectedNationId: string;
  onQuickSim: () => void;
  onLongSim: () => void;
  onPenalties: () => void;
  onReset: () => void;
  showReset?: boolean;
  locked?: boolean;
}) {
  const [dispHome, setDispHome] = useState(result?.homeScore ?? 0);
  const [dispAway, setDispAway] = useState(result?.awayScore ?? 0);

  useEffect(() => {
    if (!result) { setDispHome(0); setDispAway(0); return; }
    if (isAnimating) {
      const c1 = animateScore(result.homeScore, setDispHome);
      const c2 = animateScore(result.awayScore, setDispAway);
      return () => { c1(); c2(); };
    } else {
      setDispHome(result.homeScore);
      setDispAway(result.awayScore);
    }
  }, [result?.homeScore, result?.awayScore, isAnimating]);

  if (!homeTeam || !awayTeam) return null;
  const userScore = result ? (isUserHome ? result.homeScore : result.awayScore) : 0;
  const oppScore  = result ? (isUserHome ? result.awayScore : result.homeScore) : 0;
  const resultLabel = userScore > oppScore ? 'WIN ✓' : userScore < oppScore ? 'LOSS ✗' : 'DRAW';
  const resultColor = userScore > oppScore ? COLORS.success : userScore < oppScore ? COLORS.danger : COLORS.warning;

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchCardHeader}>
        <Text style={styles.matchMD}>MD{fixture.matchday}</Text>
        <Text style={styles.matchDate}>{fixture.date}</Text>
        <Text style={styles.matchVenue} numberOfLines={1}>{fixture.venue}</Text>
      </View>
      <View style={styles.matchTeams}>
        <View style={styles.matchTeamSide}>
          <PixelFlag isoCode={homeTeam.isoCode} size={24} />
          <Text style={[styles.matchTeamName, homeTeam.id === selectedNationId && styles.matchTeamNameUser]} numberOfLines={1}>
            {homeTeam.code3}
          </Text>
        </View>
        <View style={styles.matchScoreBox}>
          {result ? (
            <Text style={styles.matchScore}>{dispHome} – {dispAway}</Text>
          ) : (
            <Text style={styles.matchVs}>VS</Text>
          )}
        </View>
        <View style={[styles.matchTeamSide, styles.matchTeamRight]}>
          <Text style={[styles.matchTeamName, awayTeam.id === selectedNationId && styles.matchTeamNameUser]} numberOfLines={1}>
            {awayTeam.code3}
          </Text>
          <PixelFlag isoCode={awayTeam.isoCode} size={24} />
        </View>
      </View>
      {!result && !locked && (
        <View style={styles.matchBtns}>
          <TouchableOpacity style={styles.longSimBtn} onPress={onLongSim} activeOpacity={0.8}>
            <Text style={styles.longSimBtnText}>▶ LONG SIM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.simBtn} onPress={onQuickSim} activeOpacity={0.8}>
            <Text style={styles.simBtnText}>⚡ QUICK SIM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={onPenalties} activeOpacity={0.8}>
            <Text style={styles.playBtnText}>🥅 PENALTIES</Text>
          </TouchableOpacity>
        </View>
      )}
      {!result && locked && (
        <View style={styles.matchLockedRow}>
          <Text style={styles.matchLockedText}>🔒 Play previous matchday first</Text>
        </View>
      )}
      {result && (
        <View style={styles.matchResultRow}>
          <Text style={[styles.matchResultText, { color: resultColor }]}>{resultLabel}</Text>
          {showReset && (
            <TouchableOpacity onPress={onReset} activeOpacity={0.7}>
              <Text style={styles.resetMatchText}>↺ RESET</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Confetti component (winner screen) ───────────────────────────────────────
const CONFETTI_COLORS = ['#ffd700', '#ff4444', '#44ff88', '#4488ff', '#ff88ff', '#ff8800'];
function Confetti() {
  const pieces = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      x:     Math.random() * SCREEN_W,               // plain number — never animated
      y:     new Animated.Value(-20 - Math.random() * 100),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size:  6 + Math.floor(Math.random() * 8),
      delay: i * 80,
    })),
  ).current;

  useEffect(() => {
    const anims = pieces.map((p) =>
      Animated.loop(
        Animated.timing(p.y, {
          toValue: 900,
          duration: 2000 + Math.random() * 1500,
          delay: p.delay,
          useNativeDriver: true,
        }),
      ),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            width: p.size,
            height: p.size,
            borderRadius: 2,
            backgroundColor: p.color,
            transform: [{ translateY: p.y }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Standings table row ──────────────────────────────────────────────────────
function StandingsRow({ row, pos, isUser }: { row: TeamStanding; pos: number; isUser: boolean }) {
  const team = NATIONS_BY_ID[row.teamId];
  const gd   = row.goalsFor - row.goalsAgainst;
  return (
    <View style={[styles.standRow, isUser && styles.standRowUser]}>
      <Text style={styles.standPos}>{pos}</Text>
      <Text style={styles.standFlag}>{team?.flag ?? '🏳️'}</Text>
      <Text style={[styles.standName, isUser && styles.standNameUser]} numberOfLines={1}>
        {team?.name ?? row.teamId}
      </Text>
      <Text style={styles.standStat}>{row.played}</Text>
      <Text style={styles.standStat}>{row.won}</Text>
      <Text style={styles.standStat}>{row.drawn}</Text>
      <Text style={styles.standStat}>{row.lost}</Text>
      <Text style={styles.standStat}>{gd > 0 ? '+' : ''}{gd}</Text>
      <Text style={styles.standPts}>{row.points}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function TournamentScreen({ navigation }: Props) {
  // ── Stores ──────────────────────────────────────────────────────────────
  const {
    isActive, hasWon, isEliminated, eliminatedAt, eliminatedBy,
    selectedNationId,
    startTournament, setEliminated, setWon, resetTournament,
  } = useTournamentStore();

  const results          = useTournamentMatchStore((s) => s.results);
  const standings        = useTournamentMatchStore((s) => s.standings);
  const knockoutResults  = useTournamentMatchStore((s) => s.knockoutResults);
  const clearAllKnockoutResults = useTournamentMatchStore((s) => s.clearAllKnockoutResults);
  const clearAllResults        = useTournamentMatchStore((s) => s.clearAll);


  // ── Derived nation data ──────────────────────────────────────────────────
  const userNation = selectedNationId ? NATIONS_BY_ID[selectedNationId] : null;
  const userGroup  = userNation?.group ?? null;

  // ── Group fixtures for user's 3 matches ─────────────────────────────────
  const userGroupFixtures = useMemo(() =>
    userGroup
      ? GROUP_FIXTURES.filter(
          (f) => f.group === userGroup &&
            (f.homeTeamId === selectedNationId || f.awayTeamId === selectedNationId),
        )
      : [],
    [userGroup, selectedNationId],
  );

  // ── All group fixtures (to know if all 3 played) ─────────────────────────
  const allUserGroupPlayed = userGroupFixtures.every((f) => f.id in results);

  // ── Group standings for user's group ────────────────────────────────────
  const groupStandings = useMemo(() =>
    userGroup ? selectTournamentStandings(standings, userGroup) : [],
    [standings, userGroup],
  );

  // User's position in group (1-based)
  const userPosition = useMemo(() =>
    groupStandings.findIndex((s) => s.teamId === selectedNationId) + 1,
    [groupStandings, selectedNationId],
  );

  // ── Qualification determination ──────────────────────────────────────────
  // Returns: 'qualified' | 'eliminated' | 'pending'
  const qualificationStatus = useMemo((): 'qualified' | 'eliminated' | 'pending' => {
    if (!allUserGroupPlayed) return 'pending';
    if (userPosition <= 2) return 'qualified';
    if (userPosition === 4) return 'eliminated';
    // 3rd place: check if user is in the best 8 third-placers
    // getBestThirdPlacers returns null until all 12 groups are complete
    const best8 = getBestThirdPlacers(standings, results);
    if (best8 === null) return 'pending'; // other groups still in progress
    return best8.some((t: { teamId: string }) => t.teamId === selectedNationId) ? 'qualified' : 'eliminated';
  }, [allUserGroupPlayed, userPosition, standings, results, selectedNationId]);

  // ── Resolved knockout bracket ────────────────────────────────────────────
  const resolvedBracket = useMemo(
    () => resolveKnockoutBracket(standings, results, knockoutResults),
    [standings, results, knockoutResults],
  );

  // ── User's next knockout match ───────────────────────────────────────────
  const userNextMatch = useMemo(() => {
    if (!selectedNationId) return null;
    return resolvedBracket.find(
      (m) =>
        (m.homeTeamId === selectedNationId || m.awayTeamId === selectedNationId) &&
        m.result === null,
    ) ?? null;
  }, [resolvedBracket, selectedNationId]);

  // Check if user was knocked out (exists in a result as loser)
  const userLastKnockoutMatch = useMemo(() => {
    if (!selectedNationId) return null;
    return resolvedBracket
      .filter(
        (m) =>
          m.result !== null &&
          (m.result.homeTeamId === selectedNationId || m.result.awayTeamId === selectedNationId),
      )
      .pop() ?? null;
  }, [resolvedBracket, selectedNationId]);

  // Detect win or loss in knockout (run once when relevant match result appears)
  useEffect(() => {
    if (!isActive || isEliminated || hasWon || !selectedNationId) return;
    if (!allUserGroupPlayed) return;
    if (qualificationStatus === 'eliminated') {
      setEliminated('groups', '');
      return;
    }

    if (!userLastKnockoutMatch?.result) return;
    const r = userLastKnockoutMatch.result;
    const userIsHome = r.homeTeamId === selectedNationId;
    const userScore  = userIsHome ? r.homeScore : r.awayScore;
    const oppScore   = userIsHome ? r.awayScore : r.homeScore;
    const oppId      = userIsHome ? r.awayTeamId : r.homeTeamId;

    if (userScore < oppScore) {
      const round = userLastKnockoutMatch.def.round as KnockoutRound;
      setEliminated(round, oppId);
    } else if (userLastKnockoutMatch.def.round === 'Final' && userScore > oppScore) {
      setWon();
    }
  }, [userLastKnockoutMatch, qualificationStatus, allUserGroupPlayed, isActive, isEliminated, hasWon]);

  // ── Helper: sim all remaining group fixtures (excluding user's own) ─────
  // Used by both the safety net and the 3rd-place auto-resolve effect.
  function simMissingGroupFixtures() {
    const freshResults   = useTournamentMatchStore.getState().results;
    const userFixtureIds = new Set((userGroupFixtures ?? []).map((f) => f.id));
    const missing = GROUP_FIXTURES.filter(
      (f) => !(f.id in freshResults) && !userFixtureIds.has(f.id),
    );
    if (missing.length === 0) return;
    console.log(`[Tournament] Simulating ${missing.length} missing group fixtures`);
    for (const f of missing) {
      const h = NATIONS_BY_ID[f.homeTeamId];
      const a = NATIONS_BY_ID[f.awayTeamId];
      if (!h || !a) continue;
      const evts = simulateMatch(h, a, 'en');
      const sc   = computeScore(evts, h.id, a.id);
      useTournamentMatchStore.getState().saveResult({
        fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id,
        homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
      });
    }
  }

  // ── Safety net: if we somehow enter knockout with missing group fixtures ───
  // Fires at most once per component lifetime (safetyNetRanRef guard).
  const inKnockoutPhase = qualificationStatus === 'qualified' && allUserGroupPlayed;
  const safetyNetRanRef = useRef(false);
  useEffect(() => {
    if (!inKnockoutPhase) return;
    if (safetyNetRanRef.current) return;
    safetyNetRanRef.current = true;
    simMissingGroupFixtures();
  }, [inKnockoutPhase]);

  // ── 3rd-place auto-resolve: sim all other groups so qualification can be determined ──
  // Fires once when user finishes all 3 group matches in 3rd place.
  const thirdPlaceAutoRanRef = useRef(false);
  const userFinishedThird = allUserGroupPlayed && userPosition === 3;
  useEffect(() => {
    if (!userFinishedThird) return;
    if (thirdPlaceAutoRanRef.current) return;
    thirdPlaceAutoRanRef.current = true;
    simMissingGroupFixtures();
  }, [userFinishedThird]);

  // ── Action: simulate a group match ──────────────────────────────────────
  // Uses useTournamentMatchStore.getState() directly to bypass React batching.
  // After saving the user's result, immediately sims ALL remaining group
  // fixtures in one synchronous pass — guaranteed to see fresh store state.
  const handleSimulateGroup = useCallback((fixtureId: string) => {
    const fixture = GROUP_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const home = NATIONS_BY_ID[fixture.homeTeamId];
    const away = NATIONS_BY_ID[fixture.awayTeamId];
    if (!home || !away) return;

    // Step 1: save user's own match
    const events = simulateMatch(home, away, 'en');
    const score  = computeScore(events, home.id, away.id);
    useTournamentMatchStore.getState().saveResult({
      fixtureId,
      homeTeamId:  home.id,
      awayTeamId:  away.id,
      homeScore:   score.home,
      awayScore:   score.away,
      events,
      simulatedAt: Date.now(),
    });

    // Step 2: read fresh state and sim every remaining group fixture (skip user's own)
    const freshResults   = useTournamentMatchStore.getState().results;
    const userFixtureIds = new Set(userGroupFixtures.map((f) => f.id));
    const remaining      = GROUP_FIXTURES.filter(
      (f) => !(f.id in freshResults) && !userFixtureIds.has(f.id),
    );
    console.log(`[AutoSim] Simulating ${remaining.length} remaining fixtures...`);
    for (const f of remaining) {
      const h = NATIONS_BY_ID[f.homeTeamId];
      const a = NATIONS_BY_ID[f.awayTeamId];
      if (!h || !a) continue;
      const evts = simulateMatch(h, a, 'en');
      const sc   = computeScore(evts, h.id, a.id);
      useTournamentMatchStore.getState().saveResult({
        fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id,
        homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
      });
    }
    console.log('[AutoSim] Done');
  }, [userGroupFixtures]);

  // ── Action: simulate a knockout match ───────────────────────────────────
  const handleSimulateKnockout = useCallback(() => {
    if (!userNextMatch) return;
    const { def, homeTeamId, awayTeamId } = userNextMatch;
    if (!homeTeamId || !awayTeamId) return;
    const home = NATIONS_BY_ID[homeTeamId];
    const away = NATIONS_BY_ID[awayTeamId];
    if (!home || !away) return;
    const events = simulateMatch(home, away, 'en');
    const score  = computeScore(events, home.id, away.id);
    // Handle draw: home team wins (no extra time in quick sim)
    const finalHome = score.home === score.away ? score.home + 1 : score.home;
    useTournamentMatchStore.getState().saveKnockoutResult({
      matchId:    def.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeScore:  finalHome,
      awayScore:  score.away,
      events,
      simulatedAt: Date.now(),
    });

    // Auto-sim all other resolvable KO matches (multi-pass until nothing new)
    for (let pass = 0; pass < 32; pass++) {
      const s        = useTournamentMatchStore.getState();
      const resolved = resolveKnockoutBracket(s.standings, s.results, s.knockoutResults);
      let simmedAny  = false;
      for (const match of resolved) {
        if (
          match.homeTeamId && match.awayTeamId &&
          !s.knockoutResults[match.def.id] &&
          match.homeTeamId !== selectedNationId &&
          match.awayTeamId !== selectedNationId
        ) {
          const h = NATIONS_BY_ID[match.homeTeamId];
          const a = NATIONS_BY_ID[match.awayTeamId];
          if (!h || !a) continue;
          const evts = simulateMatch(h, a, 'en');
          const sc   = computeScore(evts, h.id, a.id);
          const hs   = sc.home === sc.away ? sc.home + 1 : sc.home;
          useTournamentMatchStore.getState().saveKnockoutResult({
            matchId:    match.def.id,
            homeTeamId: h.id,
            awayTeamId: a.id,
            homeScore:  hs,
            awayScore:  sc.away,
            events:     evts,
            simulatedAt: Date.now(),
          });
          simmedAny = true;
        }
      }
      if (!simmedAny) break;
    }
  }, [userNextMatch, selectedNationId]);


  // ── Score animation: track which group fixture was just quick-simmed ──────
  const [justSimmedGroupId, setJustSimmedGroupId] = useState<string | null>(null);

  const handleSimulateGroupAnimated = useCallback((fixtureId: string) => {
    handleSimulateGroup(fixtureId);
    setJustSimmedGroupId(fixtureId);
    setTimeout(() => setJustSimmedGroupId(null), 700);
  }, [handleSimulateGroup]);

  // ── Share result ──────────────────────────────────────────────────────────
  const handleShare = useCallback(async (nationName: string) => {
    try {
      await Share.share({
        message: `🏆 ${nationName} won the World Cup 2026! #Fitbolpix #WC2026`,
      });
    } catch (_) {}
  }, []);

  // ── Action: start tournament ─────────────────────────────────────────────
  const [pickedNation, setPickedNation] = React.useState<string | null>(null);

  const handleBeginJourney = useCallback(() => {
    if (!pickedNation) return;
    const nation = NATIONS_BY_ID[pickedNation];
    if (!nation) return;
    // Clear ALL tournament match data and restart fresh
    clearAllResults();
    clearAllKnockoutResults();
    startTournament(pickedNation);
  }, [pickedNation, clearAllResults, clearAllKnockoutResults, startTournament]);

  // ── Action: reset / try again ─────────────────────────────────────────────
  const handleReset = useCallback(() => {
    clearAllResults();
    clearAllKnockoutResults();
    resetTournament();
    setPickedNation(null);
  }, [clearAllResults, clearAllKnockoutResults, resetTournament]);

  // ── Action: start over (escape hatch from any stuck state) ───────────────
  const handleStartOver = useCallback(() => {
    Alert.alert(
      'Start over?',
      'Your tournament progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Over',
          style: 'destructive',
          onPress: () => {
            clearAllResults();
            clearAllKnockoutResults();
            resetTournament();
            setPickedNation(null);
          },
        },
      ],
    );
  }, [clearAllResults, clearAllKnockoutResults, resetTournament]);

  // ── Overlay state (inline WebViews for sim + penalty) ─────────────────
  const [penOverlay, setPenOverlay] = useState<PenaltyOverlay | null>(null);
  const [simOverlay, setSimOverlay] = useState<SimOverlay | null>(null);

  // ── Helper: auto-sim all resolvable KO matches (not involving user) ──
  const autoSimKnockout = useCallback(() => {
    for (let pass = 0; pass < 32; pass++) {
      const s        = useTournamentMatchStore.getState();
      const resolved = resolveKnockoutBracket(s.standings, s.results, s.knockoutResults);
      let simmedAny  = false;
      for (const match of resolved) {
        if (
          match.homeTeamId && match.awayTeamId &&
          !s.knockoutResults[match.def.id] &&
          match.homeTeamId !== selectedNationId &&
          match.awayTeamId !== selectedNationId
        ) {
          const h = NATIONS_BY_ID[match.homeTeamId];
          const a = NATIONS_BY_ID[match.awayTeamId];
          if (!h || !a) continue;
          const evts = simulateMatch(h, a, 'en');
          const sc   = computeScore(evts, h.id, a.id);
          const hs   = sc.home === sc.away ? sc.home + 1 : sc.home;
          useTournamentMatchStore.getState().saveKnockoutResult({
            matchId: match.def.id, homeTeamId: h.id, awayTeamId: a.id,
            homeScore: hs, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
          });
          simmedAny = true;
        }
      }
      if (!simmedAny) break;
    }
  }, [selectedNationId]);

  // ── Launch group LONG SIM overlay ──────────────────────────────────
  const handleGroupLongSim = useCallback((fixtureId: string) => {
    const fixture = GROUP_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const home = NATIONS_BY_ID[fixture.homeTeamId];
    const away = NATIONS_BY_ID[fixture.awayTeamId];
    if (!home || !away) return;
    const { html, events, score } = buildSimConfig(home, away);
    setSimOverlay({
      key: `sim-grp-${fixtureId}-${Date.now()}`,
      homeTeamId: home.id, awayTeamId: away.id,
      html, fixtureId, simScore: score, simEvents: events,
      contextLabel: `GROUP ${fixture.group} · MATCHDAY ${fixture.matchday}`,
      teamsLabel: `${home.code3} vs ${away.code3}`,
    });
  }, []);

  // ── Launch group PENALTIES overlay ─────────────────────────────────
  const handleGroupPenalties = useCallback((fixtureId: string) => {
    const fixture = GROUP_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const userIsHome = fixture.homeTeamId === selectedNationId;
    setPenOverlay({
      key: `pen-grp-${fixtureId}-${Date.now()}`,
      homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId,
      mode: 'best_of_5', fixtureId,
      userTeam: userIsHome ? 'home' : 'away',
    });
  }, [selectedNationId]);

  // ── Reset a single group match result ────────────────────────────
  const handleResetGroupMatch = useCallback((fixtureId: string) => {
    const fixture = GROUP_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const group = fixture.group;
    // Collect all other results in this group (excluding the one being reset)
    const currentResults = useTournamentMatchStore.getState().results;
    const groupFixtures = GROUP_FIXTURES.filter((f) => f.group === group);
    const otherResults = groupFixtures
      .filter((f) => f.id !== fixtureId && currentResults[f.id])
      .map((f) => currentResults[f.id]);
    // Clear all group results (resets standings too)
    useTournamentMatchStore.getState().clearGroupResults(group);
    // Re-save the remaining results (recalculates standings each time)
    for (const r of otherResults) {
      useTournamentMatchStore.getState().saveResult(r);
    }
  }, []);

  // ── Launch knockout LONG SIM overlay ───────────────────────────────
  const handleKnockoutLongSim = useCallback(() => {
    if (!userNextMatch) return;
    const { def, homeTeamId, awayTeamId } = userNextMatch;
    if (!homeTeamId || !awayTeamId) return;
    const home = NATIONS_BY_ID[homeTeamId];
    const away = NATIONS_BY_ID[awayTeamId];
    if (!home || !away) return;
    const { html, events, score } = buildSimConfig(home, away);
    setSimOverlay({
      key: `sim-ko-${def.id}-${Date.now()}`,
      homeTeamId: home.id, awayTeamId: away.id,
      html, matchId: def.id, simScore: score, simEvents: events,
      contextLabel: `KNOCKOUT · ${ROUND_LABELS[def.round] ?? def.round}`,
      teamsLabel: `${home.code3} vs ${away.code3}`,
    });
  }, [userNextMatch]);

  // ── Launch knockout PENALTIES overlay ──────────────────────────────
  const handleKnockoutPenalties = useCallback(() => {
    if (!userNextMatch) return;
    const { def, homeTeamId, awayTeamId } = userNextMatch;
    if (!homeTeamId || !awayTeamId) return;
    const userIsHome = homeTeamId === selectedNationId;
    setPenOverlay({
      key: `pen-ko-${def.id}-${Date.now()}`,
      homeTeamId, awayTeamId,
      mode: 'sudden_death', matchId: def.id,
      userTeam: userIsHome ? 'home' : 'away',
    });
  }, [userNextMatch, selectedNationId]);

  // ── Handle sim overlay result ──────────────────────────────────────
  const handleSimMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== 'MATCH_RESULT') return;
      const ov = simOverlay;
      if (!ov) return;

      if (ov.fixtureId && !ov.matchId) {
        // Group stage sim — save result and auto-sim remaining
        useTournamentMatchStore.getState().saveResult({
          fixtureId: ov.fixtureId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
          homeScore: ov.simScore.home, awayScore: ov.simScore.away,
          events: ov.simEvents, simulatedAt: Date.now(),
        });
        // Auto-sim remaining group fixtures
        const freshResults = useTournamentMatchStore.getState().results;
        const userFixtureIds = new Set(userGroupFixtures.map((f) => f.id));
        const remaining = GROUP_FIXTURES.filter(
          (f) => !(f.id in freshResults) && !userFixtureIds.has(f.id),
        );
        for (const f of remaining) {
          const h = NATIONS_BY_ID[f.homeTeamId];
          const a = NATIONS_BY_ID[f.awayTeamId];
          if (!h || !a) continue;
          const evts = simulateMatch(h, a, 'en');
          const sc   = computeScore(evts, h.id, a.id);
          useTournamentMatchStore.getState().saveResult({
            fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id,
            homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
          });
        }
        setSimOverlay(null);
      } else if (ov.matchId != null) {
        // Knockout sim — check for draw → trigger penalty
        const hs = ov.simScore.home;
        const as_ = ov.simScore.away;
        if (hs === as_) {
          // Draw in knockout → close sim, launch penalty sudden_death
          setSimOverlay(null);
          setPenOverlay({
            key: `pen-ko-draw-${ov.matchId}-${Date.now()}`,
            homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
            mode: 'sudden_death', matchId: ov.matchId,
            userTeam: ov.homeTeamId === selectedNationId ? 'home' : 'away',
          });
        } else {
          // Clear winner — save directly
          useTournamentMatchStore.getState().saveKnockoutResult({
            matchId: ov.matchId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
            homeScore: hs, awayScore: as_, events: ov.simEvents, simulatedAt: Date.now(),
          });
          autoSimKnockout();
          setSimOverlay(null);
        }
      }
    } catch (_) {}
  }, [simOverlay, userGroupFixtures, autoSimKnockout]);

  // ── Handle penalty overlay result ──────────────────────────────────
  const handlePenMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'back') { setPenOverlay(null); return; }
      if (msg.type === 'restart') {
        // Re-launch with new key
        if (penOverlay) setPenOverlay({ ...penOverlay, key: `${penOverlay.key}-r${Date.now()}` });
        return;
      }
      if (msg.type !== 'result') return;
      const ov = penOverlay;
      if (!ov) return;

      if (ov.fixtureId && !ov.matchId) {
        // Group stage penalty — use penalty score as the match score
        useTournamentMatchStore.getState().saveResult({
          fixtureId: ov.fixtureId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
          homeScore: msg.homeScore, awayScore: msg.awayScore,
          events: [], simulatedAt: Date.now(),
        });
        // Auto-sim remaining group fixtures
        const freshResults = useTournamentMatchStore.getState().results;
        const userFixtureIds = new Set(userGroupFixtures.map((f) => f.id));
        const remaining = GROUP_FIXTURES.filter(
          (f) => !(f.id in freshResults) && !userFixtureIds.has(f.id),
        );
        for (const f of remaining) {
          const h = NATIONS_BY_ID[f.homeTeamId];
          const a = NATIONS_BY_ID[f.awayTeamId];
          if (!h || !a) continue;
          const evts = simulateMatch(h, a, 'en');
          const sc   = computeScore(evts, h.id, a.id);
          useTournamentMatchStore.getState().saveResult({
            fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id,
            homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
          });
        }
        setPenOverlay(null);
      } else if (ov.matchId != null) {
        // Knockout penalty
        useTournamentMatchStore.getState().saveKnockoutResult({
          matchId: ov.matchId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
          homeScore: msg.homeScore, awayScore: msg.awayScore,
          events: [], simulatedAt: Date.now(),
        });
        autoSimKnockout();
        setPenOverlay(null);
      }
    } catch (_) {}
  }, [penOverlay, userGroupFixtures, autoSimKnockout]);

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 1 — IDLE (no tournament active)
  // ═════════════════════════════════════════════════════════════════════════
  if (!isActive) {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.idleScroll}>
          <Text style={styles.journeyTitle}>⚽ YOUR WORLD CUP</Text>
          <Text style={styles.journeyTitle2}>JOURNEY 2026</Text>
          <Text style={styles.journeySubtitle}>Pick your nation and write history</Text>

          {/* Nation grid */}
          <FlatList
            data={NATIONS}
            keyExtractor={(t) => t.id}
            numColumns={4}
            scrollEnabled={false}
            contentContainerStyle={styles.nationGrid}
            renderItem={({ item }) => {
              const isSelected = item.id === pickedNation;
              return (
                <TouchableOpacity
                  style={[styles.nationTile, isSelected && styles.nationTileSelected]}
                  onPress={() => setPickedNation(item.id)}
                  activeOpacity={0.7}
                >
                  <PixelFlag isoCode={item.isoCode} size={22} />
                  <Text style={[styles.nationTileName, isSelected && styles.nationTileNameSel]} numberOfLines={1}>
                    {item.code3}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Selected nation detail card */}
          {pickedNation && NATIONS_BY_ID[pickedNation] && (
            <View style={styles.selectedCard}>
              <PixelFlag isoCode={NATIONS_BY_ID[pickedNation].isoCode} size={56} />
              <View style={styles.selectedCardInfo}>
                <Text style={styles.selectedCardName}>{NATIONS_BY_ID[pickedNation].name}</Text>
                <Text style={styles.selectedCardGroup}>Group {NATIONS_BY_ID[pickedNation].group}</Text>
                <EloBar strength={NATIONS_BY_ID[pickedNation].strength} />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.beginBtn, !pickedNation && styles.beginBtnDisabled]}
            onPress={handleBeginJourney}
            activeOpacity={pickedNation ? 0.8 : 1}
          >
            <Text style={styles.beginBtnText}>BEGIN JOURNEY ▶</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 4 — WINNER
  // ═════════════════════════════════════════════════════════════════════════
  if (hasWon && userNation) {
    // Compute overall stats from all user matches
    const userStats = computeUserStats(selectedNationId!, results, knockoutResults);
    return (
      <SafeAreaView style={[styles.root, styles.winnerRoot]}>
        <Confetti />
        <TouchableOpacity style={styles.startOverBtn} onPress={handleStartOver} activeOpacity={0.7}>
          <Text style={styles.startOverBtnText}>↺ Reset</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.winnerScroll}>
          <Text style={styles.winnerTrophy}>🏆</Text>
          <Text style={styles.winnerTitle}>WORLD CUP</Text>
          <Text style={styles.winnerTitle2}>CHAMPIONS!</Text>
          <View style={styles.winnerFlagRow}>
            <PixelFlag isoCode={userNation.isoCode} size={64} />
          </View>
          <Text style={styles.winnerNation}>{userNation.name.toUpperCase()}</Text>
          <Text style={styles.winnerSub}>WON THE WORLD CUP 2026!</Text>

          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>TOURNAMENT STATS</Text>
            <View style={styles.statsRow}>
              {(['P','W','D','L','GF','GA'] as const).map((label, i) => (
                <View key={label} style={styles.statCell}>
                  <Text style={styles.statLabel}>{label}</Text>
                  <Text style={styles.statValue}>{[
                    userStats.played, userStats.won, userStats.drawn,
                    userStats.lost, userStats.gf, userStats.ga,
                  ][i]}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => handleShare(userNation.name)}
            activeOpacity={0.8}
          >
            <Text style={styles.shareBtnText}>📤  SHARE YOUR WIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
            <Text style={styles.resetBtnText}>🔄  PLAY AGAIN</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 5 — ELIMINATED
  // ═════════════════════════════════════════════════════════════════════════
  if (isEliminated && userNation) {
    const byTeam    = eliminatedBy ? NATIONS_BY_ID[eliminatedBy] : null;
    const roundLabel = eliminatedAt === 'groups'
      ? 'GROUP STAGE'
      : ROUND_LABELS[eliminatedAt ?? ''] ?? eliminatedAt ?? '';
    const userStats = computeUserStats(selectedNationId!, results, knockoutResults);

    return (
      <SafeAreaView style={[styles.root, styles.elimRoot]}>
        <TouchableOpacity style={styles.startOverBtn} onPress={handleStartOver} activeOpacity={0.7}>
          <Text style={styles.startOverBtnText}>↺ Reset</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.elimScroll}>
          <Text style={styles.elimEmoji}>💔</Text>
          <Text style={styles.elimTitle}>ELIMINATED</Text>
          <Text style={styles.elimRound}>at the {roundLabel}</Text>

          {byTeam && (
            <View style={styles.elimByCard}>
              <Text style={styles.elimByLabel}>Beaten by</Text>
              <Text style={styles.elimByFlag}>{byTeam.flag}</Text>
              <Text style={styles.elimByName}>{byTeam.name}</Text>
            </View>
          )}

          <Text style={styles.elimNation}>{userNation.flag} {userNation.name}</Text>

          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>TOURNAMENT STATS</Text>
            <View style={styles.statsRow}>
              {(['P','W','D','L','GF','GA'] as const).map((label, i) => (
                <View key={label} style={styles.statCell}>
                  <Text style={styles.statLabel}>{label}</Text>
                  <Text style={styles.statValue}>{[
                    userStats.played, userStats.won, userStats.drawn,
                    userStats.lost, userStats.gf, userStats.ga,
                  ][i]}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
            <Text style={styles.resetBtnText}>TRY AGAIN →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 2 — GROUP STAGE
  // ═════════════════════════════════════════════════════════════════════════
  // inKnockoutPhase is declared above (used by safety-net useEffect)

  if (!inKnockoutPhase && userNation && userGroup) {
    const allGroupFixtures = GROUP_FIXTURES.filter((f) => f.group === userGroup);

    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.groupHeader}>
            <Text style={styles.groupLabel}>GROUP {userGroup}</Text>
            <Text style={styles.groupNationBadge}>
              {userNation.flag}  {userNation.name}
            </Text>
            <TouchableOpacity onPress={handleStartOver} activeOpacity={0.7} style={styles.startOverBtn}>
              <Text style={styles.startOverBtnText}>↺ Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Standings table */}
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.tableHPos}>#</Text>
              <Text style={[styles.tableHName, { marginLeft: 28 }]}>TEAM</Text>
              <Text style={styles.tableHStat}>P</Text>
              <Text style={styles.tableHStat}>W</Text>
              <Text style={styles.tableHStat}>D</Text>
              <Text style={styles.tableHStat}>L</Text>
              <Text style={styles.tableHStat}>GD</Text>
              <Text style={styles.tableHPts}>PTS</Text>
            </View>
            {groupStandings.length > 0
              ? groupStandings.map((row, i) => (
                  <StandingsRow
                    key={row.teamId}
                    row={row}
                    pos={i + 1}
                    isUser={row.teamId === selectedNationId}
                  />
                ))
              : allGroupFixtures
                  .map((f) => [f.homeTeamId, f.awayTeamId])
                  .flat()
                  .filter((id, idx, arr) => arr.indexOf(id) === idx)
                  .map((teamId, i) => {
                    const t = NATIONS_BY_ID[teamId];
                    return (
                      <View key={teamId} style={[styles.standRow, teamId === selectedNationId && styles.standRowUser]}>
                        <Text style={styles.standPos}>{i + 1}</Text>
                        <Text style={styles.standFlag}>{t?.flag ?? '🏳️'}</Text>
                        <Text style={[styles.standName, teamId === selectedNationId && styles.standNameUser]}
                          numberOfLines={1}>
                          {t?.name ?? teamId}
                        </Text>
                        <Text style={styles.standStat}>0</Text>
                        <Text style={styles.standStat}>0</Text>
                        <Text style={styles.standStat}>0</Text>
                        <Text style={styles.standStat}>0</Text>
                        <Text style={styles.standStat}>0</Text>
                        <Text style={styles.standPts}>0</Text>
                      </View>
                    );
                  })}
          </View>

          {/* User's 3 match cards */}
          <View style={styles.progressRow}>
            <Text style={styles.sectionTitle}>YOUR MATCHES</Text>
            <Text style={styles.progressText}>
              {userGroupFixtures.filter((f) => f.id in results).length} / 3 played
            </Text>
          </View>
          {userGroupFixtures.map((fixture) => {
            const homeTeam   = NATIONS_BY_ID[fixture.homeTeamId];
            const awayTeam   = NATIONS_BY_ID[fixture.awayTeamId];
            const result     = results[fixture.id] ?? null;
            const isUserHome = fixture.homeTeamId === selectedNationId;
            const isAnimating = justSimmedGroupId === fixture.id;
            // Enforce matchday order: MD2 locked until MD1 played, MD3 locked until MD2 played
            const md1Done = userGroupFixtures.filter((f) => f.matchday === 1 && f.id in results).length === 1;
            const md2Done = userGroupFixtures.filter((f) => f.matchday === 2 && f.id in results).length === 1;
            const isLocked = (fixture.matchday === 2 && !md1Done) || (fixture.matchday === 3 && !md2Done);

            return (
              <GroupMatchCard
                key={fixture.id}
                fixture={fixture}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                result={result}
                isUserHome={isUserHome}
                isAnimating={isAnimating}
                selectedNationId={selectedNationId!}
                onQuickSim={() => handleSimulateGroupAnimated(fixture.id)}
                onLongSim={() => handleGroupLongSim(fixture.id)}
                onPenalties={() => handleGroupPenalties(fixture.id)}
                onReset={() => handleResetGroupMatch(fixture.id)}
                showReset={false}
                locked={isLocked}
              />
            );
          })}

          {/* Qualification status */}
          {allUserGroupPlayed && (
            <View style={[
              styles.qualBanner,
              qualificationStatus === 'qualified' && styles.qualBannerGreen,
              qualificationStatus === 'eliminated' && styles.qualBannerRed,
              qualificationStatus === 'pending'    && styles.qualBannerYellow,
            ]}>
              {qualificationStatus === 'qualified' && (
                <>
                  <Text style={styles.qualEmoji}>🎉</Text>
                  <Text style={styles.qualText}>QUALIFIED! {userNation.name} advance to the Round of 32!</Text>
                </>
              )}
              {qualificationStatus === 'eliminated' && (
                <>
                  <Text style={styles.qualEmoji}>💔</Text>
                  <Text style={styles.qualText}>Eliminated at the group stage.</Text>
                </>
              )}
              {qualificationStatus === 'pending' && (
                <>
                  <Text style={styles.qualEmoji}>⏳</Text>
                  <Text style={styles.qualText}>3rd place — awaiting results from other groups...</Text>
                </>
              )}
            </View>
          )}

          {qualificationStatus === 'qualified' && (
            <TouchableOpacity style={styles.advanceBtn} onPress={() => {/* already advances via phase check */}} activeOpacity={0.8}>
              <Text style={styles.advanceBtnText}>ADVANCE TO KNOCKOUTS →</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        {renderOverlays()}
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 3 — KNOCKOUT
  // ═════════════════════════════════════════════════════════════════════════
  if (userNation) {
    const nextMatch = userNextMatch;
    const opponent  = nextMatch
      ? NATIONS_BY_ID[
          nextMatch.homeTeamId === selectedNationId
            ? (nextMatch.awayTeamId ?? '')
            : (nextMatch.homeTeamId ?? '')
        ]
      : null;

    const roundLabel  = nextMatch ? (ROUND_LABELS[nextMatch.def.round] ?? nextMatch.def.round) : '';
    const isUnderdog  = opponent ? opponent.strength > (userNation.strength + 50) : false;
    const isFavourite = opponent ? (userNation.strength > opponent.strength + 50) : false;

    // Count rounds already won in knockout
    const kWins = resolvedBracket.filter((m) => {
      if (!m.result) return false;
      const isHome = m.result.homeTeamId === selectedNationId;
      const uScore = isHome ? m.result.homeScore : m.result.awayScore;
      const oScore = isHome ? m.result.awayScore : m.result.homeScore;
      return uScore > oScore;
    }).length;

    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.koHeader}>
            <Text style={styles.koNationBadge}>{userNation.flag} {userNation.name}</Text>
            <Text style={styles.koWinCount}>{kWins} knockout win{kWins !== 1 ? 's' : ''} 🏆</Text>
            <TouchableOpacity onPress={handleStartOver} activeOpacity={0.7}>
              <Text style={styles.startOverBtnText}>↺ Reset</Text>
            </TouchableOpacity>
          </View>

          {nextMatch && opponent ? (
            <>
              {/* Round badge */}
              <View style={styles.roundBadge}>
                <Text style={styles.roundBadgeText}>{roundLabel}</Text>
              </View>

              {/* Match card */}
              <View style={styles.koMatchCard}>
                <Text style={styles.koMatchDate}>{nextMatch.def.date}  ·  {nextMatch.def.venue}</Text>

                <View style={styles.koMatchTeams}>
                  <View style={styles.koTeamSide}>
                    <PixelFlag isoCode={userNation.isoCode} size={40} />
                    <Text style={styles.koTeamName} numberOfLines={1}>{userNation.name}</Text>
                    <EloBar strength={userNation.strength} label={false} />
                  </View>
                  <Text style={styles.koVs}>VS</Text>
                  <View style={[styles.koTeamSide, styles.koTeamRight]}>
                    <PixelFlag isoCode={opponent.isoCode} size={40} />
                    <Text style={styles.koTeamName} numberOfLines={1}>{opponent.name}</Text>
                    <EloBar strength={opponent.strength} label={false} />
                  </View>
                </View>

                {/* Favourite / Underdog badge */}
                {(isFavourite || isUnderdog) && (
                  <View style={[styles.matchupBadge, isUnderdog && styles.matchupBadgeUnderdog]}>
                    <Text style={styles.matchupBadgeText}>
                      {isFavourite ? '⚡ You are the FAVOURITE' : '💪 UNDERDOG — Prove them wrong!'}
                    </Text>
                  </View>
                )}

                <View style={styles.koBtns}>
                  <TouchableOpacity
                    style={styles.longSimBtn}
                    onPress={handleKnockoutLongSim}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.longSimBtnText}>▶ LONG SIM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.koSimBtn}
                    onPress={handleSimulateKnockout}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.koSimBtnText}>⚡ QUICK SIM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.koPenBtn}
                    onPress={handleKnockoutPenalties}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.koPenBtnText}>🥅 PENALTIES</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Previous knockout results */}
              {resolvedBracket
                .filter((m) =>
                  m.result !== null &&
                  (m.result.homeTeamId === selectedNationId ||
                    m.result.awayTeamId === selectedNationId),
                )
                .map((m) => {
                  const r = m.result!;
                  const isHome = r.homeTeamId === selectedNationId;
                  const uScore = isHome ? r.homeScore : r.awayScore;
                  const oScore = isHome ? r.awayScore : r.homeScore;
                  const oppId  = isHome ? r.awayTeamId : r.homeTeamId;
                  const opp    = NATIONS_BY_ID[oppId];
                  const won    = uScore > oScore;
                  return (
                    <View key={m.def.id} style={styles.prevResultRow}>
                      <Text style={styles.prevResultRound}>{ROUND_LABELS[m.def.round] ?? m.def.round}</Text>
                      <Text style={[styles.prevResultScore, { color: won ? COLORS.success : COLORS.danger }]}>
                        {uScore}–{oScore}  {won ? '✓' : '✗'}
                      </Text>
                      <Text style={styles.prevResultOpp}>{opp?.flag} {opp?.name}</Text>
                    </View>
                  );
                })}
            </>
          ) : (
            // No next match yet — waiting for bracket to resolve
            <View style={styles.waitingCard}>
              <Text style={styles.waitingEmoji}>⏳</Text>
              <Text style={styles.waitingText}>Waiting for bracket to resolve...</Text>
              <Text style={styles.waitingHint}>
                Other group results determine your next opponent.
              </Text>
            </View>
          )}
        </ScrollView>
        {renderOverlays()}
      </SafeAreaView>
    );
  }

  // ── Overlay rendering helper ──────────────────────────────────────
  function renderOverlays() {
    if (simOverlay) {
      return (
        <View style={styles.overlayFull}>
          <View style={styles.overlayHeader}>
            <Text style={styles.overlayHeaderContext}>{simOverlay.contextLabel ?? ''}</Text>
            <Text style={styles.overlayHeaderTeams}>{simOverlay.teamsLabel ?? ''}</Text>
            <TouchableOpacity onPress={() => setSimOverlay(null)} style={styles.overlayHeaderClose} activeOpacity={0.7}>
              <Text style={styles.overlayCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <WebView
            key={simOverlay.key}
            source={{ html: simOverlay.html }}
            style={styles.overlayWebView}
            javaScriptEnabled
            originWhitelist={['*']}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onMessage={handleSimMessage}
          />
        </View>
      );
    }
    if (penOverlay) {
      const home = NATIONS_BY_ID[penOverlay.homeTeamId];
      const away = NATIONS_BY_ID[penOverlay.awayTeamId];
      const configScript = home && away
        ? buildPenaltyConfig(home, away, penOverlay.mode, penOverlay.userTeam)
        : 'true;';
      return (
        <View style={styles.overlayFull}>
          <WebView
            key={penOverlay.key}
            source={{ html: PENALTY_GAME_HTML }}
            style={styles.overlayWebView}
            javaScriptEnabled
            originWhitelist={['*']}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            injectedJavaScriptBeforeContentLoaded={configScript}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onMessage={handlePenMessage}
          />
          <TouchableOpacity style={styles.overlayCloseBtn} onPress={() => setPenOverlay(null)} activeOpacity={0.7}>
            <Text style={styles.overlayCloseBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }

  // Fallback (shouldn't reach here)
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.waitingCard}>
        <Text style={styles.waitingText}>Loading tournament...</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Helper: aggregate user's stats from all matches ─────────────────────────
function computeUserStats(
  nationId: string,
  results: Record<string, import('../types/matchResult').MatchResult>,
  knockoutResults: Record<number, import('../types/knockout').KnockoutResult>,
) {
  let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;

  const processMatch = (homeId: string, awayId: string, hs: number, as_: number) => {
    if (homeId !== nationId && awayId !== nationId) return;
    played++;
    const isHome = homeId === nationId;
    const uScore = isHome ? hs : as_;
    const oScore = isHome ? as_ : hs;
    gf += uScore; ga += oScore;
    if (uScore > oScore) won++;
    else if (uScore < oScore) lost++;
    else drawn++;
  };

  Object.values(results).forEach((r) =>
    processMatch(r.homeTeamId, r.awayTeamId, r.homeScore, r.awayScore),
  );
  Object.values(knockoutResults).forEach((r) =>
    processMatch(r.homeTeamId, r.awayTeamId, r.homeScore, r.awayScore),
  );

  return { played, won, drawn, lost, gf, ga };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bgPrimary },
  scroll:     { padding: SPACING.md, paddingBottom: SPACING.xl },
  idleScroll: { padding: SPACING.md, paddingBottom: 40 },

  // ── IDLE ──
  journeyTitle: {
    fontFamily: FONTS.heading,
    fontSize: 32,
    color: COLORS.accent,
    textAlign: 'center',
    letterSpacing: 3,
    marginTop: SPACING.sm,
  },
  journeyTitle2: {
    fontFamily: FONTS.heading,
    fontSize: 32,
    color: COLORS.accent,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 4,
  },
  journeySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  nationGrid: { gap: 2 },
  nationTile: {
    flex: 1,
    margin: 2,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    minWidth: (SCREEN_W - 32) / 4 - 4,
    maxWidth: (SCREEN_W - 32) / 4 - 4,
  },
  nationTileSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}28`,
  },
  nationTileFlag:    { fontSize: 22, marginBottom: 2 },
  nationTileName: {
    fontFamily: FONTS.body,
    fontSize: 8,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  nationTileNameSel: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.accent,
  },

  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  selectedCardFlag: { fontSize: 48 },
  selectedCardInfo: { flex: 1 },
  selectedCardName: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  selectedCardGroup: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  selectedCardElo: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  eloBarWrap:  { gap: 2, width: '100%' },
  eloBarTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  eloBarFill:  { height: '100%', borderRadius: 2 },
  eloBarLabel: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textMuted,
  },

  beginBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  beginBtnDisabled: { backgroundColor: COLORS.bgSurface, opacity: 0.5 },
  beginBtnText: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.bgPrimary,
    letterSpacing: 1,
  },

  // ── GROUP ──
  groupHeader: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  groupLabel: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.accent,
    letterSpacing: 3,
  },
  groupNationBadge: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  tableCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardAlt,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHPos:  {
    width: 20,
    fontFamily: FONTS.headingMedium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  tableHName: {
    flex: 1,
    fontFamily: FONTS.headingMedium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  tableHStat: {
    width: 26,
    fontFamily: FONTS.headingMedium,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  tableHPts: {
    width: 30,
    fontFamily: FONTS.headingMedium,
    fontSize: 11,
    color: COLORS.accent,
    textAlign: 'center',
  },

  standRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  standRowUser: { backgroundColor: `${COLORS.primary}20` },
  standPos:     {
    width: 20,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  standFlag:     { fontSize: 16, marginRight: 4 },
  standName: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  standNameUser: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.accent,
  },
  standStat: {
    width: 26,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  standPts: {
    width: 30,
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.accent,
    textAlign: 'center',
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  progressText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 13,
    color: COLORS.accent,
    letterSpacing: 2,
  },
  matchCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    gap: SPACING.sm,
  },
  matchMD: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.accent,
  },
  matchDate: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  matchVenue: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS.textMuted,
    textAlign: 'right',
  },
  matchTeams:     { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm },
  matchTeamSide:  { flex: 1, alignItems: 'center', gap: 2 },
  matchTeamRight: { alignItems: 'center' },
  matchTeamFlag:  { fontSize: 26 },
  matchTeamName: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  matchTeamNameUser: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.accent,
  },
  matchScoreBox: { width: 70, alignItems: 'center' },
  matchScore: {
    fontFamily: FONTS.pixel,
    fontSize: 18,
    color: COLORS.accent,
    letterSpacing: 2,
  },
  matchVs: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  matchBtns: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  longSimBtn: {
    flex: 1,
    padding: SPACING.sm,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.bgSurface,
  },
  longSimBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  simBtn: {
    flex: 1,
    padding: SPACING.sm,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.bgSurface,
  },
  simBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.warning,
  },
  playBtn: {
    flex: 1,
    padding: SPACING.sm,
    alignItems: 'center',
    backgroundColor: `${COLORS.accentTeal}18`,
  },
  playBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.accentTeal,
  },

  matchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  matchResultText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  resetMatchText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  matchLockedRow: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bgSurface,
  },
  matchLockedText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  qualBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    borderWidth: 1,
  },
  qualBannerGreen:  { backgroundColor: `${COLORS.success}22`, borderColor: COLORS.success },
  qualBannerRed:    { backgroundColor: `${COLORS.danger}22`,  borderColor: COLORS.danger  },
  qualBannerYellow: { backgroundColor: `${COLORS.warning}22`, borderColor: COLORS.warning  },
  qualEmoji: { fontSize: 22 },
  qualText: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textPrimary,
  },

  advanceBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  advanceBtnText: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },

  // ── KNOCKOUT ──
  koHeader: { alignItems: 'center', marginBottom: SPACING.sm },
  koNationBadge: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.accent,
  },
  koWinCount: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  roundBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  roundBadgeText: {
    fontFamily: FONTS.heading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },

  koMatchCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  koMatchDate: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  koMatchTeams: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  koTeamSide:   { flex: 1, alignItems: 'center', gap: 4 },
  koTeamRight:  { alignItems: 'center' },
  koTeamFlag:   { fontSize: 40 },
  koTeamName: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  koVs: {
    width: 40,
    textAlign: 'center',
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.textMuted,
  },

  matchupBadge: {
    backgroundColor: `${COLORS.success}22`,
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  matchupBadgeUnderdog: {
    backgroundColor: `${COLORS.warning}22`,
    borderColor: COLORS.warning,
  },
  matchupBadgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textPrimary,
  },

  koBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  koSimBtn: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  koSimBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  koPenBtn: {
    flex: 1,
    backgroundColor: COLORS.accentTeal,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  koPenBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.bgPrimary,
  },

  prevResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    marginBottom: 6,
    gap: SPACING.sm,
  },
  prevResultRound: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  prevResultScore: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    minWidth: 50,
    textAlign: 'center',
  },
  prevResultOpp: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },

  waitingCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  waitingEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  waitingText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  waitingHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // ── WINNER ──
  winnerRoot:  { backgroundColor: '#060F0A' },
  winnerScroll: { padding: SPACING.md, alignItems: 'center', paddingBottom: 60 },
  winnerTrophy: { fontSize: 80, textAlign: 'center', marginTop: SPACING.lg },
  winnerFlagRow: { alignItems: 'center', marginVertical: SPACING.sm },
  shareBtn: {
    backgroundColor: COLORS.accentTeal,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  shareBtnText: {
    fontFamily: FONTS.heading,
    fontSize: 15,
    color: COLORS.bgPrimary,
    letterSpacing: 1,
  },
  winnerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 36,
    color: COLORS.accent,
    letterSpacing: 4,
    marginTop: SPACING.sm,
  },
  winnerTitle2: {
    fontFamily: FONTS.heading,
    fontSize: 36,
    color: COLORS.accent,
    letterSpacing: 4,
  },
  winnerNation: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  winnerSub: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.success,
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 1,
  },

  // ── ELIMINATED ──
  elimRoot:   { backgroundColor: '#0F0606' },
  elimScroll: { padding: SPACING.md, alignItems: 'center', paddingBottom: 60 },
  elimEmoji:  { fontSize: 64, marginTop: SPACING.lg },
  elimTitle: {
    fontFamily: FONTS.heading,
    fontSize: 36,
    color: COLORS.danger,
    letterSpacing: 3,
    marginTop: SPACING.sm,
  },
  elimRound: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  elimByCard: { alignItems: 'center', marginTop: SPACING.md },
  elimByLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  elimByFlag: { fontSize: 48, marginTop: 4 },
  elimByName: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  elimNation: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },

  // ── SHARED stats + reset ──
  statsCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    width: '100%',
  },
  statsTitle: {
    fontFamily: FONTS.heading,
    fontSize: 12,
    color: COLORS.accent,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  statsRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  statCell:  { alignItems: 'center' },
  statLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  statValue: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginTop: 2,
  },

  resetBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    width: '80%',
  },
  resetBtnText: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },

  // ↺ Reset escape-hatch (top-right corner of every active phase)
  startOverBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    zIndex: 10,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  startOverBtnText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // ── OVERLAYS ──
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#000',
  },
  overlayWebView: {
    flex: 1,
  },
  overlayHeader: {
    height: 44,
    backgroundColor: COLORS.bgPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  overlayHeaderContext: {
    fontFamily: FONTS.pixel,
    fontSize: 10,
    color: COLORS.accent,
    letterSpacing: 1,
    flex: 1,
  },
  overlayHeaderTeams: {
    fontFamily: FONTS.heading,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  overlayHeaderClose: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  overlayCloseBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 101,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCloseBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: '#ffffff',
  },
});
