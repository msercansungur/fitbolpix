import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/theme';
import { GoalZone } from '../../types/penalty';

// Zones 0-8 row-major: 0 1 2 / 3 4 5 / 6 7 8
const ZONES: GoalZone[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

interface AimOverlayProps {
  selectedZone:   GoalZone | null;
  onSelect:       (zone: GoalZone) => void;
  disabled:       boolean;
  /** Absolute position + size to overlay exactly over the goal interior */
  containerStyle: ViewStyle;
}

export default function AimOverlay({ selectedZone, onSelect, disabled, containerStyle }: AimOverlayProps) {
  return (
    <View style={[styles.container, containerStyle]} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.grid}>
        {ZONES.map((zone) => {
          const isSelected = zone === selectedZone;
          return (
            <TouchableOpacity
              key={zone}
              style={[
                styles.cell,
                isSelected && styles.cellSelected,
              ]}
              onPress={() => onSelect(zone)}
              activeOpacity={0.6}
            >
              {isSelected && <View style={styles.cellDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '33.33%',
    height: '33.33%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  cellSelected: {
    backgroundColor: `${COLORS.primary}55`,
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  cellDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
});
