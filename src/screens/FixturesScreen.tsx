import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useAnimatedValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { GROUP_FIXTURES, GROUPS, fixturesByGroup } from '../constants/fixtures';
import { NATIONS_BY_ID, NATIONS_BY_GROUP } from '../constants/nations';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import PixelFlag from '../components/PixelFlag';
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
      <View style={styles.tableFlagWrap}>
        {team ? <PixelFlag isoCode={team.isoCode} size={16} /> : <Text style={styles.tableFlag}>🏳️</Text>}
      </View>
      <Text style={styles.tableName} numberOfLines={1}>{team?.code3 ?? row.teamId}</Text>
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
          <PixelFlag isoCode={home.isoCode} size={22} />
          <Text style={[styles.fixtureTeamName, homeWinner && styles.fixtureTeamWinner]} numberOfLines={1}>
            {home.code3}
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
            {away.code3}
          </Text>
          <PixelFlag isoCode={away.isoCode} size={22} />
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

type GroupSubTab = 'fixtures' | 'stats';

export default function FixturesScreen() {
  const [viewMode,      setViewMode]      = useState<ViewMode>('groups');
  const [activeGroup,   setActiveGroup]   = useState<string>('A');
  const [activeMatchday, setActiveMatchday] = useState<1 | 2 | 3>(1);
  const [groupSubTab,   setGroupSubTab]   = useState<GroupSubTab>('fixtures');

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
        <>
          {/* Sub-tab: Fixtures / Stats */}
          <View style={styles.subTabBar}>
            {(['fixtures', 'stats'] as GroupSubTab[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.subTab, groupSubTab === t && styles.subTabActive]}
                onPress={() => setGroupSubTab(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.subTabText, groupSubTab === t && styles.subTabTextActive]}>
                  {t === 'fixtures' ? 'FIXTURES' : 'STATS'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            <View style={styles.groupHeadingRow}>
              <Text style={styles.sectionLabel}>GROUP {activeGroup}</Text>
              <Text style={styles.progressLabel}>{finishedCount}/6 played</Text>
            </View>

            {/* Standings table — always visible */}
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableRank, styles.tableHeaderText]}>#</Text>
                <View style={styles.tableFlagWrap} />
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

            {/* Fixtures sub-tab */}
            {groupSubTab === 'fixtures' && ([1, 2, 3] as const).map((md) => (
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

            {/* Stats sub-tab placeholder */}
            {groupSubTab === 'stats' && (
              <View style={styles.statsPlaceholder}>
                <Text style={styles.statsPlaceholderIcon}>📊</Text>
                <Text style={styles.statsPlaceholderText}>Group stats coming soon</Text>
                <Text style={styles.statsPlaceholderHint}>Top scorers, cards, and more</Text>
              </View>
            )}
          </ScrollView>
        </>
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
  root: { flex: 1, backgroundColor: COLORS.bgPrimary },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.md,
  },
  header: {
    flex: 1,
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.accent,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
    letterSpacing: 2,
  },
  loadingLabel: {
    fontSize: 20,
    color: COLORS.textMuted,
  },

  // View mode toggle
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  viewToggleBtn: { flex: 1, paddingVertical: SPACING.xs + 2, alignItems: 'center' },
  viewToggleActive: { backgroundColor: COLORS.primary },
  viewToggleText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  viewToggleTextActive: { color: COLORS.textPrimary },

  // Tab bar
  tabBarWrap: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBar: { paddingHorizontal: SPACING.sm, gap: SPACING.xs, alignItems: 'center', height: 44 },
  tab: {
    width: 34,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabWide: { width: 52 },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tabTextActive: { color: COLORS.textPrimary },

  // Content
  content: { flex: 1 },
  contentInner: { padding: SPACING.md, paddingBottom: SPACING.xl },

  // Group heading
  groupHeadingRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.sm },
  sectionLabel: {
    flex: 1,
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.accent,
    letterSpacing: 1.5,
  },
  progressLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Standings table
  table: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: COLORS.bgCardAlt,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeaderText: {
    fontFamily: FONTS.headingMedium,
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowQualifies: { borderLeftWidth: 3, borderLeftColor: COLORS.success },
  tableRank: {
    width: 16,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginRight: 2,
  },
  tableFlag: { fontSize: 15, width: 24, marginRight: 4 },
  tableFlagWrap: { width: 22, marginRight: 4, alignItems: 'center' as const },
  tableName: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  tableStat: {
    width: 26,
    textAlign: 'center',
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  tableStatPts: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.accent,
  },

  // Matchday label
  matchdayLabel: {
    fontFamily: FONTS.headingMedium,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },

  // Fixture card
  fixtureCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  fixtureCardDone: { borderColor: COLORS.borderLight },
  fixtureTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  groupBadge: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  fixtureTeam: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  fixtureTeamRight: { justifyContent: 'flex-end' },
  fixtureFlag: { fontSize: 22 },
  fixtureTeamName: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  fixtureTeamNameRight: { textAlign: 'right' },
  fixtureTeamWinner: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.textPrimary,
  },
  fixtureVs: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
    paddingHorizontal: SPACING.xs,
  },
  fixtureScoreBox: { alignItems: 'center', paddingHorizontal: SPACING.sm },
  fixtureScore: {
    fontFamily: FONTS.pixel,
    fontSize: 18,
    color: COLORS.accent,
    letterSpacing: 2,
  },
  fixtureScoreLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.success,
    letterSpacing: 1,
  },
  fixtureMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  fixtureDate: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textSecondary,
    width: 60,
  },
  fixtureVenue: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Sub-tab (Fixtures / Stats)
  subTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgSurface,
  },
  subTab: {
    flex: 1,
    paddingVertical: SPACING.xs + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabActive: { borderBottomColor: COLORS.accent },
  subTabText: {
    fontFamily: FONTS.pixel,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  subTabTextActive: { color: COLORS.accent },

  // Stats placeholder
  statsPlaceholder: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  statsPlaceholderIcon: { fontSize: 40 },
  statsPlaceholderText: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  statsPlaceholderHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Live badge
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.danger },
  liveBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.danger,
    letterSpacing: 0.5,
  },
});
