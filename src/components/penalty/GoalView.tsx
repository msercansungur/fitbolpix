import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { COLORS } from '../../constants/theme';
import { GoalZone, GKDive, ShotOutcome } from '../../types/penalty';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Layout constants ─────────────────────────────────────────────────────────

const FIELD_H        = 260;
const GOAL_W         = SCREEN_W * 0.72;
const GOAL_H         = 130;
const GOAL_TOP       = 60;
const POST_THICKNESS = 5;
const CROWD_ROWS     = 3;

// Pre-generated crowd pixel colors for atmosphere
const CROWD_COLORS = ['#e63946', '#ffd700', '#2dc653', '#60b4ff', '#f4a261', '#c084fc', '#f0f0f0', '#e63946', '#ffd700'];

// GK horizontal positions (center of GK sprite relative to goal left edge)
const GK_X: Record<'left' | 'center' | 'right', number> = {
  left:   GOAL_W * 0.18,
  center: GOAL_W * 0.50,
  right:  GOAL_W * 0.82,
};

// GK vertical positions
const GK_Y: Record<'high' | 'low', number> = {
  high: GOAL_H * 0.18,
  low:  GOAL_H * 0.60,
};

// Zone to goal center (for ball trajectory target)
const ZONE_CENTERS: Record<GoalZone, { x: number; y: number }> = {
  0: { x: GOAL_W * 0.17, y: GOAL_H * 0.20 },
  1: { x: GOAL_W * 0.50, y: GOAL_H * 0.20 },
  2: { x: GOAL_W * 0.83, y: GOAL_H * 0.20 },
  3: { x: GOAL_W * 0.17, y: GOAL_H * 0.55 },
  4: { x: GOAL_W * 0.50, y: GOAL_H * 0.55 },
  5: { x: GOAL_W * 0.83, y: GOAL_H * 0.55 },
  6: { x: GOAL_W * 0.17, y: GOAL_H * 0.85 },
  7: { x: GOAL_W * 0.50, y: GOAL_H * 0.85 },
  8: { x: GOAL_W * 0.83, y: GOAL_H * 0.85 },
};

// ─── Crowd row component ──────────────────────────────────────────────────────

function CrowdRow({ seed }: { seed: number }) {
  const dots = Array.from({ length: 28 }, (_, i) => {
    const color = CROWD_COLORS[(seed + i * 3) % CROWD_COLORS.length];
    return <View key={i} style={[styles.crowdDot, { backgroundColor: color }]} />;
  });
  return <View style={styles.crowdRow}>{dots}</View>;
}

// ─── Pixel GK sprite ──────────────────────────────────────────────────────────

function GKSprite({ diveDir, diveHeight, visible }: {
  diveDir: 'left' | 'center' | 'right' | null;
  diveHeight: 'high' | 'low' | null;
  visible: boolean;
}) {
  const dir    = diveDir    ?? 'center';
  const height = diveHeight ?? 'low';
  const x = GK_X[dir] - 14; // offset for sprite width
  const y = GK_Y[height];

  if (!visible) return null;

  // Simple pixel-art GK: colored blocks for body, head, arms
  return (
    <View style={[styles.gkSprite, { left: x, top: y }]}>
      {/* Head */}
      <View style={styles.gkHead} />
      {/* Body (kit) */}
      <View style={styles.gkBody} />
      {/* Arms stretched out */}
      <View style={[styles.gkArm, styles.gkArmLeft]} />
      <View style={[styles.gkArm, styles.gkArmRight]} />
    </View>
  );
}

// ─── Ball component ───────────────────────────────────────────────────────────

function Ball({ zone, animating, outcome }: {
  zone: GoalZone | null;
  animating: boolean;
  outcome: ShotOutcome | null;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animating || zone === null) return;
    const target = ZONE_CENTERS[zone];
    // Ball travels from kick-spot (bottom center) up to zone
    const startX = GOAL_W / 2;
    const startY = FIELD_H - GOAL_TOP - 10;
    translateX.setValue(startX);
    translateY.setValue(startY);
    scale.setValue(1);

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: target.x + GOAL_W * 0.05,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: GOAL_TOP + target.y,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: outcome === 'miss' ? 0.3 : 0.6,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animating, zone, outcome]);

  if (!animating && zone === null) return null;

  return (
    <Animated.View
      style={[
        styles.ball,
        { transform: [{ translateX }, { translateY }, { scale }] },
      ]}
    />
  );
}

// ─── Main GoalView ────────────────────────────────────────────────────────────

interface GoalViewProps {
  gkDive:     GKDive | null;
  shotZone:   GoalZone | null;
  outcome:    ShotOutcome | null;
  showResult: boolean;
}

