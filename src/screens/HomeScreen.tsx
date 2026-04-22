import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTournamentStore } from '../store/useTournamentStore';
import { NATIONS_BY_ID } from '../constants/nations';
import { GROUP_FIXTURES } from '../constants/fixtures';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { RootStackParamList } from '../navigation/RootNavigator';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, PIXEL_SHADOW } from '../theme';
import { cardGreen, cardTeal, cardRed, cardGold } from '../theme/gradients';
import FitbolpixLogo from '../components/FitbolpixLogo';
import { DID_YOU_KNOW } from '../constants/didYouKnow';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const KICKOFF_DATE = new Date('2026-06-11T18:00:00Z');

// ─── Countdown logic ──────────────────────────────────────────────────────────
function getCountdown(now: Date) {
  const diff = Math.max(0, KICKOFF_DATE.getTime() - now.getTime());
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}
function pad(n: number) { return String(n).padStart(2, '0'); }

// ─── Pixel glyph (6×6 grid) ───────────────────────────────────────────────────
type GlyphKind = 'ball' | 'clock' | 'bolt' | 'brain' | 'trophy' | 'card';
const GLYPHS: Record<GlyphKind, string[]> = {
  ball:   ['011110','110011','101101','101101','110011','011110'],
  clock:  ['011110','101101','101001','101111','101001','011110'],
  bolt:   ['000110','001100','011100','111100','001100','011000'],
  brain:  ['011110','111111','110111','111111','011110','001100'],
  trophy: ['111111','011110','011110','001100','011110','111111'],
  card:   ['111110','100010','101010','100010','101010','111110'],
};
function PixelGlyph({ kind, color, px = 2 }: { kind: GlyphKind; color: string; px?: number }) {
  const g = GLYPHS[kind];
  return (
    <View style={{ width: px * 6, height: px * 6 }}>
      {g.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, ci) => (
            <View key={ci} style={{ width: px, height: px, backgroundColor: c === '1' ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Pixel chevron (right-pointing pyramid) ───────────────────────────────────
function PixelChevron({ color, size = 2 }: { color: string; size?: number }) {
  const rows = [1, 2, 3, 2, 1];
  return (
    <View style={{ alignItems: 'flex-end' }}>
      {rows.map((n, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {Array.from({ length: n }).map((_, j) => (
            <View key={j} style={{ width: size, height: size, backgroundColor: color, marginRight: 0.5, marginTop: 0.5 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Section header with dashed divider ───────────────────────────────────────
function SectionHeader({ glyph, title, right }: { glyph: GlyphKind; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <PixelGlyph kind={glyph} color={COLORS.gold} />
      <Text style={styles.sectionHeaderText}>{title}</Text>
      <View style={styles.sectionHeaderDivider} />
      {right}
    </View>
  );
}

// ─── Countdown digit block ────────────────────────────────────────────────────
function DigitBlock({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.digitWrap}>
      <View style={styles.digitTile}>
        <Text style={styles.digitText}>{pad(n)}</Text>
      </View>
      <Text style={styles.digitLabel}>{label}</Text>
    </View>
  );
}

// ─── Quick launch tile ────────────────────────────────────────────────────────
function QuickLaunchTile({
  gradient, glyph, accent, title, subtitle, onPress,
}: {
  gradient: { colors: readonly [string, string]; start: { x: number; y: number }; end: { x: number; y: number } };
  glyph: GlyphKind;
  accent: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tileWrap} activeOpacity={0.8} onPress={onPress}>
      <LinearGradient {...gradient} style={styles.tile}>
        <View style={styles.tileHeader}>
          <PixelGlyph kind={glyph} color={accent} px={2} />
          <Text style={styles.tileTitle}>{title}</Text>
        </View>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
        <View style={styles.tileChevron}>
          <PixelChevron color={accent} size={2} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const insets = useSafeAreaInsets();
  const { isActive, isEliminated, hasWon, selectedNationId } = useTournamentStore();

  const showBanner = isActive && !isEliminated && !hasWon && selectedNationId != null;
  const nation     = selectedNationId ? NATIONS_BY_ID[selectedNationId] : null;

  // Did You Know
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * DID_YOU_KNOW.length));

  // Live countdown
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const countdown         = getCountdown(now);
  const tournamentStarted = now >= KICKOFF_DATE;

  // Today's fixtures
  const today         = now.toISOString().split('T')[0];
  const todayFixtures = GROUP_FIXTURES.filter((f) => f.date === today);
  const matchdayLabel = todayFixtures[0]?.matchday ?? 1;

  // Derive user's next opponent (for campaign banner)
  const userGroupFixtures = nation
    ? GROUP_FIXTURES.filter(
        (f) => f.group === nation.group && (f.homeTeamId === nation.id || f.awayTeamId === nation.id),
      )
    : [];
  const nextMatch = userGroupFixtures[0];
  const nextOpponent = nextMatch
    ? nextMatch.homeTeamId === selectedNationId
      ? NATIONS_BY_ID[nextMatch.awayTeamId]
      : NATIONS_BY_ID[nextMatch.homeTeamId]
    : null;

  // Dot indicator for facts (max 5 visible, proportional)
  const totalDots    = Math.min(5, DID_YOU_KNOW.length);
  const activeDotIdx = Math.floor((factIndex / DID_YOU_KNOW.length) * totalDots);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>

        {/* ── Header ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <FitbolpixLogo size="large" />
            <Text style={styles.headerSub}>World Football Championship 2026</Text>
            <Text style={styles.headerSub}>Track · Simulate · Play · Collect</Text>
          </View>
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={() => navigation.navigate('About')}
            activeOpacity={0.7}
          >
            <Text style={styles.gearIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* ── KICK-OFF IN card ─────────────────────────────────── */}
        {!tournamentStarted && (
          <View style={styles.cardShadow}>
            <LinearGradient {...cardGreen} style={styles.kickoffCard}>
              <View style={styles.kickoffTopRow}>
                <View style={styles.kickoffLabelRow}>
                  <PixelGlyph kind="clock" color={COLORS.gold} />
                  <Text style={styles.kickoffLabel}>KICK-OFF IN</Text>
                </View>
                <Text style={styles.kickoffDate}>11 · JUN · 2026</Text>
              </View>
              <View style={styles.digitsRow}>
                <DigitBlock n={countdown.days}    label="DAYS" />
                <View style={styles.colon}>
                  <View style={styles.colonDot} />
                  <View style={styles.colonDot} />
                </View>
                <DigitBlock n={countdown.hours}   label="HRS" />
                <View style={styles.colon}>
                  <View style={styles.colonDot} />
                  <View style={styles.colonDot} />
                </View>
                <DigitBlock n={countdown.minutes} label="MIN" />
                <View style={styles.colon}>
                  <View style={styles.colonDot} />
                  <View style={styles.colonDot} />
                </View>
                <DigitBlock n={countdown.seconds} label="SEC" />
              </View>
              <View style={styles.kickoffFooter}>
                <View style={styles.greenDot} />
                <Text style={styles.kickoffFooterText}>
                  Opening Match · <Text style={styles.kickoffFooterBright}>Mexico vs South Africa</Text>
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ── YOUR CAMPAIGN banner ─────────────────────────────── */}
        {showBanner && nation && (
          <TouchableOpacity
            style={styles.cardShadow}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Tournament')}
          >
            <LinearGradient {...cardGreen} style={styles.campaignCard}>
              <View style={styles.campaignFlagTile}>
                <Text style={styles.campaignFlag}>{nation.flag}</Text>
              </View>
              <View style={styles.campaignInfo}>
                <Text style={styles.campaignLabel}>YOUR CAMPAIGN</Text>
                <Text style={styles.campaignTitle}>
                  {nation.name.toUpperCase()} · GROUP {nation.group}
                </Text>
                {nextOpponent && (
                  <Text style={styles.campaignNext}>
                    Next: <Text style={styles.campaignNextBright}>vs {nextOpponent.name}</Text>
                    {nextMatch ? ` · Matchday ${nextMatch.matchday}` : ''}
                  </Text>
                )}
              </View>
              <PixelChevron color={COLORS.gold} size={3} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── QUICK LAUNCH ─────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader glyph="bolt" title="QUICK LAUNCH" />
          <View style={styles.tileGrid}>
            <QuickLaunchTile
              gradient={cardGreen}
              glyph="ball"
              accent={COLORS.green}
              title="SIMULATE"
              subtitle="Pick a match"
              onPress={() => navigation.navigate('Simulator')}
            />
            <QuickLaunchTile
              gradient={cardTeal}
              glyph="bolt"
              accent={COLORS.teal}
              title="PENALTIES"
              subtitle="Best of 5"
              onPress={() => navigation.navigate('Penalty')}
            />
            <QuickLaunchTile
              gradient={cardRed}
              glyph="trophy"
              accent={COLORS.red}
              title="ROAD TO GLORY"
              subtitle="Sim the tournament"
              onPress={() => navigation.navigate('Tournament')}
            />
            <QuickLaunchTile
              gradient={cardGold}
              glyph="card"
              accent={COLORS.gold}
              title="COLLECTION"
              subtitle="Open a pack"
              onPress={() => navigation.navigate('Collection')}
            />
          </View>
        </View>

        {/* ── TODAY · MATCHDAY ────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            glyph="ball"
            title={`TODAY · MATCHDAY ${matchdayLabel}`}
            right={
              <TouchableOpacity onPress={() => navigation.navigate('Fixtures')} activeOpacity={0.7}>
                <Text style={styles.allLink}>ALL ›</Text>
              </TouchableOpacity>
            }
          />

          {todayFixtures.length > 0 ? (
            todayFixtures.map((fixture) => {
              const home = NATIONS_BY_ID[fixture.homeTeamId];
              const away = NATIONS_BY_ID[fixture.awayTeamId];
              if (!home || !away) return null;
              // Time from fixture date/venue — use local time (UTC label shown)
              const d         = new Date(fixture.date + 'T18:00:00Z');
              const timeLabel = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

              return (
                <TouchableOpacity
                  key={fixture.id}
                  style={[styles.cardShadow, styles.matchCardSpacing]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Fixtures')}
                >
                  <View style={styles.matchCard}>
                    <View style={styles.matchTimeCol}>
                      <Text style={styles.matchTimeText}>{timeLabel}</Text>
                      <Text style={styles.matchTimeUtc}>UTC</Text>
                    </View>
                    <View style={styles.matchBody}>
                      <View style={styles.matchTeamRow}>
                        <Text style={styles.matchFlag}>{home.flag}</Text>
                        <Text style={styles.matchTeamName} numberOfLines={1}>{home.name.toUpperCase()}</Text>
                        <Text style={styles.matchScoreDash}>–</Text>
                      </View>
                      <View style={styles.matchTeamRow}>
                        <Text style={styles.matchFlag}>{away.flag}</Text>
                        <Text style={styles.matchTeamName} numberOfLines={1}>{away.name.toUpperCase()}</Text>
                        <Text style={styles.matchScoreDash}>–</Text>
                      </View>
                      <View style={styles.matchMetaDivider} />
                      <View style={styles.matchMetaRow}>
                        <View style={styles.grpBadge}>
                          <Text style={styles.grpBadgeText}>GRP {fixture.group}</Text>
                        </View>
                        <Text style={styles.matchVenueText} numberOfLines={1}>{fixture.venue}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.cardShadow}>
              <View style={styles.noMatchCard}>
                <Text style={styles.noMatchText}>No matches scheduled today</Text>
                {!tournamentStarted && (
                  <Text style={styles.noMatchHint}>The tournament begins June 11, 2026</Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── DID YOU KNOW ─────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader glyph="brain" title="DID YOU KNOW?" />
          <View style={styles.cardShadow}>
            <LinearGradient {...cardTeal} style={styles.factCard}>
              <Text style={styles.factText}>{DID_YOU_KNOW[factIndex]}</Text>
              <View style={styles.factFooter}>
                <View style={styles.factDotRow}>
                  {Array.from({ length: totalDots }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.factDot,
                        { backgroundColor: i === activeDotIdx ? COLORS.gold : COLORS.border },
                      ]}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setFactIndex((i) => (i + 1) % DID_YOU_KNOW.length)}
                  style={styles.nextFactBtn}
                >
                  <Text style={styles.nextFactText}>NEXT FACT</Text>
                  <PixelGlyph kind="bolt" color={COLORS.teal} px={2} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING[16], paddingBottom: SPACING[32] },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING[4],
    marginBottom: SPACING[16],
    position: 'relative',
  },
  headerLeft: {
    alignItems: 'center',
    gap: SPACING[4],
  },
  headerSub: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  gearBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 34,
    height: 34,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
    ...PIXEL_SHADOW,
  },
  gearIcon: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },

  // Card shadow wrapper (applies pixel shadow to gradient cards)
  cardShadow: {
    marginBottom: SPACING[16],
    borderRadius: RADIUS.medium,
    ...PIXEL_SHADOW,
  },

  // Section
  section: { marginBottom: SPACING[4] },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    marginBottom: SPACING[12],
    paddingHorizontal: SPACING[4],
  },
  sectionHeaderText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionHeaderDivider: {
    flex: 1,
    height: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
    marginLeft: 4,
  },
  allLink: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.teal,
    letterSpacing: 2,
  },

  // KICK-OFF IN
  kickoffCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING[16],
    overflow: 'hidden',
  },
  kickoffTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING[12],
  },
  kickoffLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
  },
  kickoffLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.gold,
    letterSpacing: 2.5,
  },
  kickoffDate: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colon: {
    gap: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  colonDot: {
    width: 3,
    height: 3,
    backgroundColor: COLORS.gold,
  },
  digitWrap: {
    alignItems: 'center',
    flex: 1,
  },
  digitTile: {
    backgroundColor: '#050B0F',
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
    width: '100%',
    alignItems: 'center',
  },
  digitText: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 32,
    color: COLORS.gold,
    letterSpacing: 1,
    lineHeight: 34,
  },
  digitLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginTop: 5,
  },
  kickoffFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING[12],
  },
  greenDot: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.green,
  },
  kickoffFooterText: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  kickoffFooterBright: {
    color: COLORS.textPrimary,
  },

  // Campaign banner
  campaignCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.green,
    padding: SPACING[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[12],
    overflow: 'hidden',
  },
  campaignFlagTile: {
    width: 44,
    height: 44,
    backgroundColor: '#060B10',
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campaignFlag: {
    fontSize: 24,
  },
  campaignInfo: {
    flex: 1,
  },
  campaignLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  campaignTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    marginTop: 2,
  },
  campaignNext: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  campaignNextBright: {
    color: COLORS.textPrimary,
  },

  // Quick Launch tiles
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING[12],
  },
  tileWrap: {
    flex: 1,
    minWidth: '47%',
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  tile: {
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING[12],
    minHeight: 82,
    overflow: 'hidden',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    marginBottom: 4,
  },
  tileTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  tileSubtitle: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  tileChevron: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },

  // Match card
  matchCardSpacing: {
    marginBottom: SPACING[8],
  },
  matchCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  matchTimeCol: {
    width: 68,
    paddingVertical: SPACING[12],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  matchTimeText: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 20,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  matchTimeUtc: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  matchBody: {
    flex: 1,
    paddingVertical: SPACING[12],
    paddingHorizontal: SPACING[12],
    gap: 6,
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
  },
  matchFlag: {
    fontSize: 16,
    width: 22,
  },
  matchTeamName: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  matchScoreDash: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 20,
    color: COLORS.textMuted,
    minWidth: 18,
    textAlign: 'right',
    lineHeight: 22,
  },
  matchMetaDivider: {
    marginTop: 2,
    height: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
  },
  matchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    paddingTop: 4,
  },
  grpBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
  },
  grpBadgeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.background,
    letterSpacing: 1.5,
  },
  matchVenueText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // No match
  noMatchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING[16],
    alignItems: 'center',
    gap: SPACING[4],
  },
  noMatchText: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  noMatchHint: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Did You Know
  factCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING[16],
    overflow: 'hidden',
  },
  factText: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  factFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING[12],
  },
  factDotRow: {
    flexDirection: 'row',
    gap: 3,
  },
  factDot: {
    width: 6,
    height: 6,
  },
  nextFactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextFactText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.teal,
    letterSpacing: 2,
  },
});
