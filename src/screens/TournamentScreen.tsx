import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';
import { NATIONS, NATIONS_BY_ID } from '../constants/nations';
import { GROUP_FIXTURES } from '../constants/fixtures';
import { useTournamentMatchStore, selectTournamentStandings } from '../store/useTournamentMatchStore';
import { useTournamentStore } from '../store/useTournamentStore';
import { resolveKnockoutBracket, getBestThirdPlacers } from '../utils/knockoutEngine';
import { simulateMatch, computeScore } from '../utils/simulator';
import { Team } from '../types/simulator';
import { TeamStanding } from '../types/matchResult';
import { KnockoutRound } from '../types/knockout';

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

// ─── ELO → star rating (1–5) ─────────────────────────────────────────────────
function eloToStars(elo: number): number {
  if (elo >= 1820) return 5;
  if (elo >= 1700) return 4;
  if (elo >= 1580) return 3;
  if (elo >= 1460) return 2;
  return 1;
}

function StarRating({ stars }: { stars: number }) {
  return (
    <Text style={styles.stars}>
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </Text>
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
                  <Text style={styles.nationTileFlag}>{item.flag}</Text>
                  <Text style={[styles.nationTileName, isSelected && styles.nationTileNameSel]} numberOfLines={2}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Selected nation detail card */}
          {pickedNation && NATIONS_BY_ID[pickedNation] && (
            <View style={styles.selectedCard}>
              <Text style={styles.selectedCardFlag}>{NATIONS_BY_ID[pickedNation].flag}</Text>
              <View style={styles.selectedCardInfo}>
                <Text style={styles.selectedCardName}>{NATIONS_BY_ID[pickedNation].name}</Text>
                <Text style={styles.selectedCardGroup}>Group {NATIONS_BY_ID[pickedNation].group}</Text>
                <StarRating stars={eloToStars(NATIONS_BY_ID[pickedNation].strength)} />
                <Text style={styles.selectedCardElo}>ELO {NATIONS_BY_ID[pickedNation].strength}</Text>
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
          <Text style={styles.winnerNation}>
            {userNation.flag}  {userNation.name.toUpperCase()}  {userNation.flag}
          </Text>
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
            const opponent   = isUserHome ? awayTeam : homeTeam;

            return (
              <View key={fixture.id} style={styles.matchCard}>
                <View style={styles.matchCardHeader}>
                  <Text style={styles.matchMD}>MD{fixture.matchday}</Text>
                  <Text style={styles.matchDate}>{fixture.date}</Text>
                  <Text style={styles.matchVenue} numberOfLines={1}>{fixture.venue}</Text>
                </View>

                <View style={styles.matchTeams}>
                  <View style={styles.matchTeamSide}>
                    <Text style={styles.matchTeamFlag}>{homeTeam?.flag}</Text>
                    <Text style={styles.matchTeamName} numberOfLines={1}>{homeTeam?.name}</Text>
                  </View>
                  <View style={styles.matchScoreBox}>
                    {result ? (
                      <Text style={styles.matchScore}>{result.homeScore} – {result.awayScore}</Text>
                    ) : (
                      <Text style={styles.matchVs}>VS</Text>
                    )}
                  </View>
                  <View style={[styles.matchTeamSide, styles.matchTeamRight]}>
                    <Text style={styles.matchTeamName} numberOfLines={1}>{awayTeam?.name}</Text>
                    <Text style={styles.matchTeamFlag}>{awayTeam?.flag}</Text>
                  </View>
                </View>

                {!result && (
                  <View style={styles.matchBtns}>
                    <TouchableOpacity
                      style={styles.simBtn}
                      onPress={() => handleSimulateGroup(fixture.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.simBtnText}>⚡ SIMULATE</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {result && (
                  <View style={styles.matchResultBadge}>
                    {(() => {
                      const userScore = isUserHome ? result.homeScore : result.awayScore;
                      const oppScore  = isUserHome ? result.awayScore : result.homeScore;
                      const label = userScore > oppScore ? 'WIN ✓' : userScore < oppScore ? 'LOSS ✗' : 'DRAW';
                      const color = userScore > oppScore ? COLORS.success : userScore < oppScore ? COLORS.danger : COLORS.warning;
                      return <Text style={[styles.matchResultText, { color }]}>{label}</Text>;
                    })()}
                  </View>
                )}
              </View>
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
                    <Text style={styles.koTeamFlag}>{userNation.flag}</Text>
                    <Text style={styles.koTeamName} numberOfLines={1}>{userNation.name}</Text>
                    <StarRating stars={eloToStars(userNation.strength)} />
                  </View>
                  <Text style={styles.koVs}>VS</Text>
                  <View style={[styles.koTeamSide, styles.koTeamRight]}>
                    <Text style={styles.koTeamFlag}>{opponent.flag}</Text>
                    <Text style={styles.koTeamName} numberOfLines={1}>{opponent.name}</Text>
                    <StarRating stars={eloToStars(opponent.strength)} />
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
                    style={styles.koSimBtn}
                    onPress={handleSimulateKnockout}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.koSimBtnText}>⚡ SIMULATE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.koPenBtn}
                    onPress={handlePlayPenalties}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.koPenBtnText}>⚽ PLAY PENALTIES</Text>
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
  root:    { flex: 1, backgroundColor: COLORS.background },
  scroll:  { padding: SPACING.md, paddingBottom: SPACING.xl },
  idleScroll: { padding: SPACING.md, paddingBottom: 40 },

  // ── IDLE ──
  journeyTitle:    { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center', letterSpacing: 2, marginTop: SPACING.sm },
  journeyTitle2:   { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center', letterSpacing: 2, marginBottom: 4 },
  journeySubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.md },
  nationGrid:      { gap: 2 },
  nationTile: {
    flex: 1,
    margin: 2,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    minWidth: (SCREEN_W - 32) / 4 - 4,
    maxWidth: (SCREEN_W - 32) / 4 - 4,
  },
  nationTileSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}22`,
  },
  nationTileFlag:    { fontSize: 22, marginBottom: 2 },
  nationTileName:    { fontSize: 8, color: COLORS.textMuted, textAlign: 'center' },
  nationTileNameSel: { color: COLORS.primary, fontWeight: 'bold' },

  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  selectedCardFlag: { fontSize: 48 },
  selectedCardInfo: { flex: 1 },
  selectedCardName: { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.textPrimary },
  selectedCardGroup:{ fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  selectedCardElo:  { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  stars:            { fontSize: 14, color: COLORS.primary, letterSpacing: 1 },

  beginBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
  },
  beginBtnDisabled: { backgroundColor: COLORS.surfaceAlt },
  beginBtnText: { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: '#000', letterSpacing: 1 },

  // ── GROUP ──
  groupHeader: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  groupLabel: { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 3 },
  groupNationBadge: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: 2 },

  tableCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHPos:  { width: 20, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: 'bold' },
  tableHName: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: 'bold' },
  tableHStat: { width: 26, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: 'bold', textAlign: 'center' },
  tableHPts:  { width: 30, fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: 'bold', textAlign: 'center' },

  standRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  standRowUser:     { backgroundColor: `${COLORS.primary}14` },
  standPos:         { width: 20, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center' },
  standFlag:        { fontSize: 16, marginRight: 4 },
  standName:        { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '500' },
  standNameUser:    { color: COLORS.primary, fontWeight: 'bold' },
  standStat:        { width: 26, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'center' },
  standPts:         { width: 30, fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: 'bold', textAlign: 'center' },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  progressText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  matchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    gap: SPACING.sm,
  },
  matchMD:     { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.primary },
  matchDate:   { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  matchVenue:  { flex: 1, fontSize: 9, color: COLORS.textMuted, textAlign: 'right' },
  matchTeams:  { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm },
  matchTeamSide: { flex: 1, alignItems: 'center', gap: 2 },
  matchTeamRight:{ alignItems: 'center' },
  matchTeamFlag: { fontSize: 26 },
  matchTeamName: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'center' },
  matchScoreBox: { width: 70, alignItems: 'center' },
  matchScore:    { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.primary },
  matchVs:       { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontWeight: 'bold' },
  matchBtns: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  simBtn: {
    flex: 1,
    padding: SPACING.sm,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
  },
  simBtnText: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.textSecondary },
  playBtn: {
    flex: 1,
    padding: SPACING.sm,
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}22`,
  },
  playBtnText: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.primary },

  matchResultBadge: { paddingBottom: SPACING.xs, alignItems: 'center' },
  matchResultText:  { fontSize: FONT_SIZE.sm, fontWeight: 'bold', letterSpacing: 1 },

  qualBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    borderWidth: 1,
  },
  qualBannerGreen:  { backgroundColor: `${COLORS.success}22`, borderColor: COLORS.success },
  qualBannerRed:    { backgroundColor: `${COLORS.danger}22`,  borderColor: COLORS.danger  },
  qualBannerYellow: { backgroundColor: `${COLORS.warning}22`, borderColor: COLORS.warning  },
  qualEmoji: { fontSize: 22 },
  qualText:  { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary, fontWeight: '500' },

  advanceBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
  },
  advanceBtnText: { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: '#000', letterSpacing: 1 },

  // ── KNOCKOUT ──
  koHeader: { alignItems: 'center', marginBottom: SPACING.sm },
  koNationBadge: { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.primary },
  koWinCount:    { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },

  roundBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  roundBadgeText: { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: '#000', letterSpacing: 2 },

  koMatchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  koMatchDate: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.sm },

  koMatchTeams: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  koTeamSide:   { flex: 1, alignItems: 'center', gap: 4 },
  koTeamRight:  { alignItems: 'center' },
  koTeamFlag:   { fontSize: 40 },
  koTeamName:   { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'center' },
  koVs:         { width: 40, textAlign: 'center', fontSize: FONT_SIZE.md, fontWeight: 'bold', color: COLORS.textMuted },

  matchupBadge: {
    backgroundColor: `${COLORS.success}22`,
    borderRadius: 6,
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
  matchupBadgeText: { fontSize: FONT_SIZE.xs, color: COLORS.textPrimary, fontWeight: '500' },

  koBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  koSimBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  koSimBtnText: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.textSecondary },
  koPenBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  koPenBtnText: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: '#000' },

  prevResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    marginBottom: 6,
    gap: SPACING.sm,
  },
  prevResultRound: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  prevResultScore: { fontSize: FONT_SIZE.sm, fontWeight: 'bold', minWidth: 50, textAlign: 'center' },
  prevResultOpp:   { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'right' },

  waitingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  waitingEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  waitingText:  { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center', fontWeight: '500' },
  waitingHint:  { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xs },

  // ── WINNER ──
  winnerRoot: { backgroundColor: '#0a1a0a' },
  winnerScroll: { padding: SPACING.md, alignItems: 'center', paddingBottom: 60 },
  winnerTrophy: { fontSize: 80, textAlign: 'center', marginTop: SPACING.lg },
  winnerTitle:  { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 4, marginTop: SPACING.sm },
  winnerTitle2: { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 4 },
  winnerNation: { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: SPACING.md, textAlign: 'center' },
  winnerSub:    { fontSize: FONT_SIZE.md, color: COLORS.success, fontWeight: 'bold', marginTop: 4, textAlign: 'center', letterSpacing: 1 },

  // ── ELIMINATED ──
  elimRoot:   { backgroundColor: '#1a0a0a' },
  elimScroll: { padding: SPACING.md, alignItems: 'center', paddingBottom: 60 },
  elimEmoji:  { fontSize: 64, marginTop: SPACING.lg },
  elimTitle:  { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.danger, letterSpacing: 3, marginTop: SPACING.sm },
  elimRound:  { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 4 },
  elimByCard: { alignItems: 'center', marginTop: SPACING.md },
  elimByLabel:{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  elimByFlag: { fontSize: 48, marginTop: 4 },
  elimByName: { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.textPrimary },
  elimNation: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.md },

  // ── SHARED stats + reset ──
  statsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    width: '100%',
  },
  statsTitle: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 2, marginBottom: SPACING.sm, textAlign: 'center' },
  statsRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  statCell:   { alignItems: 'center' },
  statLabel:  { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: 'bold' },
  statValue:  { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 2 },

  resetBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    width: '80%',
  },
  resetBtnText: { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: '#000', letterSpacing: 1 },

  // ↺ Reset escape-hatch button (top-right of every active phase)
  startOverBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    zIndex: 10,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  startOverBtnText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
