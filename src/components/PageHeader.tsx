import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface PageHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export default function PageHeader({ icon, title, subtitle, rightAction }: PageHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:  10,
    gap: SPACING.sm,
  },
  icon: {
    fontSize: 22,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.pixel,
    fontSize:   18,
    color:      COLORS.accent,
    lineHeight: 22,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize:   11,
    color:      COLORS.textMuted,
    marginTop:  1,
  },
  right: {
    marginLeft: SPACING.sm,
  },
});
