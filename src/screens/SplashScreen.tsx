import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY } from '../theme';
import { backgroundGradient } from '../theme/gradients';

// ─── Pixel stadium (24×16 grid) ───────────────────────────────────────────────
// 0 = transparent, 1 = gold structure, 2 = green field, 3 = gold-dim outline
const STADIUM_ROWS = [
  '000000001111111111000000',
  '000001113333333333111000',
  '000111333111111113331100',
  '011133311100000001113311',
  '113331100000000000001333',
  '133110000222222220000133',
  '133102222222222222222133',
  '133122222222222222222133',
  '133122220022222200222133',
  '133122220022222200222133',
  '133122222222222222222133',
  '133122222222222222222133',
  '133100222222222222200133',
  '133110000000000000001331',
  '011333333333333333333310',
  '001111111111111111111100',
];
const STADIUM_COLORS: Record<string, string> = {
  '0': 'transparent',
  '1': COLORS.gold,
  '2': '#0AA35E',       // brighter green (field) — matches design ref
  '3': '#B98F1A',       // gold-dim (structure outline)
};

function PixelStadium({ px = 5 }: { px?: number }) {
  return (
    <View style={{ width: px * 24, height: px * 16 }}>
      {STADIUM_ROWS.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, ci) => (
            <View key={ci} style={{ width: px, height: px, backgroundColor: STADIUM_COLORS[c] }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Corner bracket (L-shape, 20px legs, 2px thick) ───────────────────────────
type CornerPos = 'tl' | 'tr' | 'bl' | 'br';

function CornerBracket({ pos }: { pos: CornerPos }) {
  const base = {
    position: 'absolute' as const,
    width: 20,
    height: 20,
    borderColor: COLORS.gold,
  };
  if (pos === 'tl') {
    return <View style={[base, { top: 18, left: 18, borderTopWidth: 2, borderLeftWidth: 2 }]} />;
  }
  if (pos === 'tr') {
    return <View style={[base, { top: 18, right: 18, borderTopWidth: 2, borderRightWidth: 2 }]} />;
  }
  if (pos === 'bl') {
    return <View style={[base, { bottom: 18, left: 18, borderBottomWidth: 2, borderLeftWidth: 2 }]} />;
  }
  return <View style={[base, { bottom: 18, right: 18, borderBottomWidth: 2, borderRightWidth: 2 }]} />;
}

// ─── Segmented loading bar (24 segments, pixel style) ─────────────────────────
function SegmentedBar({ ratio, width = 260 }: { ratio: number; width?: number }) {
  const segments = 24;
  const gap = 2;
  const innerWidth = width - 8; // 4px padding each side
  const segW = (innerWidth - (segments - 1) * gap) / segments;
  const filled = Math.round(ratio * segments);

  return (
    <View style={{ alignItems: 'center' }}>
      {/* frame */}
      <View style={styles.barFrame}>
        <View style={{ flexDirection: 'row', height: 14, gap }}>
          {Array.from({ length: segments }).map((_, i) => {
            const on = i < filled;
            return (
              <View
                key={i}
                style={{
                  width: segW,
                  height: '100%',
                  backgroundColor: on ? COLORS.gold : 'rgba(250,206,67,0.08)',
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Loading messages ─────────────────────────────────────────────────────────
const MESSAGES = [
  'CONNECTING TO MATCHWIRE...',
  'LOADING 48 NATIONAL TEAMS...',
  'SYNCING FIXTURES · 104 MATCHES...',
  'WARMING UP PIXEL ENGINE...',
];

// ─── Main splash ──────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [ratio, setRatio] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  // Drive the segmented bar — Animated.Value listener pushes the number into state
  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => setRatio(value));
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2500,
      useNativeDriver: false,
    }).start();
    return () => {
      progressAnim.removeListener(id);
    };
  }, [progressAnim]);

  // Cycle through loading messages every 600ms
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.root}>
      {/* background gradient */}
      <LinearGradient {...backgroundGradient} style={StyleSheet.absoluteFillObject} />

      {/* corner brackets */}
      <CornerBracket pos="tl" />
      <CornerBracket pos="tr" />
      <CornerBracket pos="bl" />
      <CornerBracket pos="br" />

      {/* top eyebrow */}
      <Text style={styles.eyebrow}>◆ WORLD FOOTBALL CHAMPIONSHIP ◆</Text>

      {/* center cluster */}
      <View style={styles.center}>
        <PixelStadium px={5} />

        <View style={styles.wordmarkWrap}>
          <Text style={styles.wordmark}>
            FiTBOL<Text style={styles.wordmarkGold}>PiX</Text>
          </Text>
          <View style={styles.dashedUnderline} />
          <Text style={styles.tagline}>· PRESS · START · 2026 ·</Text>
        </View>

        <SegmentedBar ratio={ratio} width={260} />

        <Text style={styles.statusText}>{MESSAGES[msgIdx]}</Text>
      </View>

      {/* bottom row */}
      <Text style={styles.footerLeft}>v1.0</Text>
      <Text style={styles.footerRight}>© 2026 FiTBOLPiX</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  eyebrow: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    letterSpacing: 4,
    color: '#B98F1A', // gold-dim
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: 20,
  },
  wordmarkWrap: {
    alignItems: 'center',
    gap: 6,
  },
  wordmark: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 44,
    letterSpacing: 3,
    color: COLORS.textPrimary,
    lineHeight: 46,
  },
  wordmarkGold: {
    color: COLORS.gold,
  },
  dashedUnderline: {
    width: 180,
    height: 0,
    borderTopWidth: 2,
    borderTopColor: COLORS.gold,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  tagline: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 15,
    letterSpacing: 3,
    color: '#B98F1A', // gold-dim (muted gold, per spec)
    marginTop: 4,
  },
  barFrame: {
    width: 260,
    padding: 4,
    backgroundColor: '#060B10',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  footerLeft: {
    position: 'absolute',
    bottom: 24,
    left: 28,
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.textMuted,
  },
  footerRight: {
    position: 'absolute',
    bottom: 24,
    right: 28,
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.textMuted,
  },
});
