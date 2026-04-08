// Logo loaded from assets/icon.png
import React from 'react';
import { Image } from 'react-native';

const SIZE_CONFIG = {
  small:  { w: 28, h: 28 },
  medium: { w: 56, h: 56 },
  large:  { w: 64, h: 64 },
};

interface Props {
  size?: 'small' | 'medium' | 'large';
}

export default function FitbolpixLogo({ size = 'medium' }: Props) {
  const cfg = SIZE_CONFIG[size];

  return (
    <Image
      source={require('../../assets/icon.png')}
      style={{ width: cfg.w, height: cfg.h, borderRadius: 6 }}
    />
  );
}
