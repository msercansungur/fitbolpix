import React from 'react';
import { View } from 'react-native';

// ─── Pixel grid renderer ──────────────────────────────────────────────────────
// Each '1' in the grid becomes a filled square of pixelSize × pixelSize.

function PixelGrid({
  grid,
  color,
  pixelSize,
}: {
  grid: number[][];
  color: string;
  pixelSize: number;
}) {
  return (
    <View style={{ width: grid[0].length * pixelSize, height: grid.length * pixelSize }}>
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((cell, c) => (
            <View
              key={c}
              style={{
                width: pixelSize,
                height: pixelSize,
                backgroundColor: cell ? color : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Icon pixel grids (10 × 10 → 20 × 20 at pixelSize=2) ─────────────────────

// HOME — house with door
const HOME_GRID = [
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
  [0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
  [0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
];

// FIXTURES — calendar grid
const FIXTURES_GRID = [
  [0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 0, 0, 1, 0, 1, 0, 0, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 0, 1, 0, 1, 0, 1, 1, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  [1, 1, 0, 1, 0, 1, 0, 1, 1, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// SIMULATOR — football / soccer ball
const SIMULATOR_GRID = [
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 0, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
  [1, 0, 1, 1, 0, 0, 1, 1, 0, 1],
  [1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
];

// PENALTY — goal post + ball
const PENALTY_GRID = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
];

// TOURNAMENT — trophy cup
const TOURNAMENT_GRID = [
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
];

// COLLECTION — two overlapping cards with star
const COLLECTION_GRID = [
  [0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
  [0, 1, 0, 1, 1, 1, 0, 1, 0, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// ─── Icon components ──────────────────────────────────────────────────────────

interface IconProps {
  color: string;
  size: number;
}

function makeIcon(grid: number[][]) {
  return function Icon({ color, size }: IconProps) {
    // grid is 10 cols wide; pixelSize scales so the icon fills `size`
    const pixelSize = Math.max(1, Math.round(size / 10));
    return <PixelGrid grid={grid} color={color} pixelSize={pixelSize} />;
  };
}

export const HomeIcon       = makeIcon(HOME_GRID);
export const FixturesIcon   = makeIcon(FIXTURES_GRID);
export const SimulatorIcon  = makeIcon(SIMULATOR_GRID);
export const PenaltyIcon    = makeIcon(PENALTY_GRID);
export const TournamentIcon = makeIcon(TOURNAMENT_GRID);
export const CollectionIcon = makeIcon(COLLECTION_GRID);
