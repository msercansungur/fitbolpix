import React from 'react';
import { Text } from 'react-native';
import { CircleCountryFlag, type CountryCode } from 'react-native-circle-flags';

interface PixelFlagProps {
  isoCode: string;
  size?: number;
  style?: object;
}

// Special-case constituent countries supported by react-native-circle-flags
const VALID_SPECIAL: Record<string, CountryCode> = {
  'gb-eng': 'gb-eng',
  'gb-sct': 'gb-sct',
};

export default function PixelFlag({ isoCode, size = 32, style }: PixelFlagProps) {
  const code = isoCode.toLowerCase() as CountryCode;

  // Validate: if the code is a known special case, use it directly
  // Otherwise it must be a valid 2-char ISO code
  const isSpecial  = VALID_SPECIAL[code] !== undefined;
  const isStandard = !isSpecial && /^[a-z]{2}$/.test(code);

  if (!isSpecial && !isStandard) {
    // Fallback: generic globe emoji
    return <Text style={{ fontSize: size * 0.8 }}>🌐</Text>;
  }

  return (
    <CircleCountryFlag
      code={code}
      size={size}
      style={style}
    />
  );
}
