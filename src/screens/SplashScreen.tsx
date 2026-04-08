import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../constants/theme';

// ─── Pixel art football (7×7 grid) ────────────────────────────────────────────
const BALL_GRID = [
  [0, 0, 1, 1, 1, 0, 0],
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 0, 1, 0, 1, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 1, 0, 1, 0, 1, 1],
  [0, 1, 1, 0, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
];

function PixelBall({ size }: { size: number }) {
  const px = size / BALL_GRID[0].length;
  return (
    <View style={{ width: size, height: size }}>
      {BALL_GRID.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((cell, c) => (
            <View
              key={c}
              style={{
                width: px,
                height: px,
                backgroundColor: cell ? COLORS.accent : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Loading bar ──────────────────────────────────────────────────────────────

function LoadingBar() {
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: 200,
      duration: 2000,
      useNativeDriver: false, // width animation requires JS driver
    }).start();
  }, []);

  // Tick marks at 25%, 50%, 75%
  const ticks = [50, 100, 150];

  return (
    <View>
      <View style={styles.barContainer}>
        <Animated.View style={[styles.barFill, { width: fill }]} />
        {ticks.map((pos) => (
          <View key={pos} style={[styles.barTick, { left: pos }]} />
        ))}
      </View>
      <Text style={styles.loadingText}>LOADING...</Text>
    </View>
  );
}

// ─── Main splash ──────────────────────────────────────────────────────────────

export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.content, { opacity }]}>
        {/* Pixel art ball */}
        <PixelBall size={56} />

        {/* Wordmark — system monospace while custom font loads */}
        <Text style={styles.wordmark}>FITBOLPIX</Text>
        <Text style={styles.subtitle}>World Cup 2026 Companion</Text>

        {/* Animated loading bar */}
        <View style={styles.barWrap}>
          <LoadingBar />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  wordmark: {
    fontFamily: 'monospace',
    fontSize: 26,
    color: COLORS.accent,
    letterSpacing: 6,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  barWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
  barContainer: {
    width: 200,
    height: 16,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  barTick: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: '100%',
    backgroundColor: COLORS.bgPrimary,
    opacity: 0.4,
  },
  loadingText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 3,
    marginTop: 8,
    textAlign: 'center',
  },
});
