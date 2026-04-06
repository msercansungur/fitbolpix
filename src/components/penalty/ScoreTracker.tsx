import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';
import { KickRecord, ShotOutcome } from '../../types/penalty';
import { Team } from '../../types/simulator';

const MAX_KICKS = 5;

function KickDot({ outcome }: { outcome: ShotOutcome | null }) {
  if (outcome === null) {
    return <View style={[styles.dot, styles.dotPending]} />;
  }
  if (outcome === 'goal') {
    return <View style={[styles.dot, styles.dotGoal]} />;
  }
  return (
    <View style={[styles.dot, styles.dotMiss]}>
      <Text style={styles.dotMissText}>✕</Text>
    </View>
  );
}

interface ScoreTrackerProps {
  homeTeam:   Team;
  awayTeam:   Team;
  kicks:      KickRecord[];
  homeScore:  number;
  awayScore:  number;
  round:      number;
}

export default function ScoreTracker({
  homeTeam,
  awayTeam,
  kicks,
  homeScore,
  awayScore,
  round,
}: ScoreTrackerProps) {
  const homeKicks = kicks.filter((k) => k.teamId === homeTeam.id);
  const awayKicks = kicks.filter((k) => k.teamId === awayTeam.id);

  // Pad to MAX_KICKS slots for display
  const homeDots: (ShotOutcome | null)[] = Array.from(
    { length: MAX_KICKS },
    (_, i) => homeKicks[i]?.outcome ?? null,
  );
  const awayDots: (ShotOutcome | null)[] = Array.from(
    { length: MAX_KICKS },
    (_, i) => awayKicks[i]?.outcome ?? null,
  );

  return (
    <View style={styles.container}>
      {/* Round indicator */}
      <Text style={styles.roundLabel}>ROUND {Math.min(round, MAX_KICKS)}</Text>

      <View style={styles.row}>
        {/* Home team */}
        <View style={styles.teamBlock}>
          <Text style={styles.flag}>{homeTeam.flag}</Text>
          <Text style={styles.teamName} numberOfLines={1}>{homeTeam.name}</Text>
        </View>

        {/* Home kick dots */}
        <View style={styles.dotsRow}>
          {homeDots.map((outcome, i) => (
            <KickDot key={i} outcome={outcome} />
          ))}
        </View>

        {/* Score */}
        <View style={styles.scoreBlock}>
          <Text style={styles.score}>{homeScore}</Text>
          <Text style={styles.scoreSep}>–</Text>
          <Text style={styles.score}>{awayScore}</Text>
        </View>

        {/* Away kick dots */}
        <View style={styles.dotsRow}>
          {awayDots.map((outcome, i) => (
            <KickDot key={i} outcome={outcome} />
          ))}
        </View>

        {/* Away team */}
        <View style={[styles.teamBlock, styles.teamBlockRight]}>
          <Text style={styles.teamName} numberOfLines={1}>{awayTeam.name}</Text>
          <Text style={styles.flag}>{awayTeam.flag}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  roundLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  teamBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  teamBlockRight: {
    justifyContent: 'flex-end',
  },
  flag: {
    fontSize: 18,
  },
  teamName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
    flexShrink: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  dotPending: {
    borderColor: COLORS.textMuted,
    backgroundColor: 'transparent',
  },
  dotGoal: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dotMiss: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotMissText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 10,
  },
  scoreBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.xs,
  },
  score: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    minWidth: 16,
    textAlign: 'center',
  },
  scoreSep: {
    fontSize: 15,
    color: COLORS.textMuted,
    fontWeight: 'bold',
  },
});
