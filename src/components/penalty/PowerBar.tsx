import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme';

const BAR_H      = 160;
const BAR_W      = 36;
const MAX_HOLD_MS = 1500;

interface PowerBarProps {
  onRelease: (power: number) => void;
  disabled:  boolean;
}

export default function PowerBar({ onRelease, disabled }: PowerBarProps) {
  const fillAnim    = useRef(new Animated.Value(0)).current; // 0→1
  const pressTime   = useRef<number>(0);
  const animRef     = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding]   = useState(false);
  const [locked, setLocked]     = useState(false);
  const [lockedPower, setLockedPower] = useState(0);

  const handlePressIn = useCallback(() => {
    if (disabled || locked) return;
    pressTime.current = Date.now();
    setHolding(true);
    fillAnim.setValue(0);
    animRef.current = Animated.timing(fillAnim, {
      toValue: 1,
      duration: MAX_HOLD_MS,
      useNativeDriver: false,
    });
    animRef.current.start();
  }, [disabled, locked, fillAnim]);

  const handlePressOut = useCallback(() => {
    if (disabled || locked) return;
    animRef.current?.stop();
    setHolding(false);

    const held    = Date.now() - pressTime.current;
    const power   = Math.min(100, Math.round((held / MAX_HOLD_MS) * 100));
    setLockedPower(power);
    setLocked(true);
    onRelease(power);
  }, [disabled, locked, onRelease]);

  // Bar color: green < 40%, yellow < 70%, red >= 70%
  const barColor = fillAnim.interpolate({
    inputRange:  [0, 0.4, 0.7, 1],
    outputRange: [COLORS.success, COLORS.success, COLORS.warning, COLORS.danger],
  });

  const barHeight = fillAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, BAR_H],
  });

  const displayPower = locked ? lockedPower : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>HOLD TO POWER</Text>

      <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <View style={styles.barTrack}>
          {/* Fill from bottom */}
          <Animated.View
            style={[
              styles.barFill,
              { height: barHeight, backgroundColor: barColor },
            ]}
          />
          {/* Tick marks */}
          {[25, 50, 75].map((pct) => (
            <View
              key={pct}
              style={[styles.tick, { bottom: (BAR_H * pct) / 100 - 0.5 }]}
            />
          ))}
        </View>
      </TouchableWithoutFeedback>

      <Text style={styles.powerValue}>
        {locked ? `${displayPower}%` : holding ? '...' : 'TAP'}
      </Text>

      {locked && (
        <View style={[
          styles.powerBadge,
          displayPower >= 70 && styles.powerBadgeDanger,
          displayPower >= 40 && displayPower < 70 && styles.powerBadgeWarn,
        ]}>
          <Text style={styles.powerBadgeText}>
            {displayPower >= 85 ? 'MAX POWER' : displayPower >= 60 ? 'STRONG' : displayPower >= 35 ? 'GOOD' : 'WEAK'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  barTrack: {
    width: BAR_W,
    height: BAR_H,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barFill: {
    width: '100%',
    borderRadius: 2,
  },
  tick: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  powerValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  powerBadge: {
    backgroundColor: COLORS.success,
    borderRadius: 4,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  powerBadgeDanger: { backgroundColor: COLORS.danger },
  powerBadgeWarn:   { backgroundColor: COLORS.warning },
  powerBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
  },
});
