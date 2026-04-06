import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const MAX_RADIUS = Math.min(SCREEN_W * 0.35, 130);
const MIN_RADIUS = 8;

interface AccuracyRingProps {
  /** Full oscillation cycle duration in ms — from getRingDuration() */
  ringDuration: number;
  onTap:        (accuracy: number) => void;
  disabled:     boolean;
}

export default function AccuracyRing({ ringDuration, onTap, disabled }: AccuracyRingProps) {
  const radius    = useRef(new Animated.Value(MAX_RADIUS)).current;
  const tapped    = useRef(false);
  const loopRef   = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (disabled) return;
    tapped.current = false;

    // Oscillate: shrink from MAX to MIN, grow back, repeat
    const halfCycle = ringDuration / 2;
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(radius, {
          toValue: MIN_RADIUS,
          duration: halfCycle,
          useNativeDriver: false,
        }),
        Animated.timing(radius, {
          toValue: MAX_RADIUS,
          duration: halfCycle,
          useNativeDriver: false,
        }),
      ]),
    );
    loopRef.current.start();

    return () => {
      loopRef.current?.stop();
    };
  }, [disabled, ringDuration]);

  const handleTap = useCallback(() => {
    if (disabled || tapped.current) return;
    tapped.current = true;
    loopRef.current?.stop();

    // Read current radius value synchronously
    const currentR: number = (radius as any)._value ?? MAX_RADIUS;
    // Accuracy: 100 when ring is smallest, 0 when largest
    const accuracy = Math.round(
      100 - ((currentR - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100,
    );
    onTap(Math.max(0, Math.min(100, accuracy)));
  }, [disabled, onTap, radius]);

  // Ring color: green when small (accurate), red when large
  const ringColor = radius.interpolate({
    inputRange:  [MIN_RADIUS, MAX_RADIUS * 0.4, MAX_RADIUS * 0.7, MAX_RADIUS],
    outputRange: [COLORS.success, COLORS.success, COLORS.warning, COLORS.danger],
  });

  const containerSize = MAX_RADIUS * 2 + 20;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>TAP AT THE RIGHT MOMENT!</Text>

      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={[styles.container, { width: containerSize, height: containerSize }]}>
          {/* Outer ring (animated) */}
          <Animated.View
            style={[
              styles.ring,
              {
                width: Animated.multiply(radius, 2),
                height: Animated.multiply(radius, 2),
                borderRadius: radius,
                borderColor: ringColor,
              },
            ]}
          />
          {/* Center target dot */}
          <View style={styles.centerDot} />
        </View>
      </TouchableWithoutFeedback>

      <Text style={styles.hint}>Smaller ring = better accuracy</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
  },
  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  hint: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
