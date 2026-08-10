import { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageResizeMode, type ImageStyle, type StyleProp } from 'react-native';
import { colors } from '@/theme/tokens';

interface PhotoProps {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  placeholderIcon?: string;
  /**
   * RC1 UX audit, 2026-08-10 — defaults to 'cover' (existing behavior,
   * correct for square/round avatars and logos). Pass 'contain' at call
   * sites where the photo IS the content (donation photos, success-story
   * images) so the whole thing stays visible instead of being cropped to
   * fill the frame.
   */
  resizeMode?: ImageResizeMode;
}

/**
 * Institution UX follow-up (2026-07-31) — "never leave an empty space" when a
 * photo is missing, AND gracefully degrade if a stored URL fails to load
 * (found via a real bug: existing Drive URLs used a format blocked by
 * Cross-Origin-Resource-Policy — see apps/api/src/config/drive.ts fix).
 */
export function Photo({ uri, style, placeholderIcon = '📷', resizeMode = 'cover' }: PhotoProps) {
  const [errored, setErrored] = useState(false);

  if (!uri || errored) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.icon}>{placeholderIcon}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[resizeMode === 'contain' && styles.containBg, style]}
      resizeMode={resizeMode}
      onError={() => setErrored(true)}
    />
  );
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
  // 'contain' can letterbox (image doesn't fill the frame) — a matching
  // background reads as intentional framing instead of a rendering bug.
  containBg: {
    backgroundColor: colors.surface2,
  },
});
