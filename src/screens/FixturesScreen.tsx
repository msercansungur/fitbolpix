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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { GROUP_FIXTURES, GROUPS, fixturesByGroup } from '../constants/fixtures';
import { NATIONS_BY_ID, NATIONS_BY_GROUP } from '../constants/nations';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, PIXEL_SHADOW } from '../theme';
import { cardGreen } from '../theme/gradients';
import PixelFlag from '../components/PixelFlag';
import { Fixture } from '../types/fixture';
import { Team } from '../types/simulator';
import { useFixtureStore } from '../store/useFixtureStore';
import { LiveResult } from '../services/fixtureService';
import { resolveKnockoutBracket } from '../utils/knockoutEngine';
import KnockoutBracket from '../components/KnockoutBracket';

type ViewMode     = 'groups' | 'knockout' | 'matchdays';
type GroupSubTab  = 'fixtures' | 'stats';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isLiveStatus(status: string): boolean {
  return !['NS', 'FT', 'AET', 'PEN', 'PST', 'CANC', 'TBD'].includes(status);
}

// ─── Inline standings from live results ──────────────────────────────────────
interface GroupRow {
  teamId: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; pts: number;
}

function computeGroupStandings(
  group: string,
  liveResults: Record<string, LiveResult>,
): GroupRow[] {
  const fixtures = GROUP_FIXTURES.filter((f) => f.group === group);
  const map: Record<string, GroupRow> = {};
  fixtures.forEach((f) => {
    [f.homeTeamId, f.awayTeamId].forEach((id) => {
      if (!map[id]) map[id] = { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
    });
  });
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

// ─── Pixel glyph ──────────────────────────────────────────────────────────────
type GlyphKind = 'trophy' | 'bolt' | 'chev';
const GLYPHS: Record<GlyphKind, string[]> = {
  trophy: ['111111','011110','011110','001100','011110','111111'],
  bolt:   ['000110','001100','011100','111100','001100','011000'],
  chev:   ['010000','011000','011100','011100','011000','010000'],
};
function PixelGlyph({ kind, color, px = 2 }: { kind: GlyphKind; color: string; px?: number }) {
  return (
    <View style={{ width: px * 6, height: px * 6 }}>
      {GLYPHS[kind].map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, ci) => (
            <View key={ci} style={{ width: px, height: px, backgroundColor: c === '1' ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Live badge (pulsing red dot) ────────────────────────────────────────────
function LiveBadge({ elapsed }: { elapsed: number | null }) {
  const pulse = useAnimatedValue(1);
  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
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

// ─── Standings row ───────────────────────────────────────────────────────────
function StandingRow({ row, rank, isLast }: { row: GroupRow; rank: number; isLast: boolean }) {
  const team = NATIONS_BY_ID[row.teamId];
  const gd   = row.gf - row.ga;
  const qualifies = rank <= 2;
  const gdColor = gd > 0 ? COLORS.green : gd < 0 ? COLORS.red : COLORS.textSecondary;
  return (
    <View style={[styles.standRow, qualifies && styles.standRowQual, !isLast && styles.standRowBorder]}>
      {qualifies && <View style={styles.standQualBar} />}
      <Text style={styles.standRank}>{rank}</Text>
      <View style={styles.standFlagWrap}>
        {team ? <PixelFlag isoCode={team.isoCode} size={16} /> : <Text>🏳️</Text>}
      </View>
      <Text style={styles.standName} numberOfLines={1}>{team?.code3 ?? row.teamId}</Text>
      <Text style={styles.standStat}>{row.played}</Text>
      <Text style={styles.standStat}>{row.won}</Text>
      <Text style={styles.standStat}>{row.drawn}</Text>
      <Text style={styles.standStat}>{row.lost}</Text>
      <Text style={[styles.standStat, { color: gdColor }]}>
        {gd >= 0 ? '+' : ''}{gd}
      </Text>
      <Text style={styles.standPts}>{row.pts}</Text>
    </View>
  );
}

// ─── Fixture card ────────────────────────────────────────────────────────────
function FixtureCard({
  fixture, liveResult, groupBadge,
}: {
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
    <View style={styles.fxShadow}>
      <LinearGradient {...cardGreen} style={styles.fxCard}>
        <View style={styles.fxRow}>
          {/* Home */}
          <View style={styles.fxTeam}>
            <PixelFlag isoCode={home.isoCode} size={20} />
            <Text
              style={[
                styles.fxTeamCode,
                !homeWinner && isFinished && styles.fxTeamMuted,
              ]}
              numberOfLines={1}
            >
              {home.code3}
            </Text>
          </View>

          {/* Score or VS */}
          {hasScore ? (
            <View style={styles.fxScoreBox}>
              <Text style={styles.fxScore}>
                {liveResult!.homeScore} – {liveResult!.awayScore}
              </Text>
              {isFinished
                ? <Text style={styles.fxScoreLabel}>FT</Text>
                : <LiveBadge elapsed={liveResult!.elapsed} />}
            </View>
          ) : (
            <Text style={styles.fxVs}>VS</Text>
          )}

          {/* Away */}
          <View style={[styles.fxTeam, styles.fxTeamRight]}>
            <Text
              style={[
                styles.fxTeamCode,
                styles.fxTeamCodeRight,
                !awayWinner && isFinished && styles.fxTeamMuted,
              ]}
              numberOfLines={1}
            >
              {away.code3}
            </Text>
            <PixelFlag isoCode={away.isoCode} size={20} />
          </View>
        </View>

        {/* Meta row */}
        <View style={styles.fxMeta}>
          <Text style={styles.fxMetaDate}>{formatDate(fixture.date)}</Text>
          <Text style={styles.fxMetaVenue} numberOfLines={1}>{fixture.venue}</Text>
          {groupBadge && (
            <View style={styles.fxGroupBadge}>
              <Text style={styles.fxGroupBadgeText}>{groupBadge.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function FixturesScreen() {
  const insets = useSafeAreaInsets();
  const [viewMode,       setViewMode]       = useState<ViewMode>('groups');
  const [activeGroup,    setActiveGroup]    = useState<string>('A');
  const [activeMatchday, setActiveMatchday] = useState<1 | 2 | 3>(1);
  const [groupSubTab,    setGroupSubTab]    = useState<GroupSubTab>('fixtures');

  const { liveResults, isLoading, fetchResults } = useFixtureStore();

  useFocusEffect(
    React.useCallback(() => { fetchResults(); }, [fetchResults]),
  );

  // Groups view derivations
  const groupFixtures  = fixturesByGroup(activeGroup);
  const groupStandings = useMemo(
    () => computeGroupStandings(activeGroup, liveResults),
    [activeGroup, liveResults],
  );
  const groupTeams: Team[] = groupStandings.length === 4
    ? groupStandings.map((r) => NATIONS_BY_ID[r.teamId]).filter(Boolean) as Team[]
    : (NATIONS_BY_GROUP[activeGroup] ?? []);

  // Matchdays view
  const matchdayFixtures = GROUP_FIXTURES
    .filter((f) => f.matchday === activeMatchday)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Knockout view (stub — no data yet)
  const resolvedBracket = useMemo(() => resolveKnockoutBracket({}, {}, {}), []);

  const finishedCount = groupFixtures.filter((f) => {
    const r = liveResults[f.id];
    return r && (r.status === 'FT' || r.status === 'AET' || r.status === 'PEN');
  }).length;

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <PixelGlyph kind="trophy" color={COLORS.gold} px={3} />
        <Text style={styles.headerTitle}>Scores & Fixtures</Text>
        {isLoading && <Text style={styles.headerLoad}>⟳</Text>}
      </View>

      {/* ── Sub-tab switcher ─────────────────────────────────── */}
      <View style={styles.subtabsWrap}>
        <View style={styles.subtabsInner}>
          {(['groups', 'knockout', 'matchdays'] as ViewMode[]).map((mode) => {
            const active = viewMode === mode;
            const label  = mode === 'groups' ? 'GROUPS' : mode === 'knockout' ? 'KNOCKOUT' : 'MATCHDAYS';
            return (
              <TouchableOpacity
                key={mode}
                activeOpacity={0.8}
                style={styles.subtabSlot}
                onPress={() => setViewMode(mode)}
              >
                {active ? (
                  <LinearGradient {...cardGreen} style={styles.subtab}>
                    <Text style={styles.subtabTextActive}>{label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.subtab}>
                    <Text style={styles.subtabText}>{label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── GROUPS VIEW ───────────────────────────────────────── */}
      {viewMode === 'groups' && (
        <>
          {/* Group chip row (A–L) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRowWrap}
            contentContainerStyle={styles.chipRow}
          >
            {GROUPS.map((g) => {
              const active = activeGroup === g;
              return (
                <TouchableOpacity
                  key={g}
                  activeOpacity={0.8}
                  onPress={() => setActiveGroup(g)}
                  style={styles.chipShadow}
                >
                  {active ? (
                    <LinearGradient {...cardGreen} style={[styles.chip, styles.chipActive]}>
                      <Text style={styles.chipTextActive}>{g}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{g}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, { paddingBottom: 120 + insets.bottom }]}>
            {/* Group heading */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>GROUP {activeGroup}</Text>
              <Text style={styles.sectionMeta}>{finishedCount}/6 PLAYED</Text>
            </View>

            {/* Standings card */}
            <View style={styles.standCardShadow}>
              <LinearGradient {...cardGreen} style={styles.standCard}>
                <View style={[styles.standHead]}>
                  <Text style={[styles.standRank, styles.standHeadText]}>#</Text>
                  <View style={styles.standFlagWrap} />
                  <Text style={[styles.standName, styles.standHeadText]}>TEAM</Text>
                  <Text style={[styles.standStat, styles.standHeadText]}>P</Text>
                  <Text style={[styles.standStat, styles.standHeadText]}>W</Text>
                  <Text style={[styles.standStat, styles.standHeadText]}>D</Text>
                  <Text style={[styles.standStat, styles.standHeadText]}>L</Text>
                  <Text style={[styles.standStat, styles.standHeadText]}>GD</Text>
                  <Text style={[styles.standPts, styles.standHeadText, styles.standHeadPts]}>PTS</Text>
                </View>
                {groupTeams.map((t, i) => {
                  const row = groupStandings.find((r) => r.teamId === t.id);
                  const blankRow: GroupRow = { teamId: t.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
                  return (
                    <StandingRow
                      key={t.id}
                      row={row ?? blankRow}
                      rank={i + 1}
                      isLast={i === groupTeams.length - 1}
                    />
                  );
                })}
              </LinearGradient>
            </View>

            {/* Fixtures / Stats inner toggle (preserved) */}
            <View style={styles.innerTabs}>
              {(['fixtures', 'stats'] as GroupSubTab[]).map((t) => {
                const active = groupSubTab === t;
                return (
                  <TouchableOpacity
                    key={t}
                    activeOpacity={0.8}
                    onPress={() => setGroupSubTab(t)}
                    style={[styles.innerTab, active && styles.innerTabActive]}
                  >
                    <Text style={[styles.innerTabText, active && styles.innerTabTextActive]}>
                      {t === 'fixtures' ? 'FIXTURES' : 'STATS'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Fixtures sub-tab */}
            {groupSubTab === 'fixtures' && ([1, 2, 3] as const).map((md) => {
              const mdFixtures = groupFixtures.filter((f) => f.matchday === md);
              const mdDone = mdFixtures.filter((f) => {
                const r = liveResults[f.id];
                return r && (r.status === 'FT' || r.status === 'AET' || r.status === 'PEN');
              }).length;
              return (
                <View key={md}>
                  <View style={styles.mdHeadRow}>
                    <Text style={styles.mdHeadLabel}>MATCHDAY {md}</Text>
                    <Text style={styles.mdHeadCount}>{mdDone}/{mdFixtures.length} PLAYED</Text>
                  </View>
                  {mdFixtures.map((fixture) => (
                    <FixtureCard
                      key={fixture.id}
                      fixture={fixture}
                      liveResult={liveResults[fixture.id] ?? null}
                    />
                  ))}
                </View>
              );
            })}

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

      {/* ── MATCHDAYS VIEW ────────────────────────────────────── */}
      {viewMode === 'matchdays' && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRowWrap}
            contentContainerStyle={styles.chipRow}
          >
            {([1, 2, 3] as const).map((md) => {
              const active = activeMatchday === md;
              return (
                <TouchableOpacity
                  key={md}
                  activeOpacity={0.8}
                  onPress={() => setActiveMatchday(md)}
                  style={styles.chipShadow}
                >
                  {active ? (
                    <LinearGradient {...cardGreen} style={[styles.chipWide, styles.chipActive]}>
                      <Text style={styles.chipTextActive}>MD {md}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.chipWide}>
                      <Text style={styles.chipText}>MD {md}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, { paddingBottom: 120 + insets.bottom }]}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>MATCHDAY {activeMatchday}</Text>
            </View>
            {matchdayFixtures.map((fixture) => (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                liveResult={liveResults[fixture.id] ?? null}
                groupBadge={`Group ${fixture.group}`}
              />
            ))}
          </ScrollView>
        </>
      )}

      {/* ── KNOCKOUT VIEW ─────────────────────────────────────── */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING[8],
    paddingTop: SPACING[8],
    paddingBottom: SPACING[12],
    paddingHorizontal: SPACING[16],
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 22,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  headerLoad: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 16,
    color: COLORS.textMuted,
    marginLeft: SPACING[4],
  },

  // Sub-tabs (Groups / Knockout / Matchdays)
  subtabsWrap: {
    paddingHorizontal: SPACING[16],
    marginBottom: SPACING[16],
  },
  subtabsInner: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 4,
    gap: 2,
    ...PIXEL_SHADOW,
  },
  subtabSlot: {
    flex: 1,
    borderRadius: 7,
    overflow: 'hidden',
  },
  subtab: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 7,
  },
  subtabText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  subtabTextActive: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },

  // Chip row (A–L / MD 1-3)
  chipRowWrap: {
    maxHeight: 48,
    marginBottom: SPACING[8],
  },
  chipRow: {
    paddingHorizontal: SPACING[16],
    gap: 6,
    alignItems: 'center',
    height: 46,
  },
  chipShadow: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  chip: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
  },
  chipWide: {
    width: 54,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
  },
  chipActive: {
    borderColor: COLORS.gold,
  },
  chipText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  chipTextActive: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },

  // Content
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: SPACING[16],
    paddingBottom: SPACING[32],
  },

  // Section row
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SPACING[8],
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionMeta: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  // Standings card
  standCardShadow: {
    borderRadius: RADIUS.medium,
    marginBottom: SPACING[20],
    ...PIXEL_SHADOW,
  },
  standCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.green,
    paddingHorizontal: SPACING[12],
    paddingTop: 6,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  standHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,176,192,0.25)',
    borderStyle: 'dashed',
  },
  standHeadText: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  standHeadPts: {
    color: COLORS.textPrimary,
  },
  standRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
    position: 'relative',
  },
  standRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,176,192,0.15)',
    borderStyle: 'dashed',
  },
  standRowQual: {},
  standQualBar: {
    position: 'absolute',
    left: -10,
    top: 6,
    bottom: 6,
    width: 3,
    backgroundColor: COLORS.green,
  },
  standRank: {
    width: 16,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  standFlagWrap: {
    width: 22,
    alignItems: 'center',
  },
  standName: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  standStat: {
    width: 22,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  standPts: {
    width: 28,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 16,
    color: COLORS.gold,
    fontWeight: '800',
  },

  // Inner tabs (Fixtures / Stats)
  innerTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    padding: 2,
    marginBottom: SPACING[12],
    alignSelf: 'flex-start',
  },
  innerTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
  },
  innerTabActive: {
    backgroundColor: COLORS.surfaceElevated,
  },
  innerTabText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  innerTabTextActive: {
    color: COLORS.gold,
  },

  // Matchday header (within group)
  mdHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: SPACING[8],
    marginBottom: SPACING[8],
  },
  mdHeadLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  mdHeadCount: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },

  // Fixture card
  fxShadow: {
    borderRadius: RADIUS.medium,
    marginBottom: SPACING[8],
    ...PIXEL_SHADOW,
  },
  fxCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  fxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING[12],
    paddingVertical: SPACING[8],
  },
  fxTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
  },
  fxTeamRight: {
    justifyContent: 'flex-end',
  },
  fxTeamCode: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  fxTeamCodeRight: {
    textAlign: 'right',
  },
  fxTeamMuted: {
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  fxVs: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    paddingHorizontal: SPACING[8],
  },
  fxScoreBox: {
    alignItems: 'center',
    paddingHorizontal: SPACING[8],
  },
  fxScore: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.gold,
    fontWeight: '800',
    letterSpacing: 1,
  },
  fxScoreLabel: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginTop: 2,
    fontWeight: '700',
  },
  fxMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    paddingHorizontal: SPACING[12],
    paddingTop: 6,
    paddingBottom: SPACING[8],
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,176,192,0.15)',
    borderStyle: 'dashed',
  },
  fxMetaDate: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  fxMetaVenue: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textPrimary,
  },
  fxGroupBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.green,
    backgroundColor: 'rgba(148,201,82,0.07)',
  },
  fxGroupBadgeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: '#94C952',
    letterSpacing: 1,
    fontWeight: '700',
  },

  // Live badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.red,
  },
  liveBadgeText: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 9,
    color: COLORS.red,
    letterSpacing: 0.5,
    fontWeight: '700',
  },

  // Stats placeholder (preserved)
  statsPlaceholder: {
    alignItems: 'center',
    paddingVertical: SPACING[32],
    gap: SPACING[8],
  },
  statsPlaceholderIcon: {
    fontSize: 40,
  },
  statsPlaceholderText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  statsPlaceholderHint: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
