import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ListRenderItem,
  Alert,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSimulator } from '../hooks/useSimulator';
import { NATIONS, NATIONS_BY_ID, NATIONS_BY_GROUP } from '../constants/nations';
import { GROUP_FIXTURES, GROUPS, fixturesByGroup } from '../constants/fixtures';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';
import { MatchEvent, Team, EventType } from '../types/simulator';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import {
  useSimulatorStore,
  selectSimStandings,
  selectSimResult,
  isSimulated,
} from '../store/useSimulatorStore';
import { simulateMatch, computeScore } from '../utils/simulator';
import { resolveKnockoutBracket } from '../utils/knockoutEngine';
import { ResolvedKnockoutMatch } from '../types/knockout';
import { MatchResult } from '../types/matchResult';
import KnockoutBracket from '../components/KnockoutBracket';

type Props = BottomTabScreenProps<BottomTabParamList, 'Simulator'>;
type SimMode    = 'match' | 'tournament';
type TourneyView = 'groups' | 'knockout' | 'matchdays';

// ─── Event icons / colours ────────────────────────────────────────────────────

const EVENT_ICON: Record<EventType, string> = {
  goal: '⚽', yellow_card: '🟨', red_card: '🟥', save: '🧤',
  foul: '🦶', var_check: '📺', injury: '🏥',
  kickoff: '🏁', halftime: '⏸️', fulltime: '🏆',
};

const EVENT_COLOR: Record<EventType, string> = {
  goal: COLORS.goal, yellow_card: COLORS.yellowCard, red_card: COLORS.redCard,
  save: COLORS.save, foul: COLORS.foul, var_check: COLORS.varCheck,
  injury: COLORS.injury, kickoff: COLORS.neutral, halftime: COLORS.neutral,
  fulltime: COLORS.primary,
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function TeamRow({ team, label, selected, onPress }: {
  team: Team; label: string; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.teamRow, selected && styles.teamRowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.teamRowFlag}>{team.flag}</Text>
      <Text style={[styles.teamRowName, selected && styles.teamRowNameSelected]} numberOfLines={1}>
        {team.name}
      </Text>
      {selected && <Text style={styles.teamRowBadge}>{label}</Text>}
    </TouchableOpacity>
  );
}

function Scoreboard({ homeTeam, awayTeam, homeScore, awayScore, minute, status }: {
  homeTeam: Team; awayTeam: Team;
  homeScore: number; awayScore: number;
  minute: number; status: string;
}) {
  const minuteLabel =
    status === 'running'  ? `⏱ ${minute}'` :
    status === 'finished' ? 'FULL TIME' : 'KICK OFF';
  return (
    <View style={styles.scoreboard}>
      <View style={styles.scoreTeam}>
        <Text style={styles.scoreFlag}>{homeTeam.flag}</Text>
        <Text style={styles.scoreName} numberOfLines={1}>{homeTeam.name}</Text>
      </View>
      <View style={styles.scoreCenter}>
        <Text style={styles.scoreNumbers}>{homeScore} – {awayScore}</Text>
        <Text style={styles.scoreMinute}>{minuteLabel}</Text>
      </View>
      <View style={[styles.scoreTeam, styles.scoreTeamRight]}>
        <Text style={styles.scoreFlag}>{awayTeam.flag}</Text>
        <Text style={styles.scoreName} numberOfLines={1}>{awayTeam.name}</Text>
      </View>
    </View>
  );
}

function EventItem({ event, homeId }: { event: MatchEvent; homeId: string }) {
  const isNeutral = event.teamId === '';
  const side  = isNeutral ? '' : event.teamId === homeId ? 'H' : 'A';
  const color = EVENT_COLOR[event.type];
  return (
    <View style={styles.eventRow}>
      <Text style={styles.eventIcon}>{EVENT_ICON[event.type]}</Text>
      <View style={styles.eventBody}>
        <Text style={[styles.eventMinute, { color }]}>
          {event.minute > 0 ? `${event.minute}'` : '0'}{side ? `  [${side}]` : ''}
        </Text>
        <Text style={styles.eventCommentary}>{event.commentary}</Text>
      </View>
    </View>
  );
}

// ─── Tournament mode helpers ──────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function gd(played: number, won: number, drawn: number, lost: number, gf: number, ga: number): number {
  return gf - ga;
}