export default function GoalView({ gkDive, shotZone, outcome, showResult }: GoalViewProps) {
  return (
    <View style={styles.field}>
      {/* Crowd stands */}
      <View style={styles.stands}>
        {Array.from({ length: CROWD_ROWS }, (_, i) => (
          <CrowdRow key={i} seed={i * 7} />
        ))}
      </View>

      {/* Ad boards */}
      <View style={styles.adBoards}>
        {['FITBOLPIX', 'WC2026', '⚽', 'GOOOL!', 'FITBOLPIX'].map((label, i) => (
          <View key={i} style={[styles.adPanel, { backgroundColor: i % 2 === 0 ? '#1a3d28' : '#0d2818' }]}>
            <Text style={styles.adText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Pitch surface */}
      <View style={styles.pitch}>
        {/* Penalty spot line */}
        <View style={styles.penaltyLine} />
        <View style={styles.penaltySpot} />

        {/* Goal frame */}
        <View style={styles.goalFrame}>
          {/* Left post */}
          <View style={[styles.post, styles.postLeft]} />
          {/* Right post */}
          <View style={[styles.post, styles.postRight]} />
          {/* Crossbar */}
          <View style={styles.crossbar} />

          {/* Net (subtle grid inside goal) */}
          <View style={styles.net}>
            {Array.from({ length: 5 }, (_, row) => (
              <View key={row} style={styles.netRow}>
                {Array.from({ length: 8 }, (_, col) => (
                  <View key={col} style={styles.netCell} />
                ))}
              </View>
            ))}
          </View>

          {/* GK sprite */}
          <GKSprite
            diveDir={showResult ? (gkDive?.direction ?? null) : null}
            diveHeight={showResult ? (gkDive?.height ?? null) : null}
            visible={true}
          />

          {/* Outcome indicator */}
          {showResult && outcome && (
            <View style={styles.outcomeOverlay}>
              <Text style={[
                styles.outcomeText,
                outcome === 'goal'  && styles.outcomeGoal,
                outcome === 'saved' && styles.outcomeSaved,
                outcome === 'miss'  && styles.outcomeMiss,
              ]}>
                {outcome === 'goal' ? 'GOAL!' : outcome === 'saved' ? 'SAVED!' : 'MISS!'}
              </Text>
            </View>
          )}
        </View>

        {/* Ball */}
        <Ball zone={shotZone} animating={showResult && shotZone !== null} outcome={outcome} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  field: {
    width: '100%',
    height: FIELD_H,
    backgroundColor: '#0a5c1a', // dark pitch green
    overflow: 'hidden',
  },

  // ── Stands ──
  stands: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 3,
  },
  crowdRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 1,
    gap: 3,
  },
  crowdDot: {
    width: 5,
    height: 5,
    borderRadius: 1,
  },

  // ── Ad boards ──
  adBoards: {
    flexDirection: 'row',
    height: 18,
    overflow: 'hidden',
  },
  adPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  adText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },

  // ── Pitch ──
  pitch: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
  },
  penaltyLine: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 2,
  },
  penaltySpot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },

  // ── Goal frame ──
  goalFrame: {
    width: GOAL_W,
    height: GOAL_H,
    position: 'relative',
  },
  post: {
    position: 'absolute',
    width: POST_THICKNESS,
    height: GOAL_H,
    backgroundColor: '#ffffff',
    top: 0,
  },
  postLeft: { left: 0 },
  postRight: { right: 0 },
  crossbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: POST_THICKNESS,
    backgroundColor: '#ffffff',
  },

  // ── Net ──
  net: {
    position: 'absolute',
    top: POST_THICKNESS,
    left: POST_THICKNESS,
    right: POST_THICKNESS,
    bottom: 0,
    flexDirection: 'column',
  },
  netRow: {
    flex: 1,
    flexDirection: 'row',
  },
  netCell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // ── GK sprite ──
  gkSprite: {
    position: 'absolute',
    width: 28,
    height: 36,
  },
  gkHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f4c07a',
    alignSelf: 'center',
    marginBottom: 1,
  },
  gkBody: {
    width: 18,
    height: 16,
    backgroundColor: '#f4a261', // orange kit
    alignSelf: 'center',
    borderRadius: 2,
  },
  gkArm: {
    position: 'absolute',
    width: 10,
    height: 6,
    backgroundColor: '#f4a261',
    top: 14,
    borderRadius: 3,
  },
  gkArmLeft:  { left: 0 },
  gkArmRight: { right: 0 },

  // ── Ball ──
  ball: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#aaa',
    bottom: 4,
    left: GOAL_W / 2 - 7,
  },

  // ── Outcome overlay ──
  outcomeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  outcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  outcomeGoal:  { color: COLORS.primary },
  outcomeSaved: { color: '#60b4ff' },
  outcomeMiss:  { color: '#e63946' },
});
