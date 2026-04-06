import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTournamentStore } from '../store/useTournamentStore';
import { NATIONS_BY_ID } from '../constants/nations';
import { GROUP_FIXTURES } from '../constants/fixtures';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import FitbolpixLogo from '../components/FitbolpixLogo';

type HomeNavProp = BottomTabNavigationProp<BottomTabParamList, 'Home'>;

const KICKOFF_DATE = new Date('2026-06-11T18:00:00Z'); // Opening ceremony / first match

// ─── Countdown logic ──────────────────────────────────────────────────────────

function getCountdown(now: Date) {
  const diff = Math.max(0, KICKOFF_DATE.getTime() - now.getTime());
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// ─── Countdown block ──────────────────────────────────────────────────────────

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.countBlock}>
      <Text style={styles.countNumber}>{pad(value)}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { isActive, isEliminated, hasWon, selectedNationId } = useTournamentStore();

  const showBanner  = isActive && !isEliminated && !hasWon && selectedNationId != null;
  const nation      = selectedNationId ? NATIONS_BY_ID[selectedNationId] : null;

  // Live countdown
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const countdown     = getCountdown(now);
  const tournamentStarted = now >= KICKOFF_DATE;

  // Today's matches from local schedule
  const today         = now.toISOString().split('T')[0];
  const todayFixtures = GROUP_FIXTURES.filter((f) => f.date === today);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <FitbolpixLogo size="medium" />
          <Text style={styles.subtitle}>World Cup 2026 Companion</Text>
        </View>

        {/* ── Continue Journey Banner ─────────────────────────────────────── */}
        {showBanner && nation && (
          <TouchableOpacity
            style={styles.journeyBanner}
            onPress={() => navigation.navigate('Tournament')}
            activeOpacity={0.85}
          >
            <Text style={styles.journeyBannerLabel}>YOUR WORLD CUP JOURNEY</Text>
            <View style={styles.journeyBannerRow}>
              <Text style={styles.journeyFlag}>{nation.flag}</Text>
              <View style={styles.journeyInfo}>
                <Text style={styles.journeyNation}>{nation.name}</Text>
                <Text style={styles.journeyGroup}>Group {nation.group} · Tournament Active</Text>
              </View>
              {/* Pixel chevron → */}
              <View style={styles.journeyChevron}>
                {[0,2,4,2,0].map((l, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    {[...Array(l)].map((_, j) => (
                      <View key={j} style={styles.chevronPx} />
                    ))}
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.journeyCta}>TAP TO CONTINUE →</Text>
          </TouchableOpacity>
        )}

        {/* ── Countdown Card ──────────────────────────────────────────────── */}
        {!tournamentStarted && (
          <View style={styles.countdownCard}>
            <Text style={styles.countdownHeading}>COUNTDOWN TO KICKOFF</Text>
            <View style={styles.countdownRow}>
              <CountdownBlock value={countdown.days}    label="DAYS" />
              <Text style={styles.countdownSep}>:</Text>
              <CountdownBlock value={countdown.hours}   label="HRS" />
              <Text style={styles.countdownSep}>:</Text>
              <CountdownBlock value={countdown.minutes} label="MIN" />
              <Text style={styles.countdownSep}>:</Text>
              <CountdownBlock value={countdown.seconds} label="SEC" />
            </View>
            <Text style={styles.countdownDate}>June 11, 2026 · Opening Match</Text>
          </View>
        )}

        {/* ── Today's Matches ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TODAY'S MATCHES</Text>

          {todayFixtures.length > 0 ? (
            todayFixtures.map((fixture) => {
              const home = NATIONS_BY_ID[fixture.homeTeamId];
              const away = NATIONS_BY_ID[fixture.awayTeamId];
              if (!home || !away) return null;
              return (
                <TouchableOpacity
                  key={fixture.id}
                  style={styles.matchCard}
                  onPress={() => navigation.navigate('Fixtures')}
                  activeOpacity={0.8}
                >
                  <View style={styles.matchTeams}>
                    <View style={styles.matchTeam}>
                      <Text style={styles.matchFlag}>{home.flag}</Text>
                      <Text style={styles.matchName} numberOfLines={1}>{home.name}</Text>
                    </View>

                    {/* Pixel football separator */}
                    <View style={styles.matchVsSpacer}>
                      <View style={styles.miniball}>
                        {[[0,1,0],[1,1,1],[0,1,0]].map((row, r) => (
                          <View key={r} style={{ flexDirection: 'row' }}>
                            {row.map((cell, c) => (
                              <View key={c} style={[styles.miniballPx, { backgroundColor: cell ? COLORS.textMuted : 'transparent' }]} />
                            ))}
                          </View>
                        ))}
                      </View>
                    </View>

                    <View style={[styles.matchTeam, styles.matchTeamRight]}>
                      <Text style={styles.matchName} numberOfLines={1}>{away.name}</Text>
                      <Text style={styles.matchFlag}>{away.flag}</Text>
                    </View>
                  </View>
                  <View style={styles.matchMeta}>
                    <Text style={styles.matchGroupBadge}>Group {fixture.group}</Text>
                    <Text style={styles.matchVenue} numberOfLines={1}>{fixture.venue}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.noMatchCard}>
              <Text style={styles.noMatchText}>No matches scheduled today</Text>
              {!tournamentStarted && (
                <Text style={styles.noMatchHint}>The tournament begins June 11, 2026</Text>
              )}
            </View>
          )}
        </View>

        {/* ── Description ─────────────────────────────────────────────────── */}
        <Text style={styles.description}>
          Live scores · Match simulator · Tournament mode · Card collection
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bgPrimary },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },

  // Header
  header: {
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },

  // Journey banner
  journeyBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  journeyBannerLabel: {
    fontFamily: FONTS.headingMedium,
    fontSize: 10,
    color: COLORS.primaryLight,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  journeyBannerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  journeyFlag:       { fontSize: 36, marginRight: SPACING.md },
  journeyInfo:       { flex: 1 },
  journeyNation: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  journeyGroup: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.primaryLight,
    marginTop: 2,
  },
  journeyChevron:  { paddingLeft: SPACING.sm },
  chevronPx:       { width: 2, height: 2, backgroundColor: COLORS.primaryLight, margin: 0.5 },
  journeyCta: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 1.5,
  },

  // Countdown
  countdownCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  countdownHeading: {
    fontFamily: FONTS.headingMedium,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginBottom: SPACING.md,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  countBlock: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 60,
  },
  countNumber: {
    fontFamily: FONTS.heading,
    fontSize: 36,
    color: COLORS.accent,
    letterSpacing: 1,
  },
  countLabel: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    letterSpacing: 1,
  },
  countdownSep: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.textMuted,
    marginBottom: 14, // align with numbers (offset from label)
  },
  countdownDate: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },

  // Section
  section:      { marginBottom: SPACING.lg },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },

  // Match card
  matchCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  matchTeam:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  matchTeamRight: { justifyContent: 'flex-end' },
  matchFlag:      { fontSize: 22 },
  matchName: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  matchVsSpacer: { paddingHorizontal: SPACING.sm, alignItems: 'center' },
  miniball:      { gap: 0 },
  miniballPx:    { width: 3, height: 3 },
  matchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  matchGroupBadge: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.accent,
    width: 56,
  },
  matchVenue: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // No match
  noMatchCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  noMatchText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  noMatchHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Footer
  description: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
