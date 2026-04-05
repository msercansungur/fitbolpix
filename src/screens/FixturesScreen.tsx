import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  useAnimatedValue,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GROUP_FIXTURES, GROUPS, fixturesByGroup } from '../constants/fixtures';
import { NATIONS_BY_ID, NATIONS_BY_GROUP } from '../constants/nations';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';
import { Fixture } from '../types/fixture';
import { Team } from '../types/simulator';
import { useFixtureStore } from '../store/useFixtureStore';
import { LiveResult } from '../services/fixtureService';
import { resolveKnockoutBracket } from '../utils/knockoutEngine';
import KnockoutBracket from '../components/KnockoutBracket';

type ViewMode = 'groups' | 'knockout' | 'matchdays';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  // We don't have time data in local fixtures; show date only
  return formatDate(iso);
}

function isLiveStatus(status: string): boolean {
  return !['NS', 'FT', 'AET', 'PEN', 'PST', 'CANC', 'TBD'].includes(status);
}

// ─── Inline standings from live results ──────────────────────────────────────

interface GroupRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
}

function computeGroupStandings(
  group: string,
  liveResults: Record<string, LiveResult>,
): GroupRow[] {
  const fixtures = GROUP_FIXTURES.filter((f) => f.group === group);
  const map: Record<string, GroupRow> = {};

  // Initialise all 4 teams
  fixtures.forEach((f) => {
    [f.homeTeamId, f.awayTeamId].forEach((id) => {
      if (!map[id]) map[id] = { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
    });
  });

  // Accumulate finished results only
  fixtures.forEach((f) => {
    const r = liveResults[f.id];
    if (!r) return;
    const finished = r.status === 'FT' || r.status === 'AET' || r.status === 'PEN';
    if (!finished) return;
    const h = map[f.homeTeamId];
    const a = map[f.awayTeamId];
    if (!h || !a) return;
    h.played++; a.played++;
    h.gf += r.homeScore; h.ga += r.awayScore;
    a.gf += r.awayScore; a.ga += r.homeScore;
    if (r.homeScore > r.awayScore) { h.won++; h.pts += 3; a.lost++; }
    else if (r.homeScore < r.awayScore) { a.won++; a.pts += 3; h.lost++; }
    else { h.drawn++; h.pts++; a.drawn++; a.pts++; }
  });

  return Object.values(map).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamId.localeCompare(b.teamId);
  });
}

// ─── Live badge (pulsing red dot) ─────────────────────────────────────────────

function LiveBadge({ elapsed }: { elapsed: number | null }) {
  const pulse = useAnimatedValue(1);
  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={styles.liveBadge}>
      <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
      <Text style={styles.liveBadgeText}>LIVE{elapsed ? ` ${elapsed}'` : ''}</Text>
    </View>
  );
}

// ─── Standings row ────────────────────────────────────────────────────────────

function StandingRow({ row, rank }: { row: GroupRow; rank: number }) {
  const team = NATIONS_BY_ID[row.teamId];
  const gd   = row.gf - row.ga;
  const qualifies = rank <= 2;
  return (
    <View style={[styles.tableRow, qualifies && styles.tableRowQualifies]}>
      <Text style={styles.tableRank}>{rank}</Text>
      <Text style={styles.tableFlag}>{team?.flag ?? '🏳️'}</Text>
      <Text style={styles.tableName} numberOfLines={1}>{team?.name ?? row.teamId}</Text>
      <Text style={styles.tableStat}>{row.played}</Text>
      <Text style={styles.tableStat}>{row.won}</Text>
      <Text style={styles.tableStat}>{row.drawn}</Text>
      <Text style={styles.tableStat}>{row.lost}</Text>
      <Text style={styles.tableStat}>{gd >= 0 ? '+' : ''}{gd}</Text>
      <Text style={[styles.tableStat, styles.tableStatPts]}>{row.pts}</Text>
    </View>
  );
}

// ─── Fixture card (read-only) ─────────────────────────────────────────────────

