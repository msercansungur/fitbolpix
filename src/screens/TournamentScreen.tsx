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
import PixelFlag from '../components/PixelFlag';
import { animateScore } from '../utils/scoreAnimation';

type Props = BottomTabScreenProps<BottomTabParamList, 'Tournament'>;

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
  selectedNationId, onQuickSim, onLongSim,
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
      {!result && (
        <View style={styles.matchBtns}>
          <TouchableOpacity style={styles.longSimBtn} onPress={onLongSim} activeOpacity={0.8}>
            <Text style={styles.longSimBtnText}>▶ LONG SIM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.simBtn} onPress={onQuickSim} activeOpacity={0.8}>
            <Text style={styles.simBtnText}>⚡ QUICK SIM</Text>
          </TouchableOpacity>
        </View>
      )}
      {result && (
        <View style={styles.matchResultBadge}>
          <Text style={[styles.matchResultText, { color: resultColor }]}>{resultLabel}</Text>
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

  // ── Action: play knockout via Penalty screen ─────────────────────────────
  const handlePlayPenalties = useCallback(() => {
    if (!userNextMatch) return;
    const { def, homeTeamId, awayTeamId } = userNextMatch;
    if (!homeTeamId || !awayTeamId) return;
    (navigation as any).navigate('Penalty', {
      homeTeamId,
      awayTeamId,
      fixtureId: `ko-${def.id}`,
    });
  }, [userNextMatch, navigation]);

  // ── Action: navigate to full simulator for a group/KO match ─────────────
  const handleLongSim = useCallback((homeTeamId: string, awayTeamId: string, fixtureId: string) => {
    (navigation as any).navigate('Simulator', { homeTeamId, awayTeamId, fixtureId });
  }, [navigation]);

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
                onLongSim={() => handleLongSim(fixture.homeTeamId, fixture.awayTeamId, fixture.id)}
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
                    onPress={() => handleLongSim(
                      nextMatch.homeTeamId ?? '',
                      nextMatch.awayTeamId ?? '',
                      `ko-${nextMatch.def.id}`,
                    )}
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
                    onPress={handlePlayPenalties}
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
      </SafeAreaView>
    );
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

  matchResultBadge: { paddingBottom: SPACING.xs, alignItems: 'center' },
  matchResultText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
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
});
