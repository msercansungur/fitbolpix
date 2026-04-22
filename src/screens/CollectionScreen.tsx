import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, PIXEL_SHADOW } from '../theme';
import {
  cardTeal,
  cardGreen,
  cardGold,
  cardPurple,
} from '../theme/gradients';

// ═════════════════════════════════════════════════════════════════════════════
// One-line launch switch — flip to true when v1.1 ships.
// ═════════════════════════════════════════════════════════════════════════════
const COLLECTION_UNLOCKED = false;

// ─── Pixel glyph (6×6) ────────────────────────────────────────────────────────
type GlyphKind =
  | 'card' | 'lock' | 'bell' | 'trophy' | 'stadium'
  | 'book' | 'globe' | 'pack' | 'sparkle' | 'chevRight';

const GLYPHS: Record<GlyphKind, string[]> = {
  card:      ['111110','100010','101010','100010','101010','111110'],
  lock:      ['011110','110011','110011','111111','110011','111111'],
  bell:      ['001100','011110','011110','111111','111111','001100'],
  trophy:    ['111111','011110','011110','001100','011110','111111'],
  stadium:   ['000000','011110','111111','100001','111111','011110'],
  book:      ['111110','100010','100010','100010','100010','111110'],
  globe:     ['011110','110011','101101','111111','101101','011110'],
  pack:      ['111111','100001','101101','100001','101101','111111'],
  sparkle:   ['001100','011110','111111','111111','011110','001100'],
  chevRight: ['100000','110000','011000','011000','110000','100000'],
};

