import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import PageHeader from '../components/PageHeader';

// ─── Section card data ────────────────────────────────────────────────────────

const SECTIONS = [
  { icon: '🏆', title: 'TOURNAMENT 26',     collected: 0, total: 64  },
  { icon: '🏟️', title: 'STADIUMS 26',        collected: 0, total: 16  },
  { icon: '📚', title: 'TOURNAMENT HISTORY', collected: 0, total: 120 },
  { icon: '🌍', title: 'TEAMS',              collected: 0, total: 48  },
] as const;

const PACK_COUNT = 3;

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon, title, collected, total,
}: { icon: string; title: string; collected: number; total: number }) {
  const pct = total > 0 ? collected / total : 0;

  return (
    <TouchableOpacity style={styles.sectionCard} activeOpacity={0.8}>
      <View style={styles.sectionCardLeft}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <View style={styles.sectionInfo}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionProgress}>{collected}/{total} collected</Text>
          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
          </View>
        </View>
      </View>
      <Text style={styles.sectionChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CollectionScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <PageHeader icon="🎴" title="COLLECTION" subtitle="World Cup 2026 Cards" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Section cards */}
        {SECTIONS.map((s) => (
          <SectionCard key={s.title} {...s} />
        ))}

        {/* Spacer */}
        <View style={{ height: SPACING.lg }} />

      </ScrollView>

      {/* Open Pack button — pinned at bottom */}
      <View style={styles.packBar}>
        <Text style={styles.packCount}>{PACK_COUNT} packs available</Text>
        <TouchableOpacity style={styles.packBtn} activeOpacity={0.85}>
          {/* Pixel pack icon — small stack of cards */}
          <View style={styles.packIconWrap}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.packIconCard,
                  { bottom: i * 2, right: i * 2, zIndex: i },
                ]}
              />
            ))}
          </View>
          <Text style={styles.packBtnText}>OPEN PACK</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bgPrimary },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.sm },

  // Header
  header: {
    marginBottom: SPACING.lg,
    marginTop: SPACING.sm,
  },
  heading: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.accent,
    letterSpacing: 3,
  },
  subheading: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Section card
  sectionCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  sectionIcon:  { fontSize: 28 },
  sectionInfo:  { flex: 1, gap: 3 },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  sectionProgress: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  progressBar: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginTop: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  sectionChevron: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: COLORS.textMuted,
    marginLeft: SPACING.sm,
  },

  // Pack bar
  packBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bgSurface,
    padding: SPACING.md,
    gap: SPACING.xs,
    alignItems: 'center',
  },
  packCount: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.primaryLight,
    letterSpacing: 0.5,
  },
  packBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
    width: '100%',
    justifyContent: 'center',
  },
  packIconWrap: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  packIconCard: {
    position: 'absolute',
    width: 14,
    height: 18,
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: `${COLORS.bgPrimary}80`,
  },
  packBtnText: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.bgPrimary,
    letterSpacing: 1,
  },
});
