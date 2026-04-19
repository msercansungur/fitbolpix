import { ViewStyle } from 'react-native';

// ─── Colors ───────────────────────────────────────────────────────────────────
export const COLORS = {
  background:              '#0B171F',
  backgroundGradientStart: '#0B171F',
  backgroundGradientEnd:   '#0D1F2D',
  surface:                 '#112230',
  surfaceElevated:         '#162B3A',
  gold:                    '#FACE43',
  green:                   '#007B46',
  teal:                    '#28ADCF',
  red:                     '#C0392B',
  textPrimary:             '#FFFFFF',
  textSecondary:           '#8899AA',
  textMuted:               '#4A6070',
  border:                  '#1E3448',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const TYPOGRAPHY = {
  fontHeading: 'BarlowCondensed_700Bold',
  fontBody:    'Inter_400Regular',
  fontMono:    'Born2bSportyFS',
} as const;

// ─── Spacing (numeric scale 4 → 48) ───────────────────────────────────────────
export const SPACING = {
  4:  4,
  8:  8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  48: 48,
} as const;

// ─── Radius ───────────────────────────────────────────────────────────────────
export const RADIUS = {
  small:  6,
  medium: 8,
  large:  12,
} as const;

// ─── Pixel shadow (hard-edge, no blur, 3px offset) ────────────────────────────
export const PIXEL_SHADOW: ViewStyle = {
  shadowColor:   '#000',
  shadowOffset:  { width: 3, height: 3 },
  shadowOpacity: 1,
  shadowRadius:  0,
  elevation:     3,
};

// ─── Default export (convenience) ─────────────────────────────────────────────
const theme = { COLORS, TYPOGRAPHY, SPACING, RADIUS, PIXEL_SHADOW };
export default theme;
