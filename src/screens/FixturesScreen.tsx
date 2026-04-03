import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { GROUPS, fixturesByGroup } from '../constants/fixtures';
import { NATIONS_BY_ID, NATIONS_BY_GROUP } from '../constants/nations';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';
import { Fixture } from '../types/fixture';
import { Team } from '../types/simulator';

type Nav = BottomTabNavigationProp<BottomTabParamList>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Points table row ────────────────────────────────────────────────────────

function TeamRow({ team }: { team: Team }) {
  return (
    <View style={styles.tableRow}>
      <Text style={styles.tableFlag}>{team.flag}</Text>
      <Text style={styles.tableName} numberOfLines={1}>{team.name}</Text>
      <Text style={styles.tableStat}>0</Text>
      <Text style={styles.tableStat}>0</Text>
      <Text style={styles.tableStat}>0</Text>
      <Text style={styles.tableStat}>0</Text>
      <Text style={[styles.tableStat, styles.tableStatPts]}>0</Text>
    </View>
  );
}

// ─── Fixture card ─────────────────────────────────────────────────────────────

function FixtureCard({ fixture, onSimulate }: { fixture: Fixture; onSimulate: () => void }) {
  const home = NATIONS_BY_ID[fixture.homeTeamId];
  const away = NATIONS_BY_ID[fixture.awayTeamId];
  if (!home || !away) return null;

  return (
    <View style={styles.fixtureCard}>
      <View style={styles.fixtureTeams}>
        <View style={styles.fixtureTeam}>
          <Text style={styles.fixtureFlag}>{home.flag}</Text>
          <Text style={styles.fixtureTeamName} numberOfLines={1}>{home.name}</Text>
        </View>
        <Text style={styles.fixtureVs}>VS</Text>
        <View style={[styles.fixtureTeam, styles.fixtureTeamRight]}>
          <Text style={[styles.fixtureTeamName, styles.fixtureTeamNameRight]} numberOfLines={1}>
            {away.name}
          </Text>
          <Text style={styles.fixtureFlag}>{away.flag}</Text>
        </View>
      </View>
      <View style={styles.fixtureMeta}>
        <Text style={styles.fixtureDate}>{formatDate(fixture.date)}</Text>
        <Text style={styles.fixtureVenue} numberOfLines={1}>{fixture.venue}</Text>
        <TouchableOpacity style={styles.simulateBtn} onPress={onSimulate} activeOpacity={0.75}>
          <Text style={styles.simulateBtnText}>⚽ SIMULATE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FixturesScreen() {
  const navigation = useNavigation<Nav>();
  const [activeGroup, setActiveGroup] = useState<string>('A');

  const groupTeams = NATIONS_BY_GROUP[activeGroup] ?? [];
  const groupFixtures = fixturesByGroup(activeGroup);

  const md1 = groupFixtures.filter((f) => f.matchday === 1);
  const md2 = groupFixtures.filter((f) => f.matchday === 2);
  const md3 = groupFixtures.filter((f) => f.matchday === 3);

  function handleSimulate(homeTeamId: string, awayTeamId: string) {
    navigation.navigate('Simulator', { homeTeamId, awayTeamId });
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <Text style={styles.header}>🏟 GROUP STAGE</Text>

      {/* Group tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
        style={styles.tabBarWrap}
      >
        {GROUPS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.tab, activeGroup === g && styles.tabActive]}
            onPress={() => setActiveGroup(g)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeGroup === g && styles.tabTextActive]}>
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Points table */}
        <Text style={styles.sectionLabel}>GROUP {activeGroup}</Text>

        <View style={styles.table}>
          {/* Table header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableName, styles.tableHeaderText, { marginLeft: 28 }]}>
              Team
            </Text>
            <Text style={[styles.tableStat, styles.tableHeaderText]}>P</Text>
            <Text style={[styles.tableStat, styles.tableHeaderText]}>W</Text>
            <Text style={[styles.tableStat, styles.tableHeaderText]}>D</Text>
            <Text style={[styles.tableStat, styles.tableHeaderText]}>L</Text>
            <Text style={[styles.tableStat, styles.tableStatPts, styles.tableHeaderText]}>
              Pts
            </Text>
          </View>

          {groupTeams.map((t) => (
            <TeamRow key={t.id} team={t} />
          ))}
        </View>

        {/* Match list by matchday */}
        {[
          { label: 'Matchday 1', data: md1 },
          { label: 'Matchday 2', data: md2 },
          { label: 'Matchday 3', data: md3 },
        ].map(({ label, data }) => (
          <View key={label}>
            <Text style={styles.matchdayLabel}>{label}</Text>
            {data.map((fixture) => (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                onSimulate={() => handleSimulate(fixture.homeTeamId, fixture.awayTeamId)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
    letterSpacing: 1.5,
  },

  // ── Group tab bar ──
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
  content: {
    flex: 1,
  },
  contentInner: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    letterSpacing: 1,
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
  tableFlag: {
    fontSize: FONT_SIZE.md,
    width: 26,
  },
  tableName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  tableStat: {
    width: 28,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  tableStatPts: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },

  // ── Matchday sections ──
  matchdayLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
    textTransform: 'uppercase',
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
  fixtureTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  fixtureTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  fixtureTeamRight: {
    justifyContent: 'flex-end',
  },
  fixtureFlag: {
    fontSize: FONT_SIZE.xl,
  },
  fixtureTeamName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  fixtureTeamNameRight: {
    textAlign: 'right',
  },
  fixtureVs: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: 'bold',
    paddingHorizontal: SPACING.xs,
  },
  fixtureMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  fixtureDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
    width: 48,
  },
  fixtureVenue: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
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
});
