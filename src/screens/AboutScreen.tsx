import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import FitbolpixLogo from '../components/FitbolpixLogo';

const VERSION = 'v1.0.0';

// ─── Open source libs ─────────────────────────────────────────────────────────
const OPEN_SOURCE = [
  'React Native & Expo',
  'React Navigation',
  'Zustand',
  'Phaser.js (penalty shootout)',
  'react-native-circle-flags',
  'react-native-webview',
  '@expo-google-fonts / Barlow Condensed & Inter',
];

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function BodyText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(url)} activeOpacity={0.7}>
      <Text style={styles.linkText}>{label}</Text>
      <Text style={styles.linkArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AboutScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.root}>
      {/* Back button */}
      <View style={styles.backBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          {/* Pixel arrow ← */}
          <View style={styles.pixelArrow}>
            {[[1,0,0],[1,1,0],[1,1,1],[1,1,0],[1,0,0]].map((row, r) => (
              <View key={r} style={{ flexDirection: 'row' }}>
                {row.map((cell, c) => (
                  <View key={c} style={[styles.arrowPx, { backgroundColor: cell ? COLORS.accent : 'transparent' }]} />
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.backLabel}>BACK</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <FitbolpixLogo size="large" />
          <Text style={styles.version}>{VERSION}</Text>
        </View>

        {/* About */}
        <Section label="ABOUT FITBOLPIX">
          <BodyText>
            A fan-made World Cup 2026 companion app. Features live scores, a match
            simulator, tournament mode, penalty shootout, and a card collection —
            all wrapped in pixel art and football meme culture.
          </BodyText>
          <BodyText>
            Not affiliated with FIFA or any official football organization.
          </BodyText>
        </Section>

        {/* Legal */}
        <Section label="LEGAL">
          <LinkRow label="Privacy Policy" url="https://fitbolpix.app/privacy" />
          <LinkRow label="Terms of Use"   url="https://fitbolpix.app/terms" />
        </Section>

        {/* Open source */}
        <Section label="OPEN SOURCE LIBRARIES">
          {OPEN_SOURCE.map((lib) => (
            <View key={lib} style={styles.libRow}>
              <View style={styles.libDot} />
              <Text style={styles.libText}>{lib}</Text>
            </View>
          ))}
        </Section>

        {/* Contact */}
        <Section label="CONTACT">
          <LinkRow
            label="Send feedback"
            url="mailto:hello@fitbolpix.app"
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bgPrimary },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  // Back bar
  backBar: {
    backgroundColor: COLORS.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    alignSelf: 'flex-start',
  },
  pixelArrow: { gap: 0 },
  arrowPx: { width: 2, height: 2 },
  backLabel: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: COLORS.accent,
    letterSpacing: 1,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  version: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 2,
  },

  // Section
  section: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: COLORS.accent,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },

  // Link row
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  linkText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  linkArrow: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.textMuted,
  },

  // Open source libs
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 4,
  },
  libDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  libText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
