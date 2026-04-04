import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { GROUP_FIXTURES, GROUPS, fixturesByGroup } from '../constants/fixtures';
import { NATIONS_BY_ID, NATIONS_BY_GROUP } from '../constants/nations';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';
import { Fixture } from '../types/fixture';
import { Team, MatchEvent, EventType } from '../types/simulator';
import { MatchResult, TeamStanding } from '../types/matchResult';
import { ResolvedKnockoutMatch } from '../types/knockout';
import {
  useMatchStore,
  selectStandings,
  selectMatchResult,
  hasBeenSimulated,
} from '../store/useMatchStore';
import { simulateMatch, computeScore } from '../utils/simulator';
import { resolveKnockoutBracket } from '../utils/knockoutEngine';
import KnockoutBracket from '../components/KnockoutBracket';

type Nav = BottomTabNavigationProp<BottomTabParamList>;
type ViewMode = 'groups' | 'knockout' | 'matchdays';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function gd(s: TeamStanding): number {
  return s.goalsFor - s.goalsAgainst;
}

// ─── Quick sim primitive ──────────────────────────────────────────────────────

function runQuickSim(
  fixture: Fixture,
  saveResult: (r: MatchResult) => void,
  showToast: (msg: string) => void,
) {
  const home = NATIONS_BY_ID[fixture.homeTeamId];
  const away = NATIONS_BY_ID[fixture.awayTeamId];
  if (!home || !away) return;
  const events = simulateMatch(home, away, 'en');
  const score = computeScore(events, home.id, away.id);
  saveResult({
    fixtureId: fixture.id,
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeScore: score.home,
    awayScore: score.away,
    events,
    simulatedAt: Date.now(),
  });
  showToast(`${home.flag} ${home.name} ${score.home} – ${score.away} ${away.name} ${away.flag} ⚡`);
}

// ─── Event display (reused in DETAILS modal) ─────────────────────────────────

const EVENT_ICON: Record<EventType, string> = {
  goal:        '⚽',
  yellow_card: '🟨',
  red_card:    '🟥',
  save:        '🧤',
  foul:        '🦶',
  var_check:   '📺',
  injury:      '🏥',
  kickoff:     '🏁',
  halftime:    '⏸️',
  fulltime:    '🏆',
};

const EVENT_COLOR: Record<EventType, string> = {
  goal:        COLORS.goal,
  yellow_card: COLORS.yellowCard,
  red_card:    COLORS.redCard,
  save:        COLORS.save,
  foul:        COLORS.foul,
  var_check:   COLORS.varCheck,
  injury:      COLORS.injury,
  kickoff:     COLORS.neutral,
  halftime:    COLORS.neutral,
  fulltime:    COLORS.primary,
};