function FixtureCard({ fixture, liveResult, groupBadge }: {
  fixture: Fixture;
  liveResult: LiveResult | null;
  groupBadge?: string;
}) {
  const home = NATIONS_BY_ID[fixture.homeTeamId];
  const away = NATIONS_BY_ID[fixture.awayTeamId];
  if (!home || !away) return null;

  const isFinished = liveResult && (liveResult.status === 'FT' || liveResult.status === 'AET' || liveResult.status === 'PEN');
  const isLive     = liveResult && isLiveStatus(liveResult.status);
  const hasScore   = isFinished || isLive;

  const homeWinner = isFinished && liveResult!.homeScore > liveResult!.awayScore;
  const awayWinner = isFinished && liveResult!.awayScore > liveResult!.homeScore;

  return (
    <View style={[styles.fixtureCard, isFinished && styles.fixtureCardDone]}>
      <View style={styles.fixtureTeams}>
        {groupBadge && (
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>{groupBadge}</Text>
          </View>
        )}

        {/* Home */}
        <View style={styles.fixtureTeam}>
          <Text style={styles.fixtureFlag}>{home.flag}</Text>
          <Text style={[styles.fixtureTeamName, homeWinner && styles.fixtureTeamWinner]} numberOfLines={1}>
            {home.name}
          </Text>
        </View>

        {/* Score or date */}
        {hasScore ? (
          <View style={styles.fixtureScoreBox}>
            <Text style={styles.fixtureScore}>
              {liveResult!.homeScore} – {liveResult!.awayScore}
            </Text>
            {isFinished
              ? <Text style={styles.fixtureScoreLabel}>FT</Text>
              : <LiveBadge elapsed={liveResult!.elapsed} />
            }
          </View>
        ) : (
          <Text style={styles.fixtureVs}>VS</Text>
        )}

        {/* Away */}
        <View style={[styles.fixtureTeam, styles.fixtureTeamRight]}>
          <Text style={[styles.fixtureTeamName, styles.fixtureTeamNameRight, awayWinner && styles.fixtureTeamWinner]} numberOfLines={1}>
            {away.name}
          </Text>
          <Text style={styles.fixtureFlag}>{away.flag}</Text>
        </View>
      </View>

      {/* Meta row */}
      <View style={styles.fixtureMeta}>
        <Text style={styles.fixtureDate}>{formatDate(fixture.date)}</Text>
        <Text style={styles.fixtureVenue} numberOfLines={1}>{fixture.venue}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FixturesScreen() {
  const [viewMode,      setViewMode]      = useState<ViewMode>('groups');
  const [activeGroup,   setActiveGroup]   = useState<string>('A');
  const [activeMatchday, setActiveMatchday] = useState<1 | 2 | 3>(1);

  const { liveResults, isLoading, fetchResults } = useFixtureStore();

  // Fetch on focus (respects internal cache — won't over-call API)
  useFocusEffect(
    React.useCallback(() => {
      fetchResults();
    }, [fetchResults]),
  );

  // ── Groups view ────────────────────────────────────────────────────────────
  const groupFixtures  = fixturesByGroup(activeGroup);
  const groupStandings = useMemo(
    () => computeGroupStandings(activeGroup, liveResults),
    [activeGroup, liveResults],
  );
  const groupTeams: Team[] = groupStandings.length === 4
    ? groupStandings.map((r) => NATIONS_BY_ID[r.teamId]).filter(Boolean) as Team[]
    : (NATIONS_BY_GROUP[activeGroup] ?? []);

  // ── Matchdays view ─────────────────────────────────────────────────────────
  const matchdayFixtures = GROUP_FIXTURES
    .filter((f) => f.matchday === activeMatchday)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Knockout view ──────────────────────────────────────────────────────────
  // We don't have real knockout results yet from API (group stage only endpoint)
  // Show structural bracket with no scores — scores will appear when API delivers them
  const resolvedBracket = useMemo(
    () => resolveKnockoutBracket({}, {}, {}),
    [],
  );

  const finishedCount = groupFixtures.filter((f) => {
    const r = liveResults[f.id];
    return r && (r.status === 'FT' || r.status === 'AET' || r.status === 'PEN');
  }).length;

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>🏆 WC 2026</Text>
        {isLoading && <Text style={styles.loadingLabel}>↻</Text>}
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

      {/* Tab bar */}
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
              ))}
        </ScrollView>
      )}

      {/* ── GROUPS VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'groups' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.groupHeadingRow}>
            <Text style={styles.sectionLabel}>GROUP {activeGroup}</Text>
            <Text style={styles.progressLabel}>{finishedCount}/6 played</Text>
          </View>

          {/* Standings table */}
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
            {groupTeams.map((t, i) => {
              const row = groupStandings.find((r) => r.teamId === t.id);
              const blankRow: GroupRow = { teamId: t.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
              return <StandingRow key={t.id} row={row ?? blankRow} rank={i + 1} />;
            })}
          </View>

          {/* Fixtures by matchday */}
          {([1, 2, 3] as const).map((md) => (
            <View key={md}>
              <Text style={styles.matchdayLabel}>Matchday {md}</Text>
              {groupFixtures.filter((f) => f.matchday === md).map((fixture) => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  liveResult={liveResults[fixture.id] ?? null}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── MATCHDAYS VIEW ───────────────────────────────────────────────────── */}
      {viewMode === 'matchdays' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <Text style={styles.sectionLabel}>MATCHDAY {activeMatchday}</Text>
          {matchdayFixtures.map((fixture) => (
            <FixtureCard
              key={fixture.id}
              fixture={fixture}
              liveResult={liveResults[fixture.id] ?? null}
              groupBadge={`Group ${fixture.group}`}
            />
          ))}
        </ScrollView>
      )}

      {/* ── KNOCKOUT VIEW ────────────────────────────────────────────────────── */}
      {viewMode === 'knockout' && (
        <View style={styles.content}>
          <KnockoutBracket resolved={resolvedBracket} />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Header
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
  loadingLabel: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.textMuted,
    fontWeight: 'bold',
  },

  // View mode toggle
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
  viewToggleActive: { backgroundColor: COLORS.primary },
  viewToggleText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  viewToggleTextActive: { color: '#000' },

  // Tab bar
  tabBarWrap: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBar: { paddingHorizontal: SPACING.sm, gap: SPACING.xs, alignItems: 'center', height: 44 },
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
  tabWide: { width: 52 },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: COLORS.textSecondary },
  tabTextActive: { color: '#000' },

  // Content
  content: { flex: 1 },
  contentInner: { padding: SPACING.md, paddingBottom: SPACING.xl },

  // Group heading
  groupHeadingRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.sm },
  sectionLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  progressLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  // Standings table
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
  tableHeaderText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tableRowQualifies: { borderLeftWidth: 3, borderLeftColor: COLORS.success },
  tableRank: { width: 16, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center', marginRight: 2 },
  tableFlag: { fontSize: FONT_SIZE.md, width: 24, marginRight: 4 },
  tableName: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  tableStat: { width: 26, textAlign: 'center', fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  tableStatPts: { color: COLORS.primary, fontWeight: 'bold' },

  // Matchday label
  matchdayLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },

  // Fixture card
  fixtureCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  fixtureCardDone: { borderColor: COLORS.success, opacity: 0.92 },
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
  groupBadgeText: { fontSize: 9, fontWeight: 'bold', color: COLORS.textMuted, letterSpacing: 0.3 },
  fixtureTeam: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  fixtureTeamRight: { justifyContent: 'flex-end' },
  fixtureFlag: { fontSize: FONT_SIZE.xl },
  fixtureTeamName: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  fixtureTeamNameRight: { textAlign: 'right' },
  fixtureTeamWinner: { color: COLORS.textPrimary, fontWeight: 'bold' },
  fixtureVs: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: 'bold',
    paddingHorizontal: SPACING.xs,
  },
  fixtureScoreBox: { alignItems: 'center', paddingHorizontal: SPACING.sm },
  fixtureScore: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  fixtureScoreLabel: { fontSize: FONT_SIZE.xs, color: COLORS.success, fontWeight: 'bold', letterSpacing: 1 },
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
  fixtureDate: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600', width: 60 },
  fixtureVenue: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  // Live badge
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.danger },
  liveBadgeText: { fontSize: 9, fontWeight: 'bold', color: COLORS.danger, letterSpacing: 0.5 },
});
