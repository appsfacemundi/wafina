import { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { colors } from '@/theme/tokens';

interface PhotoProps {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  placeholderIcon?: string;
}

/**
 * Institution UX follow-up (2026-07-31) — "never leave an empty space" when a
 * photo is missing, AND gracefully degrade if a stored URL fails to load
 * (found via a real bug: existing Drive URLs used a format blocked by
 * Cross-Origin-Resource-Policy — see apps/api/src/config/drive.ts fix).
 */
export function Photo({ uri, style, placeholderIcon = '📷' }: PhotoProps) {
  const [errored, setErrored] = useState(false);

  if (!uri || errored) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.icon}>{placeholderIcon}</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={style} onError={() => setErrored(true)} />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    color: colors.textFaint,
  },
});