// ─── Tournament — Standings row ───────────────────────────────────────────────

function TourneyStandingRow({ team, standing, rank }: {
  team: Team;
  standing: ReturnType<typeof selectSimStandings>[number] | undefined;
  rank: number;
}) {
  const qualifies = rank <= 2;
  const goalDiff  = standing ? standing.goalsFor - standing.goalsAgainst : 0;
  return (
    <View style={[styles.tableRow, qualifies && styles.tableRowQualifies]}>
      <Text style={styles.tableRank}>{rank}</Text>
      <Text style={styles.tableFlag}>{team.flag}</Text>
      <Text style={styles.tableName} numberOfLines={1}>{team.name}</Text>
      <Text style={styles.tableStat}>{standing?.played  ?? 0}</Text>
      <Text style={styles.tableStat}>{standing?.won     ?? 0}</Text>
      <Text style={styles.tableStat}>{standing?.drawn   ?? 0}</Text>
      <Text style={styles.tableStat}>{standing?.lost    ?? 0}</Text>
      <Text style={styles.tableStat}>{goalDiff >= 0 ? '+' : ''}{goalDiff}</Text>
      <Text style={[styles.tableStat, styles.tableStatPts]}>{standing?.points ?? 0}</Text>
    </View>
  );
}

// ─── Tournament — Fixture card with sim buttons ───────────────────────────────

