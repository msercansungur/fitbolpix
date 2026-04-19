// Named gradient configs for expo-linear-gradient's <LinearGradient>.
// Each config: { colors: [start, end], start: {x,y}, end: {x,y} }.
// All gradients are vertical (top → bottom).

export interface GradientConfig {
  colors: readonly [string, string];
  start:  { x: number; y: number };
  end:    { x: number; y: number };
}

const VERTICAL_START = { x: 0, y: 0 };
const VERTICAL_END   = { x: 0, y: 1 };

export const backgroundGradient: GradientConfig = {
  colors: ['#0B171F', '#0D1F2D'],
  start:  VERTICAL_START,
  end:    VERTICAL_END,
};

export const cardGreen: GradientConfig = {
  colors: ['#0D3B2A', '#1A5C3A'],
  start:  VERTICAL_START,
  end:    VERTICAL_END,
};

export const cardTeal: GradientConfig = {
  colors: ['#0D2B3B', '#1A4A5C'],
  start:  VERTICAL_START,
  end:    VERTICAL_END,
};

export const cardRed: GradientConfig = {
  colors: ['#3B1A0D', '#5C2A1A'],
  start:  VERTICAL_START,
  end:    VERTICAL_END,
};

export const cardGold: GradientConfig = {
  colors: ['#3B2E0D', '#5C481A'],
  start:  VERTICAL_START,
  end:    VERTICAL_END,
};

export const cardPurple: GradientConfig = {
  colors: ['#2A0D3B', '#3A1A5C'],
  start:  VERTICAL_START,
  end:    VERTICAL_END,
};

const gradients = {
  backgroundGradient,
  cardGreen,
  cardTeal,
  cardRed,
  cardGold,
  cardPurple,
};
export default gradients;
