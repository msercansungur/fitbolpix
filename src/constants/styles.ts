// Reusable component styles for the FiTBOLPiX redesign.
// Imports from src/theme (the new design system), not the legacy src/constants/theme.

import { StyleSheet } from 'react-native';
import { COLORS, RADIUS, TYPOGRAPHY, PIXEL_SHADOW } from '../theme';

export const styles = StyleSheet.create({
  pixelCard: {
    backgroundColor: COLORS.surface,
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    RADIUS.medium,
    ...PIXEL_SHADOW,
  },

  sectionHeader: {
    color:          COLORS.gold,
    fontFamily:     TYPOGRAPHY.fontHeading,
    fontSize:       13,
    letterSpacing:  1.5,
    textTransform:  'uppercase',
  },

  dashedDivider: {
    height:         1,
    backgroundColor: 'transparent',
    borderWidth:     0,
    borderTopWidth:  1,
    borderTopColor:  COLORS.border,
    borderStyle:    'dashed',
  },
});

export default styles;