function EventItem({ event, homeId }: { event: MatchEvent; homeId: string }) {
  const isNeutral = event.teamId === '';
  const side = isNeutral ? '' : event.teamId === homeId ? 'H' : 'A';
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

// ─── Points table row ─────────────────────────────────────────────────────────

function StandingRow({ team, standing, rank }: {
  team: Team;
  standing: TeamStanding | undefined;
  rank: number;
}) {
  const qualifies = rank <= 2;
  return (
    <View style={[styles.tableRow, qualifies && styles.tableRowQualifies]}>
      <Text style={styles.tableRank}>{rank}</Text>
      <Text style={styles.tableFlag}>{team.flag}</Text>
      <Text style={styles.tableName} numberOfLines={1}>{team.name}</Text>
      <Text style={styles.tableStat}>{standing?.played ?? 0}</Text>
      <Text style={styles.tableStat}>{standing?.won ?? 0}</Text>
      <Text style={styles.tableStat}>{standing?.drawn ?? 0}</Text>
      <Text style={styles.tableStat}>{standing?.lost ?? 0}</Text>
      <Text style={styles.tableStat}>
        {standing ? `${gd(standing) >= 0 ? '+' : ''}${gd(standing)}` : '—'}
      </Text>
      <Text style={[styles.tableStat, styles.tableStatPts]}>{standing?.points ?? 0}</Text>
    </View>
  );
}

// ─── Fixture card ─────────────────────────────────────────────────────────────

function FixtureCard({ fixture, result, groupBadge, onSimulate, onQuickSim, onDetails }: {
  fixture: Fixture;
  result: MatchResult | null;
  groupBadge?: string;
  onSimulate: () => void;
  onQuickSim: () => void;
  onDetails: () => void;
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

        {/* Home */}
        <View style={styles.fixtureTeam}>
          <Text style={styles.fixtureFlag}>{home.flag}</Text>
          <Text
            style={[
              styles.fixtureTeamName,
              isPlayed && result!.homeScore > result!.awayScore && styles.fixtureTeamWinner,
            ]}
            numberOfLines={1}
          >
            {home.name}
          </Text>
        </View>

        {/* Score or VS */}
        {isPlayed ? (
          <View style={styles.fixtureScoreBox}>
            <Text style={styles.fixtureScore}>
              {result!.homeScore} – {result!.awayScore}
            </Text>
            <Text style={styles.fixtureScoreLabel}>FT</Text>
          </View>
        ) : (
          <Text style={styles.fixtureVs}>VS</Text>
        )}

        {/* Away */}
        <View style={[styles.fixtureTeam, styles.fixtureTeamRight]}>
          <Text
            style={[
              styles.fixtureTeamName,
              styles.fixtureTeamNameRight,
              isPlayed && result!.awayScore > result!.homeScore && styles.fixtureTeamWinner,
            ]}
            numberOfLines={1}
          >
            {away.name}
          </Text>
          <Text style={styles.fixtureFlag}>{away.flag}</Text>
        </View>
      </View>

      <View style={styles.fixtureMeta}>
        <Text style={styles.fixtureDate}>{formatDate(fixture.date)}</Text>
        <Text style={styles.fixtureVenue} numberOfLines={1}>{fixture.venue}</Text>

        {isPlayed ? (
          <View style={styles.fixtureActions}>
            <TouchableOpacity style={styles.detailsBtn} onPress={onDetails} activeOpacity={0.75}>
              <Text style={styles.detailsBtnText}>📋</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickSimBtn} onPress={onQuickSim} activeOpacity={0.75}>
              <Text style={styles.quickSimBtnText}>⚡</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resimulateBtn} onPress={onSimulate} activeOpacity={0.75}>
              <Text style={styles.resimulateBtnText}>↺ RE-SIM</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.fixtureActions}>
            <TouchableOpacity style={styles.simulateBtn} onPress={onSimulate} activeOpacity={0.75}>
              <Text style={styles.simulateBtnText}>⚽ SIMULATE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickSimBtn} onPress={onQuickSim} activeOpacity={0.75}>
              <Text style={styles.quickSimBtnText}>⚡</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Details modal ────────────────────────────────────────────────────────────

function DetailsModal({ result, onClose }: {
  result: MatchResult;
  onClose: () => void;
}) {
  const home = NATIONS_BY_ID[result.homeTeamId];
  const away = NATIONS_BY_ID[result.awayTeamId];

  const homeGoals = result.events.filter(
    (e) => e.type === 'goal' && e.teamId === result.homeTeamId,
  );
  const awayGoals = result.events.filter(
    (e) => e.type === 'goal' && e.teamId === result.awayTeamId,
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />

        <View style={styles.modalScoreboard}>
          <View style={styles.modalTeam}>
            <Text style={styles.modalFlag}>{home?.flag}</Text>
            <Text style={styles.modalTeamName} numberOfLines={1}>{home?.name}</Text>
          </View>
          <View style={styles.modalScoreCenter}>
            <Text style={styles.modalScore}>
              {result.homeScore} – {result.awayScore}
            </Text>
            <Text style={styles.modalFT}>FULL TIME</Text>
          </View>
          <View style={[styles.modalTeam, styles.modalTeamRight]}>
            <Text style={styles.modalFlag}>{away?.flag}</Text>
            <Text style={styles.modalTeamName} numberOfLines={1}>{away?.name}</Text>
          </View>
        </View>

        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <View style={styles.goalScorers}>
            <View style={styles.goalSide}>
              {homeGoals.map((e) => (
                <Text key={e.id} style={styles.goalItem}>⚽ {e.minute}'</Text>
              ))}
            </View>
            <View style={styles.goalSide}>
              {awayGoals.map((e) => (
                <Text key={e.id} style={[styles.goalItem, styles.goalItemRight]}>
                  {e.minute}' ⚽
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.modalDivider} />

        <ScrollView style={styles.modalFeed} contentContainerStyle={{ paddingBottom: SPACING.xl }}>
          {result.events.map((e) => (
            <EventItem key={e.id} event={e} homeId={result.homeTeamId} />
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.modalCloseBtnText}>CLOSE</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Matchday section (shared between Groups and Matchdays views) ─────────────

function MatchdaySection({ label, fixtures, results, showGroupBadge, onSimulate, onQuickSim, onDetails, onSimAll }: {
  label: string;
  fixtures: Fixture[];
  results: Record<string, MatchResult>;
  showGroupBadge: boolean;
  onSimulate: (f: Fixture) => void;
  onQuickSim: (f: Fixture) => void;
  onDetails: (r: MatchResult) => void;
  onSimAll: (fixtures: Fixture[]) => void;
}) {
  const pendingCount = fixtures.filter((f) => !hasBeenSimulated(results, f.id)).length;

  return (
    <View>
      <View style={styles.matchdayHeader}>
        <Text style={styles.matchdayLabel}>{label}</Text>
        {pendingCount > 0 && (
          <TouchableOpacity
            style={styles.simAllBtn}
            onPress={() => onSimAll(fixtures)}
            activeOpacity={0.75}
          >
            <Text style={styles.simAllBtnText}>⚡ Sim All</Text>
          </TouchableOpacity>
        )}
      </View>
      {fixtures.map((fixture) => {
        const result = selectMatchResult(results, fixture.id);
        return (
          <FixtureCard
            key={fixture.id}
            fixture={fixture}
            result={result}
            groupBadge={showGroupBadge ? `Group ${fixture.group}` : undefined}
            onSimulate={() => onSimulate(fixture)}
            onQuickSim={() => onQuickSim(fixture)}
            onDetails={() => result && onDetails(result)}
          />
        );
      })}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FixturesScreen() {
  const navigation = useNavigation<Nav>();
  const [viewMode, setViewMode] = useState<ViewMode>('groups');
  const [activeGroup, setActiveGroup] = useState<string>('A');
  const [activeMatchday, setActiveMatchday] = useState<1 | 2 | 3>(1);
  const [detailsResult, setDetailsResult] = useState<MatchResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // increment to force full re-render
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { results, standings, saveResult, knockoutResults, saveKnockoutResult, clearAll } = useMatchStore();

  // ── Auto-refresh on screen focus (picks up results saved in SimulatorScreen) ─
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  // ── Reset all results ─────────────────────────────────────────────────────

  function handleReset() {
    Alert.alert(
      'Reset all results?',
      'This will clear all simulated matches and standings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            clearAll();
            setRefreshKey((k) => k + 1);
            showToast('All results cleared ✓');
          },
        },
      ],
    );
  }

  // ── Quick sim — group stage ────────────────────────────────────────────────

  function handleQuickSim(fixture: Fixture) {
    runQuickSim(fixture, saveResult, showToast);
  }

  function handleSimAllFixtures(fixtures: Fixture[]) {
    const pending = fixtures.filter((f) => !hasBeenSimulated(results, f.id));
    if (pending.length === 0) { showToast('All already simulated ✓'); return; }
    pending.forEach((f) => runQuickSim(f, saveResult, () => {}));
    showToast(`⚡ ${pending.length} match${pending.length !== 1 ? 'es' : ''} simulated`);
  }

  function handleSimAllMatchday(matchday: 1 | 2 | 3) {
    const all = GROUP_FIXTURES.filter((f) => f.matchday === matchday);
    const pending = all.filter((f) => !hasBeenSimulated(results, f.id));
    if (pending.length === 0) { showToast('All matchday matches already simulated ✓'); return; }
    pending.forEach((f) => runQuickSim(f, saveResult, () => {}));
    showToast(`⚡ ${pending.length} matches simulated`);
  }

  // ── Navigation — group stage ───────────────────────────────────────────────

  function handleSimulate(fixture: Fixture) {
    navigation.navigate('Simulator', {
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      fixtureId: fixture.id,
    });
  }

  // ── Quick sim — knockout ───────────────────────────────────────────────────

  function handleKnockoutQuickSim(match: ResolvedKnockoutMatch) {
    if (!match.homeTeamId || !match.awayTeamId) return;
    const home = NATIONS_BY_ID[match.homeTeamId];
    const away = NATIONS_BY_ID[match.awayTeamId];
    if (!home || !away) return;
    const events = simulateMatch(home, away, 'en');
    const score  = computeScore(events, home.id, away.id);
    // Re-sim: if it's a draw, add 1 for home (no extra time in sim)
    const homeScore = score.home === score.away ? score.home + 1 : score.home;
    const awayScore = score.home === score.away ? score.away     : score.away;
    saveKnockoutResult({
      matchId: match.def.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeScore,
      awayScore,
      events,
      simulatedAt: Date.now(),
    });
    showToast(`${home.flag} ${home.name} ${homeScore} – ${awayScore} ${away.name} ${away.flag} ⚡`);
  }

  function handleKnockoutSimulate(match: ResolvedKnockoutMatch) {
    if (!match.homeTeamId || !match.awayTeamId) return;
    // Navigate to SimulatorScreen; knockout match ID stored as string fixtureId
    navigation.navigate('Simulator', {
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      fixtureId: `ko-${match.def.id}`,
    });
  }

  // ── Groups view data ───────────────────────────────────────────────────────

  const sortedStandings = selectStandings(standings, activeGroup);
  const standingByTeam  = Object.fromEntries(sortedStandings.map((s) => [s.teamId, s]));
  const groupTeams: Team[] = sortedStandings.length === 4
    ? sortedStandings.map((s) => NATIONS_BY_ID[s.teamId]).filter(Boolean) as Team[]
    : (NATIONS_BY_GROUP[activeGroup] ?? []);
  const groupFixtures   = fixturesByGroup(activeGroup);
  const simulatedCount  = groupFixtures.filter((f) => hasBeenSimulated(results, f.id)).length;

  // ── Matchdays view data ────────────────────────────────────────────────────

  const matchdayFixtures = GROUP_FIXTURES
    .filter((f) => f.matchday === activeMatchday)
    .sort((a, b) => a.date.localeCompare(b.date));
  const matchdayPendingCount = matchdayFixtures.filter(
    (f) => !hasBeenSimulated(results, f.id),
  ).length;

  // ── Knockout view data ─────────────────────────────────────────────────────

  const resolvedBracket = resolveKnockoutBracket(standings, results, knockoutResults);

  // ── Render ─────────────────────────────────────────────────────────────────

  // refreshKey is used as a key prop on the inner content to force remount
  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>
          {viewMode === 'knockout' ? '🏆 KNOCKOUT' : '🏟 GROUP STAGE'}
        </Text>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleReset}
          activeOpacity={0.5}
        >
          <Text style={styles.resetBtnText}>🗑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => setRefreshKey((k) => k + 1)}
          activeOpacity={0.5}
        >
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* View mode toggle */}
      <View style={styles.viewToggle}>
        {(['groups', 'knockout', 'matchdays'] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleActive]}
            onPress={() => setViewMode(mode)}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>
              {mode === 'groups' ? 'Groups' : mode === 'knockout' ? 'Knockout' : 'Matchdays'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab bar — only shown in Groups and Matchdays views */}
      {viewMode !== 'knockout' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
          style={styles.tabBarWrap}
        >
          {viewMode === 'groups'
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
              ))
          }
        </ScrollView>
      )}

      {/* ── GROUPS VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'groups' && (
        <ScrollView key={`groups-${refreshKey}`} style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.groupHeadingRow}>
            <Text style={styles.sectionLabel}>GROUP {activeGroup}</Text>
            <Text style={styles.progressLabel}>{simulatedCount}/6 played</Text>
          </View>

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
              <StandingRow key={t.id} team={t} standing={standingByTeam[t.id]} rank={i + 1} />
            ))}
          </View>

          {([1, 2, 3] as const).map((md) => (
            <MatchdaySection
              key={md}
              label={`Matchday ${md}`}
              fixtures={groupFixtures.filter((f) => f.matchday === md)}
              results={results}
              showGroupBadge={false}
              onSimulate={handleSimulate}
              onQuickSim={handleQuickSim}
              onDetails={setDetailsResult}
              onSimAll={handleSimAllFixtures}
            />
          ))}
        </ScrollView>
      )}

      {/* ── KNOCKOUT VIEW ────────────────────────────────────────────────────── */}
      {viewMode === 'knockout' && (
        <View key={`knockout-${refreshKey}`} style={styles.content}>
          <KnockoutBracket
            resolved={resolvedBracket}
            onQuickSim={handleKnockoutQuickSim}
            onSimulate={handleKnockoutSimulate}
          />
        </View>
      )}

      {/* ── MATCHDAYS VIEW ───────────────────────────────────────────────────── */}
      {viewMode === 'matchdays' && (
        <ScrollView key={`matchdays-${refreshKey}`} style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.matchdayViewHeader}>
            <View>
              <Text style={styles.sectionLabel}>MATCHDAY {activeMatchday}</Text>
              <Text style={styles.progressLabel}>
                {matchdayFixtures.length - matchdayPendingCount}/{matchdayFixtures.length} played
              </Text>
            </View>
            {matchdayPendingCount > 0 && (
              <TouchableOpacity
                style={styles.simAllMatchdayBtn}
                onPress={() => handleSimAllMatchday(activeMatchday)}
                activeOpacity={0.8}
              >
                <Text style={styles.simAllMatchdayBtnText}>⚡ Sim All Matchday</Text>
              </TouchableOpacity>
            )}
          </View>

          {matchdayFixtures.map((fixture) => {
            const result = selectMatchResult(results, fixture.id);
            return (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                result={result}
                groupBadge={`Group ${fixture.group}`}
                onSimulate={() => handleSimulate(fixture)}
                onQuickSim={() => handleQuickSim(fixture)}
                onDetails={() => result && setDetailsResult(result)}
              />
            );
          })}
        </ScrollView>
      )}

      {/* Details modal */}
      {detailsResult && (
        <DetailsModal result={detailsResult} onClose={() => setDetailsResult(null)} />
      )}

      {/* Toast */}
      {toast !== null && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.md,
  },
  header: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
    letterSpacing: 1.5,
  },
  resetBtn: { padding: SPACING.xs },
  resetBtnText: {
    fontSize: FONT_SIZE.lg,
  },
  refreshBtn: { padding: SPACING.xs },
  refreshBtnText: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.textMuted,
    fontWeight: 'bold',
  },

  // ── View mode toggle ──
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
  viewToggleBtn: {
    flex: 1,
    paddingVertical: SPACING.xs + 2,
    alignItems: 'center',
  },
  viewToggleActive: {
    backgroundColor: COLORS.primary,
  },
  viewToggleText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  viewToggleTextActive: {
    color: '#000',
  },

  // ── Tab bar ──
  tabBarWrap: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBar: {
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
    alignItems: 'center',
    height: 44,
  },
  tab: {
    width: 34,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabWide: {
    width: 52,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#000',
  },

  // ── Content ──
  content: { flex: 1 },
  contentInner: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  // ── Group heading ──
  groupHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  progressLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  // ── Matchday view header ──
  matchdayViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  simAllMatchdayBtn: {
    backgroundColor: COLORS.warning,
    borderRadius: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  simAllMatchdayBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
  },

  // ── Points table ──
  table: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: COLORS.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeaderText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tableRowQualifies: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  tableRank: {
    width: 16,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginRight: 2,
  },
  tableFlag: {
    fontSize: FONT_SIZE.md,
    width: 24,
    marginRight: 4,
  },
  tableName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  tableStat: {
    width: 26,
    textAlign: 'center',
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  tableStatPts: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },

  // ── Matchday section header ──
  matchdayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  matchdayLabel: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  simAllBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  simAllBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    color: COLORS.warning,
    letterSpacing: 0.5,
  },

  // ── Fixture card ──
  fixtureCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  fixtureCardPlayed: {
    borderColor: COLORS.success,
    opacity: 0.92,
  },
  fixtureTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  groupBadge: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  fixtureTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  fixtureTeamRight: { justifyContent: 'flex-end' },
  fixtureFlag: { fontSize: FONT_SIZE.xl },
  fixtureTeamName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  fixtureTeamNameRight: { textAlign: 'right' },
  fixtureTeamWinner: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  fixtureVs: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: 'bold',
    paddingHorizontal: SPACING.xs,
  },
  fixtureScoreBox: {
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  fixtureScore: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  fixtureScoreLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  fixtureMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  fixtureDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
    width: 44,
  },
  fixtureVenue: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  fixtureActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
    alignItems: 'center',
  },
  simulateBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  simulateBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
  },
  quickSimBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  quickSimBtnText: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 16,
  },
  resimulateBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
  },
  resimulateBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  detailsBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailsBtnText: { fontSize: FONT_SIZE.xs },

  // ── Toast ──
  toast: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: 'rgba(20,40,28,0.95)',
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warning,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  toastText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Details modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  modalScoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  modalTeam: { flex: 1, alignItems: 'center', gap: 2 },
  modalTeamRight: {},
  modalFlag: { fontSize: FONT_SIZE.xxl },
  modalTeamName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalScoreCenter: { alignItems: 'center', paddingHorizontal: SPACING.md },
  modalScore: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  modalFT: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 2,
  },
  goalScorers: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
  },
  goalSide: { flex: 1, gap: 2 },
  goalItem: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  goalItemRight: { textAlign: 'right' },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  modalFeed: { paddingHorizontal: SPACING.md },
  modalCloseBtn: {
    margin: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },

  // ── Event feed (modal) ──
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    borderRadius: 6,
    padding: SPACING.sm,
    gap: SPACING.sm,
    marginBottom: 2,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.border,
  },
  eventIcon: { fontSize: FONT_SIZE.md, marginTop: 1 },
  eventBody: { flex: 1 },
  eventMinute: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', marginBottom: 2 },
  eventCommentary: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 18 },
});
