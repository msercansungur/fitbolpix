import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, PIXEL_SHADOW } from '../theme';
import { cardGreen, cardRed } from '../theme/gradients';
import { useTournamentStore } from '../store/useTournamentStore';
import { useTournamentMatchStore } from '../store/useTournamentMatchStore';

const VERSION       = '1.0.0';
const BUILD_LABEL   = 'build 2026.04';
const WEBSITE_URL   = 'https://fitbolpix.com';
const PRIVACY_URL   = 'https://fitbolpix.com/privacy';
const TERMS_URL     = 'https://fitbolpix.com/terms';
const CONTACT_EMAIL = 'hello@fitbolpix.com';

// ─── Pixel glyph (6×6) ────────────────────────────────────────────────────────
type GlyphKind = 'gear' | 'globe' | 'bell' | 'trash' | 'info' | 'doc' | 'chev' | 'back';
const GLYPHS: Record<GlyphKind, string[]> = {
  gear:  ['011110','111111','110011','110011','111111','011110'],
  globe: ['011110','100001','110011','101101','100001','011110'],
  bell:  ['001100','011110','011110','111111','000000','001100'],
  trash: ['111111','010010','011110','010010','010010','011110'],
  info:  ['011110','100001','101001','100001','101101','011110'],
  doc:   ['111110','100110','100010','101010','100010','111110'],
  chev:  ['010000','011000','011100','011100','011000','010000'],
  back:  ['000010','000110','001110','001110','000110','000010'],
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

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ glyph, title }: { glyph: GlyphKind; title: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <PixelGlyph kind={glyph} color={COLORS.gold} />
      <Text style={styles.sectionHeaderText}>{title}</Text>
      <View style={styles.sectionHeaderDivider} />
    </View>
  );
}

// ─── Pixel toggle ─────────────────────────────────────────────────────────────
function PixelToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onChange(!on)}
      style={[
        styles.toggleTrack,
        {
          backgroundColor: on ? COLORS.green : '#060B10',
          borderColor: on ? COLORS.green : COLORS.border,
        },
      ]}
    >
      <View style={[styles.toggleThumb, { left: on ? 24 : 2 }]} />
    </TouchableOpacity>
  );
}

// ─── Dashed divider inside a card ─────────────────────────────────────────────
function DashedRowDivider() {
  return <View style={styles.rowDivider} />;
}

