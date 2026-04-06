// TODO: Replace with actual logo asset when ready
import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

// 5×5 pixel art football grid
const BALL_GRID = [
  [0, 1, 1, 1, 0],
  [1, 0, 1, 0, 1],
  [1, 1, 1, 1, 1],
  [1, 0, 1, 0, 1],
  [0, 1, 1, 1, 0],
];

const SIZE_CONFIG = {
  small:  { pixelSize: 2, fontSize: 14, gap: 5 },
  medium: { pixelSize: 3, fontSize: 20, gap: 7 },
  large:  { pixelSize: 4, fontSize: 28, gap: 10 },
};

interface Props {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

export default function FitbolpixLogo({ size = 'medium', color = COLORS.accent }: Props) {
  const cfg = SIZE_CONFIG[size];
  const gridW = BALL_GRID[0].length * cfg.pixelSize;
  const gridH = BALL_GRID.length * cfg.pixelSize;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: cfg.gap }}>
      {/* Pixel art football */}
      <View style={{ width: gridW, height: gridH }}>
        {BALL_GRID.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((cell, c) => (
              <View
                key={c}
                style={{
                  width: cfg.pixelSize,
                  height: cfg.pixelSize,
                  backgroundColor: cell ? color : 'transparent',
                }}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Wordmark */}
      <Text
        style={{
          fontFamily: FONTS.heading,
          fontSize: cfg.fontSize,
          color,
          letterSpacing: 2,
        }}
      >
        FITBOLPIX
      </Text>
    </View>
  );
}