function PixelGlyph({ kind, color, px = 2 }: { kind: GlyphKind; color: string; px?: number }) {
  return (
    <View style={{ width: px * 6, height: px * 6 }}>
      {GLYPHS[kind].map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, ci) => (
            <View
              key={ci}
              style={{ width: px, height: px, backgroundColor: c === '1' ? color : 'transparent' }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Pixel card illustration (14w × 18h) ──────────────────────────────────────
// g = gold frame, T = teal face, W = white name band, S = dark silhouette,
// X = deep-blue top band
const CARD_ART: string[] = [
  'gggggggggggggg',
  'gXXXXXXXXXXXXg',
  'gXXXXXXXXXXXXg',
  'gTTTTTSSTTTTTg',
  'gTTTTSSSSTTTTg',
  'gTTTSSSSSSTTTg',
  'gTTSSSSSSSSTTg',
  'gTTTTSSSSTTTTg',
  'gTTTSSSSSSTTTg',
  'gTSSSSSSSSSSTg',
  'gSSSSSSSSSSSSg',
  'gTTTTTTTTTTTTg',
  'gTTTTTTTTTTTTg',
  'gWWWWWWWWWWWWg',
  'gWXXWXXWXXWXWg',
  'gWWWWWWWWWWWWg',
  'gTTTTTTTTTTTTg',
  'gggggggggggggg',
];
const CARD_ART_COLORS: Record<string, string> = {
  g: COLORS.gold,
  X: '#102030',
  T: '#28ADCF',
  W: '#F0F4F7',
  S: '#0B171F',
};

function PixelCard({ px = 4 }: { px?: number }) {
  return (
    <View style={{ width: px * 14, height: px * 18 }}>
      {CARD_ART.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, ci) => (
            <View
              key={ci}
              style={{
                width: px,
                height: px,
                backgroundColor: CARD_ART_COLORS[c] ?? 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Shared section header ────────────────────────────────────────────────────
function SectionHeader({
  icon, title, color = COLORS.gold, right,
}: {
  icon: GlyphKind;
  title: string;
  color?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <PixelGlyph kind={icon} color={color} px={2} />
      <Text style={[styles.sectionHeaderTitle, { color }]}>{title}</Text>
      <View style={styles.sectionHeaderRule} />
      {right}
    </View>
  );
}

// ─── Header bar ───────────────────────────────────────────────────────────────
function HeaderBar() {
  return (
    <View style={styles.header}>
      <LinearGradient
        colors={[COLORS.gold, '#B98F1A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerIconTile}
      >
        <PixelGlyph kind="card" color={COLORS.background} px={3} />
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle}>COLLECTION</Text>
        <Text style={styles.headerSub}>FiTBOLPiX GALLERY</Text>
      </View>
    </View>
  );
}

// ─── Teaser lock card (silhouette) ────────────────────────────────────────────
function TeaserLockCard({
  rotate, tint,
}: {
  rotate: number;
  tint: [string, string];
}) {
  return (
    <View style={[styles.teaserCardWrap, { transform: [{ rotate: `${rotate}deg` }] }]}>
      <LinearGradient
        colors={tint}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.teaserCard}
      >
        {/* silhouette head-and-shoulders */}
        <View style={styles.teaserSilhouetteHead} />
        <View style={styles.teaserSilhouetteBody} />
        {/* lock badge */}
        <View style={styles.teaserLockBadge}>
          <PixelGlyph kind="lock" color={COLORS.gold} px={1.5} />
        </View>
        {/* foot stripe */}
        <View style={styles.teaserFoot} />
      </LinearGradient>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STATE 1 — Coming Soon
// ═════════════════════════════════════════════════════════════════════════════
function ComingSoonState() {
  return (
    <View>
      {/* Hero card */}
      <View style={styles.heroShadow}>
        <LinearGradient {...cardTeal} style={styles.heroCard}>
          <View style={styles.heroDashedBorder} pointerEvents="none" />
          <View style={styles.heroArtWrap}>
            <PixelCard px={4} />
          </View>
          <Text style={styles.heroTitle}>CARD COLLECTION</Text>
          <Text style={styles.heroSub}>
            Collect nations, stadiums, legends and more.
          </Text>
          <View style={styles.heroBadge}>
            <PixelGlyph kind="bell" color={COLORS.gold} px={2} />
            <Text style={styles.heroBadgeText}>COMING SOON · v1.1</Text>
          </View>
        </LinearGradient>
      </View>

      {/* WHAT'S INSIDE */}
      <View style={{ marginTop: SPACING[16] }}>
        <SectionHeader icon="lock" title="WHAT'S INSIDE" />
        <View style={styles.teaserOuterShadow}>
          <View style={styles.teaserOuterCard}>
            <View style={styles.teaserRow}>
              <TeaserLockCard rotate={-8} tint={['#1A2E3A', '#0C1A24']} />
              <TeaserLockCard rotate={-4} tint={['#1F2D22', '#0E1A12']} />
              <TeaserLockCard rotate={0}  tint={['#2A2012', '#140C06']} />
              <TeaserLockCard rotate={4}  tint={['#261233', '#100718']} />
              <TeaserLockCard rotate={8}  tint={['#1A2E3A', '#0C1A24']} />
            </View>
            <View style={styles.teaserCategoriesGrid}>
              <View style={styles.teaserCategoryCell}>
                <PixelGlyph kind="trophy" color={COLORS.gold} px={2} />
                <Text style={styles.teaserCategoryText}>LEGENDS</Text>
              </View>
              <View style={styles.teaserCategoryCell}>
                <PixelGlyph kind="stadium" color={COLORS.teal} px={2} />
                <Text style={styles.teaserCategoryText}>STADIUMS</Text>
              </View>
              <View style={styles.teaserCategoryCell}>
                <PixelGlyph kind="globe" color="#94C952" px={2} />
                <Text style={styles.teaserCategoryText}>NATIONS</Text>
              </View>
              <View style={styles.teaserCategoryCell}>
                <PixelGlyph kind="book" color={COLORS.red} px={2} />
                <Text style={styles.teaserCategoryText}>HISTORY</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {([
          ['248',  'CARDS'],
          ['4',    'TYPES'],
          ['v1.1', 'DROPS'],
        ] as const).map(([num, lbl]) => (
          <View key={lbl} style={styles.statCell}>
            <Text style={styles.statNum}>{num}</Text>
            <Text style={styles.statLbl}>{lbl}</Text>
          </View>
        ))}
      </View>

      {/* NOTIFY ME */}
      <View style={styles.notifyShadow}>
        <LinearGradient {...cardGreen} style={styles.notifyCard}>
          <LinearGradient
            colors={[COLORS.teal, '#166B82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.notifyIconTile}
          >
            <PixelGlyph kind="bell" color={COLORS.textPrimary} px={3} />
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.notifyTitle}>NOTIFY ME ON LAUNCH</Text>
            <Text style={styles.notifySub}>We'll ping you the moment packs drop.</Text>
          </View>
          <View style={styles.notifyTapBadge}>
            <Text style={styles.notifyTapText}>TAP</Text>
          </View>
        </LinearGradient>
      </View>

      <Text style={styles.shinyHint}>◆ SHINY NEW THINGS INCOMING ◆</Text>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STATE 2 — Full Collection
// ═════════════════════════════════════════════════════════════════════════════
type CategoryDef = {
  id: string;
  glyph: GlyphKind;
  label: string;
  sub: string;
  have: number;
  total: number;
  gradient: typeof cardTeal;
  accent: string;
  border: string;
};

const CATEGORIES: CategoryDef[] = [
  {
    id: 'tournament', glyph: 'trophy', label: 'TOURNAMENT 26',
    sub: 'All 64 matches of WC 2026',
    have: 0, total: 64,
    gradient: cardGold, accent: COLORS.gold, border: '#B98F1A',
  },
  {
    id: 'stadiums', glyph: 'stadium', label: 'STADIUMS 26',
    sub: '16 host venues · USA·CAN·MEX',
    have: 0, total: 16,
    gradient: cardTeal, accent: COLORS.teal, border: '#1E5A72',
  },
  {
    id: 'history', glyph: 'book', label: 'TOURNAMENT HISTORY',
    sub: 'Every finalist since 1930',
    have: 0, total: 120,
    gradient: cardPurple, accent: '#D66AA0', border: '#4A2740',
  },
  {
    id: 'nations', glyph: 'globe', label: 'NATIONS',
    sub: '48 qualified teams',
    have: 0, total: 48,
    gradient: cardGreen, accent: '#94C952', border: '#12563A',
  },
];

function CategoryCard({ c }: { c: CategoryDef }) {
  const pct = c.total > 0 ? Math.round((c.have / c.total) * 100) : 0;
  const fillPct = Math.max(pct, 1.5);
  return (
    <View style={styles.catShadow}>
      <LinearGradient {...c.gradient} style={[styles.catCard, { borderColor: c.border }]}>
        <View style={styles.catRow}>
          <View style={styles.catIconTile}>
            <PixelGlyph kind={c.glyph} color={c.accent} px={3} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.catLabel} numberOfLines={1}>{c.label}</Text>
            <Text style={styles.catSub} numberOfLines={1}>{c.sub}</Text>
          </View>
          <PixelGlyph kind="chevRight" color={c.accent} px={2} />
        </View>
        <View style={styles.catProgressRow}>
          <View style={styles.catProgressTrack}>
            <View
              style={[
                styles.catProgressFill,
                { width: `${fillPct}%` as any, backgroundColor: c.accent },
              ]}
            />
          </View>
          <Text style={[styles.catProgressCount, { color: c.accent }]}>
            {c.have}
            <Text style={{ color: COLORS.textMuted }}>/{c.total}</Text>
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

function FullCollectionState() {
  const totalHave = CATEGORIES.reduce((a, c) => a + c.have, 0);
  const totalAll  = CATEGORIES.reduce((a, c) => a + c.total, 0);
  const pct = totalAll > 0 ? Math.round((totalHave / totalAll) * 100) : 0;
  const fillPct = Math.max(pct, 1.5);

  return (
    <View>
      {/* Overall progress */}
      <View style={styles.overallShadow}>
        <LinearGradient {...cardTeal} style={styles.overallCard}>
          <View style={styles.overallHeadRow}>
            <View style={styles.overallHeadLeft}>
              <PixelGlyph kind="sparkle" color={COLORS.gold} px={2} />
              <Text style={styles.overallLabel}>OVERALL PROGRESS</Text>
            </View>
            <Text style={styles.overallCount}>
              {totalHave}
              <Text style={{ color: COLORS.textMuted }}>/{totalAll}</Text>
            </Text>
          </View>
          <View style={styles.overallTrack}>
            <View style={[styles.overallFill, { width: `${fillPct}%` as any }]} />
          </View>
          <View style={styles.overallFootRow}>
            <Text style={styles.overallFootLeft}>{pct}% complete</Text>
            <Text style={styles.overallFootRight}>Next drop: v1.1</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Categories */}
      <View style={{ marginTop: SPACING[16] }}>
        <SectionHeader icon="card" title="CATEGORIES" />
        <View style={{ gap: 10 }}>
          {CATEGORIES.map((c) => <CategoryCard key={c.id} c={c} />)}
        </View>
      </View>

      {/* Packs available divider */}
      <View style={styles.packsDividerRow}>
        <View style={styles.packsDivider} />
        <View style={styles.packsLabelWrap}>
          <View style={styles.packsLabelDot} />
          <Text style={styles.packsLabelText}>3 PACKS AVAILABLE</Text>
        </View>
        <View style={styles.packsDivider} />
      </View>

      {/* Open Pack CTA */}
      <TouchableOpacity activeOpacity={0.85} style={styles.openPackWrap}>
        <LinearGradient
          colors={[COLORS.gold, '#B98F1A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.openPackBtn}
        >
          <PixelGlyph kind="pack" color={COLORS.background} px={3} />
          <Text style={styles.openPackText}>OPEN PACK</Text>
          <PixelGlyph kind="sparkle" color={COLORS.background} px={3} />
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.openPackHint}>
        Earn packs by simulating matches & daily streaks
      </Text>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Screen
// ═════════════════════════════════════════════════════════════════════════════
export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <HeaderBar />
        {COLLECTION_UNLOCKED ? <FullCollectionState /> : <ComingSoonState />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: {
    paddingHorizontal: SPACING[16],
    paddingTop: SPACING[12],
    paddingBottom: SPACING[32],
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SPACING[16],
  },
  headerIconTile: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#B98F1A',
    alignItems: 'center',
    justifyContent: 'center',
    ...PIXEL_SHADOW,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
    lineHeight: 24,
    fontWeight: '800',
  },
  headerSub: {
    marginTop: 4,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    letterSpacing: 2.5,
    fontWeight: '800',
  },
  sectionHeaderRule: {
    flex: 1,
    height: 2,
    marginLeft: 4,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    borderStyle: 'dashed',
  },

  // ── State 1 — Hero card ───────────────────────────────────────────────────
  heroShadow: {
    borderRadius: RADIUS.medium,
    ...PIXEL_SHADOW,
  },
  heroCard: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: '#1E5A72',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroDashedBorder: {
    position: 'absolute',
    top: 8, left: 8, right: 8, bottom: 8,
    borderRadius: RADIUS.small,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(40,173,207,0.35)',
  },
  heroArtWrap: {
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 26,
    color: COLORS.gold,
    letterSpacing: 2,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSub: {
    marginTop: 8,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  heroBadge: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(250,206,67,0.1)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  heroBadgeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.gold,
    letterSpacing: 2.5,
    fontWeight: '800',
  },

  // ── State 1 — Teaser ──────────────────────────────────────────────────────
  teaserOuterShadow: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  teaserOuterCard: {
    padding: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
  },
  teaserRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  teaserCardWrap: {
    width: 54,
    height: 78,
  },
  teaserCard: {
    width: 54,
    height: 78,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
    overflow: 'hidden',
    ...PIXEL_SHADOW,
  },
  teaserSilhouetteHead: {
    position: 'absolute',
    left: '50%',
    top: 22,
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: 'rgba(11,23,31,0.6)',
  },
  teaserSilhouetteBody: {
    position: 'absolute',
    left: '50%',
    top: 38,
    width: 30,
    height: 18,
    marginLeft: -15,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: 'rgba(11,23,31,0.6)',
  },
  teaserLockBadge: {
    position: 'absolute',
    top: 4, right: 4,
    width: 14, height: 14,
    borderRadius: 3,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teaserFoot: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 14,
    backgroundColor: 'rgba(6,11,16,0.7)',
  },
  teaserCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
  },
  teaserCategoryCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    width: '50%',
  },
  teaserCategoryText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.textPrimary,
    letterSpacing: 1.8,
    fontWeight: '800',
  },

  // ── State 1 — Stats row ───────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING[16],
    marginBottom: SPACING[12],
  },
  statCell: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    gap: 4,
    ...PIXEL_SHADOW,
  },
  statNum: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 22,
    color: COLORS.gold,
    lineHeight: 22,
  },
  statLbl: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    fontWeight: '800',
  },

  // ── State 1 — Notify ──────────────────────────────────────────────────────
  notifyShadow: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  notifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#12563A',
  },
  notifyIconTile: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#166B82',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  notifySub: {
    marginTop: 2,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  notifyTapBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: 4,
  },
  notifyTapText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.teal,
    letterSpacing: 2,
    fontWeight: '800',
  },

  shinyHint: {
    marginTop: SPACING[16],
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 3,
    fontWeight: '800',
  },

  // ── State 2 — Overall progress ────────────────────────────────────────────
  overallShadow: {
    borderRadius: RADIUS.medium,
    ...PIXEL_SHADOW,
  },
  overallCard: {
    padding: 14,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: '#1E5A72',
  },
  overallHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  overallHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overallLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 2.5,
    fontWeight: '800',
  },
  overallCount: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 18,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  overallTrack: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  overallFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
  },
  overallFootRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  overallFootLeft: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  overallFootRight: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textSecondary,
  },

  // ── State 2 — Category card ───────────────────────────────────────────────
  catShadow: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  catCard: {
    padding: 12,
    borderRadius: RADIUS.small,
    borderWidth: 1,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  catIconTile: {
    width: 34,
    height: 34,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  catSub: {
    marginTop: 2,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: 'rgba(240,244,247,0.65)',
  },
  catProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catProgressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
  },
  catProgressCount: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 16,
    minWidth: 54,
    textAlign: 'right',
    lineHeight: 16,
  },

  // ── State 2 — Packs divider ───────────────────────────────────────────────
  packsDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING[16],
    marginBottom: SPACING[8],
  },
  packsDivider: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderStyle: 'dashed',
  },
  packsLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packsLabelDot: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.gold,
  },
  packsLabelText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 2,
    fontWeight: '800',
  },

  // ── State 2 — Open pack CTA ───────────────────────────────────────────────
  openPackWrap: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  openPackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#B98F1A',
  },
  openPackText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 20,
    color: COLORS.background,
    letterSpacing: 3,
    fontWeight: '800',
  },
  openPackHint: {
    marginTop: SPACING[8],
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
