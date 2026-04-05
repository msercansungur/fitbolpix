import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTournamentStore } from '../store/useTournamentStore';
import { NATIONS_BY_ID } from '../constants/nations';
import { GROUP_FIXTURES } from '../constants/fixtures';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';

type HomeNavProp = BottomTabNavigationProp<BottomTabParamList, 'Home'>;

const TOURNAMENT_START = '2026-06-11';

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function daysUntil(iso: string): number {
  const now    = new Date();
  const target = new Date(iso + 'T00:00:00Z');
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { isActive, isEliminated, hasWon, selectedNationId } = useTournamentStore();

  const showBanner = isActive && !isEliminated && !hasWon && selectedNationId != null;
  const nation     = selectedNationId ? NATIONS_BY_ID[selectedNationId] : null;

  // Today's matches from local schedule (no API needed)
  const today         = new Date().toISOString().split('T')[0];
  const todayFixtures = GROUP_FIXTURES.filter((f) => f.date === today);
  const preStart      = today < TOURNAMENT_START;
  const daysLeft      = daysUntil(TOURNAMENT_START);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>⚽ FITBOLPIX</Text>
      <Text style={styles.subtitle}>World Cup 2026 Companion</Text>

      {/* Continue Journey banner */}
      {showBanner && nation && (
        <TouchableOpacity
          style={styles.banner}
          onPress={() => navigation.navigate('Tournament')}
          activeOpacity={0.8}
        >
          <Text style={styles.bannerLabel}>YOUR WORLD CUP JOURNEY</Text>
          <View style={styles.bannerRow}>
            <Text style={styles.bannerFlag}>{nation.flag}</Text>
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerNation}>{nation.name}</Text>
              <Text style={styles.bannerGroup}>Group {nation.group} · Tournament Active</Text>
            </View>
            <Text style={styles.bannerArrow}>▶</Text>
          </View>
          <Text style={styles.bannerCta}>TAP TO CONTINUE →</Text>
        </TouchableOpacity>
      )}

      {/* Today's matches section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TODAY'S MATCHES</Text>

        {preStart ? (
          <View style={styles.countdownCard}>
            <Text style={styles.countdownEmoji}>📅</Text>
            <Text style={styles.countdownTitle}>World Cup 2026 starts</Text>
            <Text style={styles.countdownDate}>June 11, 2026</Text>
            {daysLeft > 0 && (
              <Text style={styles.countdownDays}>{daysLeft} days to go</Text>
            )}
          </View>
        ) : todayFixtures.length > 0 ? (
          todayFixtures.map((fixture) => {
            const home = NATIONS_BY_ID[fixture.homeTeamId];
            const away = NATIONS_BY_ID[fixture.awayTeamId];
            if (!home || !away) return null;
            return (
              <TouchableOpacity
                key={fixture.id}
                style={styles.matchCard}
                onPress={() => navigation.navigate('Fixtures')}
                activeOpacity={0.75}
              >
                <View style={styles.matchTeams}>
                  <View style={styles.matchTeam}>
                    <Text style={styles.matchFlag}>{home.flag}</Text>
                    <Text style={styles.matchName} numberOfLines={1}>{home.name}</Text>
                  </View>
                  <Text style={styles.matchVs}>VS</Text>
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
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={styles.description}>
        Live scores · Match simulator · Tournament mode · Card collection — all in chaotic pixel art.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: COLORS.background },
  scroll:   { padding: SPACING.md, paddingBottom: SPACING.xl },
  title:    { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center', marginTop: SPACING.lg, letterSpacing: 2 },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },

  // Continue Journey banner
  banner: {
    backgroundColor: '#1a472a',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  bannerLabel:  { fontSize: 10, color: '#27ae60', fontWeight: '700', letterSpacing: 2, marginBottom: SPACING.sm },
  bannerRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  bannerFlag:   { fontSize: 36, marginRight: SPACING.md },
  bannerInfo:   { flex: 1 },
  bannerNation: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: '#fff' },
  bannerGroup:  { fontSize: FONT_SIZE.xs, color: '#86efac', marginTop: 2 },
  bannerArrow:  { fontSize: FONT_SIZE.lg, color: '#27ae60' },
  bannerCta:    { fontSize: FONT_SIZE.xs, color: '#4ade80', fontWeight: '700', letterSpacing: 1.5 },

  // Section
  section:      { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 2, marginBottom: SPACING.sm },

  // Countdown card
  countdownCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countdownEmoji: { fontSize: 32, marginBottom: SPACING.xs },
  countdownTitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  countdownDate:  { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.primary, marginTop: 4 },
  countdownDays:  { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 4 },

  // Match card
  matchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  matchTeams: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, gap: SPACING.xs },
  matchTeam:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  matchTeamRight: { justifyContent: 'flex-end' },
  matchFlag:  { fontSize: FONT_SIZE.xl },
  matchName:  { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  matchVs:    { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: 'bold', paddingHorizontal: SPACING.xs },
  matchMeta:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, gap: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.border },
  matchGroupBadge: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: 'bold', width: 56 },
  matchVenue: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  // No match
  noMatchCard: { backgroundColor: COLORS.surface, borderRadius: 8, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  noMatchText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  description: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },
});