// ─── Generic row ──────────────────────────────────────────────────────────────
function Row({
  label, sub, right, onPress, danger = false, disabled = false,
}: {
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const labelColor = disabled ? COLORS.textMuted : danger ? '#E85030' : COLORS.textPrimary;
  const Container: any = onPress && !disabled ? TouchableOpacity : View;
  return (
    <Container
      activeOpacity={0.7}
      onPress={onPress && !disabled ? onPress : undefined}
      style={[styles.row, disabled && { opacity: 0.55 }]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {right}
    </Container>
  );
}

// ─── Back button ──────────────────────────────────────────────────────────────
function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.headerBtn}>
      <PixelGlyph kind="back" color={COLORS.gold} px={2} />
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AboutScreen() {
  const navigation = useNavigation();
  const [notif, setNotif] = useState(true);

  const handleReset = () => {
    Alert.alert(
      'Reset Campaign Data?',
      'This will wipe your WC 2026 progress, match history, and selected nation. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            useTournamentMatchStore.getState().clearAll();
            useTournamentStore.getState().resetTournament();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerBrand}>FiTBOLPiX</Text>
            <Text style={styles.headerTitle}>SETTINGS</Text>
          </View>
          <View style={styles.headerBtn}>
            <PixelGlyph kind="gear" color={COLORS.gold} px={3} />
          </View>
        </View>

        {/* ── PREFERENCES ──────────────────────────────────────── */}
        <SectionHeader glyph="gear" title="PREFERENCES" />
        <View style={styles.cardShadow}>
          <LinearGradient {...cardGreen} style={styles.card}>
            <Row
              label="Language"
              sub="More languages coming soon"
              disabled
              right={
                <View style={styles.languagePill}>
                  <Text style={styles.languageFlag}>🇬🇧</Text>
                  <Text style={styles.languageText}>ENGLISH</Text>
                </View>
              }
            />
            <DashedRowDivider />
            <Row
              label="Notifications"
              sub="Match reminders"
              right={<PixelToggle on={notif} onChange={setNotif} />}
            />
          </LinearGradient>
        </View>

        {/* ── MY CAMPAIGN ──────────────────────────────────────── */}
        <SectionHeader glyph="trash" title="MY CAMPAIGN" />
        <View style={styles.cardShadow}>
          <LinearGradient {...cardRed} style={[styles.card, styles.cardRedBorder]}>
            <TouchableOpacity activeOpacity={0.8} onPress={handleReset} style={styles.resetRow}>
              <View style={styles.resetIconTile}>
                <PixelGlyph kind="trash" color="#E85030" px={2} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.resetLabel}>Reset Campaign Data</Text>
                <Text style={styles.resetSub}>Wipe progress and match history</Text>
              </View>
              <View style={styles.resetPill}>
                <Text style={styles.resetPillText}>RESET</Text>
              </View>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* ── ABOUT ────────────────────────────────────────────── */}
        <SectionHeader glyph="info" title="ABOUT" />
        <View style={styles.cardShadow}>
          <View style={[styles.card, styles.cardSolid]}>
            <Row
              label="Version"
              right={<Text style={styles.versionValue}>{VERSION}</Text>}
            />
            <DashedRowDivider />
            <Row
              label="Website"
              onPress={() => Linking.openURL(WEBSITE_URL)}
              right={<Text style={styles.linkValue}>fitbolpix.com</Text>}
            />
            <DashedRowDivider />
            <Row
              label="Contact"
              onPress={() => Linking.openURL('mailto:' + CONTACT_EMAIL)}
              right={<Text style={styles.linkValue}>{CONTACT_EMAIL}</Text>}
            />
          </View>
        </View>

        {/* ── LEGAL ────────────────────────────────────────────── */}
        <SectionHeader glyph="doc" title="LEGAL" />
        <View style={styles.cardShadow}>
          <View style={[styles.card, styles.cardSolid]}>
            <Row
              label="Privacy Policy"
              onPress={() => Linking.openURL(PRIVACY_URL)}
              right={<PixelGlyph kind="chev" color={COLORS.textMuted} px={2} />}
            />
            <DashedRowDivider />
            <Row
              label="Terms of Use"
              onPress={() => Linking.openURL(TERMS_URL)}
              right={<PixelGlyph kind="chev" color={COLORS.textMuted} px={2} />}
            />
          </View>
        </View>

        {/* ── FAN-MADE DISCLAIMER ──────────────────────────────── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerLabel}>⚠ FAN-MADE DISCLAIMER</Text>
          <Text style={styles.disclaimerBody}>
            FiTBOLPiX is an unofficial fan-made app. Not affiliated with, endorsed by,
            or sponsored by FIFA or any football governing body. All team names and
            likenesses belong to their respective owners.
          </Text>
        </View>

        {/* ── Footer ───────────────────────────────────────────── */}
        <Text style={styles.footerTagline}>◆ MADE WITH PIXELS & LOVE ◆</Text>
        <Text style={styles.footerBuild}>v{VERSION} · {BUILD_LABEL}</Text>

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
    gap: SPACING[12],
    marginTop: SPACING[4],
    marginBottom: SPACING[16],
  },
  headerBtn: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
    ...PIXEL_SHADOW,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerBrand: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 2.5,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: 2,
    lineHeight: 24,
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    marginTop: SPACING[20],
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

  // Card
  cardShadow: {
    borderRadius: RADIUS.medium,
    ...PIXEL_SHADOW,
  },
  card: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardSolid: {
    backgroundColor: COLORS.surface,
  },
  cardRedBorder: {
    borderColor: '#7A2414',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[12],
    paddingHorizontal: SPACING[16],
    paddingVertical: SPACING[12],
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  rowSub: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
    lineHeight: 15,
  },
  rowDivider: {
    marginHorizontal: SPACING[16],
    height: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
  },

  // Language pill (disabled)
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(28,57,72,0.3)',
  },
  languageFlag: {
    fontSize: 14,
  },
  languageText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },

  // Toggle
  toggleTrack: {
    width: 46,
    height: 24,
    borderRadius: 3,
    borderWidth: 1,
    position: 'relative',
  },
  toggleThumb: {
    position: 'absolute',
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },

  // Reset row
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[12],
    paddingHorizontal: SPACING[16],
    paddingVertical: SPACING[12],
  },
  resetIconTile: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#7A2414',
    backgroundColor: 'rgba(232,80,48,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLabel: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 14,
    fontWeight: '600',
    color: '#E85030',
    letterSpacing: 0.2,
  },
  resetSub: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
    lineHeight: 15,
  },
  resetPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#7A2414',
    backgroundColor: 'rgba(194,52,11,0.15)',
  },
  resetPillText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: '#E85030',
    letterSpacing: 2,
  },

  // Version / link values
  versionValue: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 15,
    color: COLORS.gold,
    letterSpacing: 1,
  },
  linkValue: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    color: COLORS.teal,
  },

  // Disclaimer
  disclaimer: {
    marginTop: SPACING[24],
    padding: SPACING[12],
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: RADIUS.small,
    backgroundColor: 'rgba(9,16,22,0.4)',
  },
  disclaimerLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: '#B98F1A',
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  disclaimerBody: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  // Footer
  footerTagline: {
    textAlign: 'center',
    marginTop: SPACING[20],
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 3,
  },
  footerBuild: {
    textAlign: 'center',
    marginTop: SPACING[4],
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
});