function TourneyFixtureCard({ fixture, result, groupBadge, onQuickSim }: {
  fixture: typeof GROUP_FIXTURES[number];
  result: MatchResult | null;
  groupBadge?: string;
  onQuickSim: () => void;
}) {
  const home = NATIONS_BY_ID[fixture.homeTeamId];
  const away = NATIONS_BY_ID[fixture.awayTeamId];
  if (!home || !away) return null;
  const isPlayed = result !== null;

  return (
    <View style={[styles.fixtureCard, isPlayed && styles.fixtureCardPlayed]}>
      <View style={styles.fixtureTeams}>
        {groupBadge && (
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>{groupBadge}</Text>
          </View>
        )}
        <View style={styles.fixtureTeam}>
          <Text style={styles.fixtureFlag}>{home.flag}</Text>
          <Text style={[styles.fixtureTeamName, isPlayed && result!.homeScore > result!.awayScore && styles.fixtureTeamWinner]} numberOfLines={1}>
            {home.name}
          </Text>
        </View>
        {isPlayed ? (
          <View style={styles.fixtureScoreBox}>
            <Text style={styles.fixtureScore}>{result!.homeScore} – {result!.awayScore}</Text>
            <Text style={styles.fixtureScoreLabel}>FT</Text>
          </View>
        ) : (
          <Text style={styles.fixtureVs}>VS</Text>
        )}
        <View style={[styles.fixtureTeam, styles.fixtureTeamRight]}>
          <Text style={[styles.fixtureTeamName, styles.fixtureTeamNameRight, isPlayed && result!.awayScore > result!.homeScore && styles.fixtureTeamWinner]} numberOfLines={1}>
            {away.name}
          </Text>
          <Text style={styles.fixtureFlag}>{away.flag}</Text>
        </View>
      </View>
      <View style={styles.fixtureMeta}>
        <Text style={styles.fixtureDate}>{formatDate(fixture.date)}</Text>
        <Text style={styles.fixtureVenue} numberOfLines={1}>{fixture.venue}</Text>
        <TouchableOpacity style={styles.quickSimBtn} onPress={onQuickSim} activeOpacity={0.75}>
          <Text style={styles.quickSimBtnText}>{isPlayed ? '↺ RE-SIM' : '⚡ SIM'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Quick-sim helper ─────────────────────────────────────────────────────────

function runQuickSim(
  fixture: typeof GROUP_FIXTURES[number],
  saveResult: (r: MatchResult) => void,
): void {
  const home = NATIONS_BY_ID[fixture.homeTeamId];
  const away = NATIONS_BY_ID[fixture.awayTeamId];
  if (!home || !away) return;
  const events = simulateMatch(home, away, 'en');
  const score  = computeScore(events, home.id, away.id);
  saveResult({
    fixtureId:   fixture.id,
    homeTeamId:  home.id,
    awayTeamId:  away.id,
    homeScore:   score.home,
    awayScore:   score.away,
    events,
    simulatedAt: Date.now(),
  });
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SimulatorScreen({ route }: Props) {
  // ── MATCH mode state ───────────────────────────────────────────────────────
  const { state, selectHomeTeam, selectAwayTeam, startMatch, resetMatch, setTeamsAndStart } = useSimulator();
  const feedRef   = useRef<FlatList<MatchEvent>>(null);
  const fixtureId = route.params?.fixtureId;

  // ── Mode + Tournament sub-view ─────────────────────────────────────────────
  const [simMode,       setSimMode]       = useState<SimMode>('match');
  const [tourneyView,   setTourneyView]   = useState<TourneyView>('groups');
  const [activeGroup,   setActiveGroup]   = useState<string>('A');
  const [activeMatchday, setActiveMatchday] = useState<1 | 2 | 3>(1);

  // ── Simulator store (tournament mode reads/writes here) ────────────────────
  const results         = useSimulatorStore((s) => s.results);
  const standings       = useSimulatorStore((s) => s.standings);
  const knockoutResults = useSimulatorStore((s) => s.knockoutResults);
  const saveResult      = useSimulatorStore((s) => s.saveResult);
  const saveKnockoutResult = useSimulatorStore((s) => s.saveKnockoutResult);
  const clearAll        = useSimulatorStore((s) => s.clearAll);

  // ── Auto-start when navigated with team params ─────────────────────────────
  useEffect(() => {
    const homeId = route.params?.homeTeamId;
    const awayId = route.params?.awayTeamId;
    if (homeId && awayId) {
      const home = NATIONS_BY_ID[homeId];
      const away = NATIONS_BY_ID[awayId];
      if (home && away) {
        setSimMode('match');
        setTeamsAndStart(home, away);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.homeTeamId, route.params?.awayTeamId]);

  // ── Save match result to simulator store on finish ─────────────────────────
  useEffect(() => {
    if (state.status !== 'finished' || !state.homeTeam || !state.awayTeam) return;
    const fid = fixtureId ?? `adhoc-${state.homeTeam.id}-${state.awayTeam.id}-${Date.now()}`;
    if (fid.startsWith('ko-')) {
      const matchId = parseInt(fid.replace('ko-', ''), 10);
      if (!isNaN(matchId)) {
        saveKnockoutResult({
          matchId,
          homeTeamId: state.homeTeam.id,
          awayTeamId: state.awayTeam.id,
          homeScore:  state.homeScore,
          awayScore:  state.awayScore,
          events:     state.events,
          simulatedAt: Date.now(),
        });
        return;
      }
    }
    saveResult({
      fixtureId:   fid,
      homeTeamId:  state.homeTeam.id,
      awayTeamId:  state.awayTeam.id,
      homeScore:   state.homeScore,
      awayScore:   state.awayScore,
      events:      state.events,
      simulatedAt: Date.now(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // ── Auto-scroll event feed ─────────────────────────────────────────────────
  useEffect(() => {
    if (state.events.length > 0) feedRef.current?.scrollToEnd({ animated: true });
  }, [state.events.length]);

  // ── Tournament helpers ─────────────────────────────────────────────────────
  const sortedStandings = selectSimStandings(standings, activeGroup);
  const standingByTeam  = Object.fromEntries(sortedStandings.map((s) => [s.teamId, s]));
  const groupTeams: Team[] = sortedStandings.length === 4
    ? sortedStandings.map((s) => NATIONS_BY_ID[s.teamId]).filter(Boolean) as Team[]
    : (NATIONS_BY_GROUP[activeGroup] ?? []);
  const groupFixtures    = fixturesByGroup(activeGroup);
  const simulatedCount   = groupFixtures.filter((f) => isSimulated(results, f.id)).length;

  const matchdayFixtures = GROUP_FIXTURES
    .filter((f) => f.matchday === activeMatchday)
    .sort((a, b) => a.date.localeCompare(b.date));
  const matchdayPending = matchdayFixtures.filter((f) => !isSimulated(results, f.id)).length;

  const resolvedBracket = resolveKnockoutBracket(standings, results, knockoutResults);

  // ── Tournament actions ─────────────────────────────────────────────────────
  const handleQuickSim = useCallback((fixture: typeof GROUP_FIXTURES[number]) => {
    runQuickSim(fixture, saveResult);
  }, [saveResult]);

  const handleSimAll = useCallback((fixtures: typeof GROUP_FIXTURES) => {
    const pending = fixtures.filter((f) => !isSimulated(results, f.id));
    pending.forEach((f) => runQuickSim(f, saveResult));
  }, [results, saveResult]);

  const handleKnockoutQuickSim = useCallback((match: ResolvedKnockoutMatch) => {
    if (!match.homeTeamId || !match.awayTeamId) return;
    const home = NATIONS_BY_ID[match.homeTeamId];
    const away = NATIONS_BY_ID[match.awayTeamId];
    if (!home || !away) return;
    const events = simulateMatch(home, away, 'en');
    const score  = computeScore(events, home.id, away.id);
    const homeScore = score.home === score.away ? score.home + 1 : score.home;
    saveKnockoutResult({
      matchId:    match.def.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeScore,
      awayScore:  score.away,
      events,
      simulatedAt: Date.now(),
    });
  }, [saveKnockoutResult]);

  const handleSimulateWC = useCallback(() => {
    Alert.alert(
      'Simulate Entire World Cup?',
      'This will instantly simulate all 64 remaining matches and produce a winner.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '⚡ Simulate!',
          onPress: () => {
            // 1. Fill all remaining group fixtures
            const store = useSimulatorStore.getState();
            GROUP_FIXTURES.filter((f) => !(f.id in store.results)).forEach((f) => {
              const h = NATIONS_BY_ID[f.homeTeamId];
              const a = NATIONS_BY_ID[f.awayTeamId];
              if (!h || !a) return;
              const evts = simulateMatch(h, a, 'en');
              const sc   = computeScore(evts, h.id, a.id);
              store.saveResult({ fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id, homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now() });
            });
            // 2. Simulate knockout matches in dependency order
            for (let round = 0; round < 32; round++) {
              const fresh    = useSimulatorStore.getState();
              const resolved = resolveKnockoutBracket(fresh.standings, fresh.results, fresh.knockoutResults);
              const next     = resolved.find((m) => m.result === null && m.homeTeamId !== null && m.awayTeamId !== null);
              if (!next) break;
              const h = NATIONS_BY_ID[next.homeTeamId!];
              const a = NATIONS_BY_ID[next.awayTeamId!];
              if (!h || !a) break;
              const evts = simulateMatch(h, a, 'en');
              const sc   = computeScore(evts, h.id, a.id);
              const hs   = sc.home === sc.away ? sc.home + 1 : sc.home;
              fresh.saveKnockoutResult({ matchId: next.def.id, homeTeamId: h.id, awayTeamId: a.id, homeScore: hs, awayScore: sc.away, events: evts, simulatedAt: Date.now() });
            }
            // Find winner
            const final = useSimulatorStore.getState();
            const finalResolved = resolveKnockoutBracket(final.standings, final.results, final.knockoutResults);
            const finalMatch = finalResolved.find((m) => m.def.round === 'Final' && m.result !== null);
            if (finalMatch?.result) {
              const r = finalMatch.result;
              const winner = r.homeScore >= r.awayScore ? NATIONS_BY_ID[r.homeTeamId] : NATIONS_BY_ID[r.awayTeamId];
              if (winner) Alert.alert('🏆 World Cup Winner!', `${winner.flag} ${winner.name}`);
            }
          },
        },
      ],
    );
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert('Reset Simulator?', 'This will clear all simulated results and standings.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => clearAll() },
    ]);
  }, [clearAll]);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const bothSelected = state.homeTeam !== null && state.awayTeam !== null;
  const sameTeam     = state.homeTeam?.id === state.awayTeam?.id;
  const canKickOff   = bothSelected && !sameTeam;

  const renderTeam: ListRenderItem<Team> = ({ item }) => (
    <View style={styles.teamPickerRow}>
      <TeamRow team={item} label="H" selected={state.homeTeam?.id === item.id} onPress={() => selectHomeTeam(item)} />
      <TeamRow team={item} label="A" selected={state.awayTeam?.id === item.id} onPress={() => selectAwayTeam(item)} />
    </View>
  );

  const renderEvent: ListRenderItem<MatchEvent> = ({ item }) => (
    <EventItem event={item} homeId={state.homeTeam?.id ?? ''} />
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP TOGGLE
  // ═══════════════════════════════════════════════════════════════════════════

  const topToggle = (
    <View style={styles.modeToggle}>
      {(['match', 'tournament'] as SimMode[]).map((m) => (
        <TouchableOpacity
          key={m}
          style={[styles.modeToggleBtn, simMode === m && styles.modeToggleActive]}
          onPress={() => setSimMode(m)}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeToggleText, simMode === m && styles.modeToggleTextActive]}>
            {m === 'match' ? '⚽ MATCH' : '🏆 TOURNAMENT SIM'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCH MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (simMode === 'match') {
    if (state.status === 'idle') {
      return (
        <SafeAreaView style={styles.root}>
          {topToggle}
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerLabel}>HOME</Text>
            <Text style={styles.pickerLabel}>AWAY</Text>
          </View>
          <FlatList
            data={NATIONS}
            keyExtractor={(t) => t.id}
            renderItem={renderTeam}
            contentContainerStyle={styles.pickerList}
            style={styles.picker}
          />
          <TouchableOpacity
            style={[styles.ctaButton, !canKickOff && styles.ctaButtonDisabled]}
            onPress={startMatch}
            disabled={!canKickOff}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaText}>
              {!bothSelected ? 'PICK BOTH TEAMS' : sameTeam ? 'PICK DIFFERENT TEAMS' : '⚽  KICK OFF!'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.root}>
        {topToggle}
        <Scoreboard
          homeTeam={state.homeTeam!}
          awayTeam={state.awayTeam!}
          homeScore={state.homeScore}
          awayScore={state.awayScore}
          minute={state.currentMinute}
          status={state.status}
        />
        <FlatList
          ref={feedRef}
          data={state.events}
          keyExtractor={(e) => e.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.feedContent}
          style={styles.feed}
          onContentSizeChange={() => feedRef.current?.scrollToEnd({ animated: true })}
        />
        {state.status === 'finished' && (
          <TouchableOpacity style={styles.ctaButton} onPress={resetMatch} activeOpacity={0.8}>
            <Text style={styles.ctaText}>🔄  NEW MATCH</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOURNAMENT SIMULATION MODE
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.root}>
      {topToggle}

      {/* Sub-view toggle */}
      <View style={styles.viewToggle}>
        {(['groups', 'knockout', 'matchdays'] as TourneyView[]).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.viewToggleBtn, tourneyView === v && styles.viewToggleActive]}
            onPress={() => setTourneyView(v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewToggleText, tourneyView === v && styles.viewToggleTextActive]}>
              {v === 'groups' ? 'Groups' : v === 'knockout' ? 'Knockout' : 'Matchdays'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Group / Matchday tab bar */}
      {tourneyView !== 'knockout' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
          style={styles.tabBarWrap}
        >
          {tourneyView === 'groups'
            ? GROUPS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.tab, activeGroup === g && styles.tabActive]}
                  onPress={() => setActiveGroup(g)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeGroup === g && styles.tabTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))
            : ([1, 2, 3] as const).map((md) => (
                <TouchableOpacity
                  key={md}
                  style={[styles.tab, styles.tabWide, activeMatchday === md && styles.tabActive]}
                  onPress={() => setActiveMatchday(md)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeMatchday === md && styles.tabTextActive]}>
                    MD {md}
                  </Text>
                </TouchableOpacity>
              ))}
        </ScrollView>
      )}

      {/* ── GROUPS VIEW ──────────────────────────────────────────────────────── */}
      {tourneyView === 'groups' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.groupHeadingRow}>
            <Text style={styles.sectionLabel}>GROUP {activeGroup}</Text>
            <Text style={styles.progressLabel}>{simulatedCount}/6 simulated</Text>
          </View>

          {/* Standings */}
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableRank, styles.tableHeaderText]}>#</Text>
              <Text style={[styles.tableFlag, styles.tableHeaderText]}> </Text>
              <Text style={[styles.tableName, styles.tableHeaderText]}>Team</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>P</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>W</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>D</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>L</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>GD</Text>
              <Text style={[styles.tableStat, styles.tableStatPts, styles.tableHeaderText]}>Pts</Text>
            </View>
            {groupTeams.map((t, i) => (
              <TourneyStandingRow key={t.id} team={t} standing={standingByTeam[t.id]} rank={i + 1} />
            ))}
          </View>

          {/* Fixtures by matchday with sim buttons */}
          {([1, 2, 3] as const).map((md) => {
            const mdFixtures = groupFixtures.filter((f) => f.matchday === md);
            const mdPending  = mdFixtures.filter((f) => !isSimulated(results, f.id)).length;
            return (
              <View key={md}>
                <View style={styles.matchdayHeaderRow}>
                  <Text style={styles.matchdayLabel}>Matchday {md}</Text>
                  {mdPending > 0 && (
                    <TouchableOpacity style={styles.simAllBtn} onPress={() => handleSimAll(mdFixtures)} activeOpacity={0.75}>
                      <Text style={styles.simAllBtnText}>⚡ Sim All</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {mdFixtures.map((fixture) => (
                  <TourneyFixtureCard
                    key={fixture.id}
                    fixture={fixture}
                    result={selectSimResult(results, fixture.id)}
                    onQuickSim={() => handleQuickSim(fixture)}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── MATCHDAYS VIEW ───────────────────────────────────────────────────── */}
      {tourneyView === 'matchdays' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.matchdayViewHeader}>
            <View>
              <Text style={styles.sectionLabel}>MATCHDAY {activeMatchday}</Text>
              <Text style={styles.progressLabel}>
                {matchdayFixtures.length - matchdayPending}/{matchdayFixtures.length} simulated
              </Text>
            </View>
            {matchdayPending > 0 && (
              <TouchableOpacity
                style={styles.simAllMatchdayBtn}
                onPress={() => handleSimAll(matchdayFixtures)}
                activeOpacity={0.8}
              >
                <Text style={styles.simAllMatchdayBtnText}>⚡ Sim All Matchday</Text>
              </TouchableOpacity>
            )}
          </View>

          {matchdayFixtures.map((fixture) => (
            <TourneyFixtureCard
              key={fixture.id}
              fixture={fixture}
              result={selectSimResult(results, fixture.id)}
              groupBadge={`Group ${fixture.group}`}
              onQuickSim={() => handleQuickSim(fixture)}
            />
          ))}
        </ScrollView>
      )}

      {/* ── KNOCKOUT VIEW ────────────────────────────────────────────────────── */}
      {tourneyView === 'knockout' && (
        <View style={styles.content}>
          <KnockoutBracket
            resolved={resolvedBracket}
            onQuickSim={handleKnockoutQuickSim}
            onSimulate={handleKnockoutQuickSim}
          />
        </View>
      )}

      {/* Bottom action row */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.simWCBtn} onPress={handleSimulateWC} activeOpacity={0.8}>
          <Text style={styles.simWCBtnText}>⚡ SIMULATE ENTIRE WC</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
          <Text style={styles.resetBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  modeToggleBtn: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center' },
  modeToggleActive: { backgroundColor: COLORS.primary },
  modeToggleText: { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: COLORS.textSecondary, letterSpacing: 0.5 },
  modeToggleTextActive: { color: '#000' },

  // View sub-toggle
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  viewToggleBtn: { flex: 1, paddingVertical: SPACING.xs + 2, alignItems: 'center' },
  viewToggleActive: { backgroundColor: COLORS.surfaceAlt },
  viewToggleText: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.textSecondary },
  viewToggleTextActive: { color: COLORS.primary },

  // Tab bar
  tabBarWrap: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBar: { paddingHorizontal: SPACING.sm, gap: SPACING.xs, alignItems: 'center', height: 44 },
  tab: { width: 34, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabWide: { width: 52 },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: COLORS.textSecondary },
  tabTextActive: { color: '#000' },

  // Content
  content: { flex: 1 },
  contentInner: { padding: SPACING.md, paddingBottom: SPACING.xl },

  // Group heading
  groupHeadingRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.sm },
  sectionLabel: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 1 },
  progressLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  // Table
  table: { backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg, overflow: 'hidden' },
  tableHeader: { backgroundColor: COLORS.surfaceAlt, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableHeaderText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  tableRowQualifies: { borderLeftWidth: 3, borderLeftColor: COLORS.success },
  tableRank: { width: 16, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center', marginRight: 2 },
  tableFlag: { fontSize: FONT_SIZE.md, width: 24, marginRight: 4 },
  tableName: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  tableStat: { width: 26, textAlign: 'center', fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  tableStatPts: { color: COLORS.primary, fontWeight: 'bold' },

  // Matchday section
  matchdayHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, marginTop: SPACING.xs },
  matchdayLabel: { flex: 1, fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: COLORS.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  simAllBtn: { backgroundColor: COLORS.surfaceAlt, borderRadius: 4, paddingVertical: 4, paddingHorizontal: SPACING.sm, borderWidth: 1, borderColor: COLORS.warning },
  simAllBtnText: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.warning },

  // Matchday view header
  matchdayViewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  simAllMatchdayBtn: { backgroundColor: COLORS.warning, borderRadius: 6, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  simAllMatchdayBtnText: { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: '#000' },

  // Fixture card
  fixtureCard: { backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, overflow: 'hidden' },
  fixtureCardPlayed: { borderColor: COLORS.success, opacity: 0.92 },
  fixtureTeams: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, gap: SPACING.xs },
  groupBadge: { backgroundColor: COLORS.surfaceAlt, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, marginRight: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  groupBadgeText: { fontSize: 9, fontWeight: 'bold', color: COLORS.textMuted },
  fixtureTeam: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  fixtureTeamRight: { justifyContent: 'flex-end' },
  fixtureFlag: { fontSize: FONT_SIZE.xl },
  fixtureTeamName: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  fixtureTeamNameRight: { textAlign: 'right' },
  fixtureTeamWinner: { color: COLORS.textPrimary, fontWeight: 'bold' },
  fixtureVs: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: 'bold', paddingHorizontal: SPACING.xs },
  fixtureScoreBox: { alignItems: 'center', paddingHorizontal: SPACING.sm },
  fixtureScore: { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.textPrimary, letterSpacing: 1 },
  fixtureScoreLabel: { fontSize: FONT_SIZE.xs, color: COLORS.success, fontWeight: 'bold' },
  fixtureMeta: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, gap: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.border },
  fixtureDate: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600', width: 60 },
  fixtureVenue: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  quickSimBtn: { backgroundColor: COLORS.surfaceAlt, borderRadius: 4, paddingVertical: 4, paddingHorizontal: SPACING.sm, borderWidth: 1, borderColor: COLORS.warning },
  quickSimBtnText: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.warning },

  // Bottom action bar
  bottomBar: { flexDirection: 'row', padding: SPACING.sm, gap: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  simWCBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  simWCBtnText: { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: '#000', letterSpacing: 0.5 },
  resetBtn: { backgroundColor: COLORS.surfaceAlt, borderRadius: 8, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  resetBtnText: { fontSize: FONT_SIZE.md },

  // Match mode — team picker
  pickerHeader: { flexDirection: 'row', paddingHorizontal: SPACING.md, marginBottom: SPACING.xs },
  pickerLabel: { flex: 1, textAlign: 'center', fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 2 },
  picker: { flex: 1 },
  pickerList: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  teamPickerRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xs },
  teamRow: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 6, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.xs },
  teamRowSelected: { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.primary },
  teamRowFlag: { fontSize: FONT_SIZE.md },
  teamRowName: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  teamRowNameSelected: { color: COLORS.textPrimary, fontWeight: 'bold' },
  teamRowBadge: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: 'bold' },

  // Match mode — scoreboard
  scoreboard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderRadius: 10, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  scoreTeam: { flex: 1, alignItems: 'center', gap: SPACING.xs },
  scoreTeamRight: {},
  scoreFlag: { fontSize: FONT_SIZE.xxl },
  scoreName: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  scoreCenter: { alignItems: 'center', paddingHorizontal: SPACING.md },
  scoreNumbers: { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.textPrimary, letterSpacing: 2 },
  scoreMinute: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  // Match mode — event feed
  feed: { flex: 1, marginHorizontal: SPACING.md },
  feedContent: { paddingBottom: SPACING.md, gap: 2 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.surface, borderRadius: 6, padding: SPACING.sm, gap: SPACING.sm, borderLeftWidth: 3, borderLeftColor: COLORS.border },
  eventIcon: { fontSize: FONT_SIZE.md, marginTop: 1 },
  eventBody: { flex: 1 },
  eventMinute: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', marginBottom: 2 },
  eventCommentary: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 18 },

  // CTA
  ctaButton: { backgroundColor: COLORS.primary, margin: SPACING.md, borderRadius: 8, paddingVertical: SPACING.md, alignItems: 'center' },
  ctaButtonDisabled: { backgroundColor: COLORS.primaryDim, opacity: 0.6 },
  ctaText: { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: '#000', letterSpacing: 1 },
});
