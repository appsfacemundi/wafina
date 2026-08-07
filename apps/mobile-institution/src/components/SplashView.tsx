import { Image, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import iconMark from '../../assets/icon-mark.png';

/**
 * JS-rendered splash, shown while fonts load. `expo-splash-screen`'s
 * app.json config (blue/navy background + this same mark) only applies to
 * a real native build — Expo Go ignores it entirely, since it's a generic
 * pre-built client that can't run app-specific native config. This
 * component renders the identical design in JS so it's actually visible
 * (and testable) through Expo Go, not just in a future production build.
 */
export function SplashView() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const bg = scheme === 'dark' ? '#0F172A' : '#0057D9';

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <View style={styles.plate}>
        <Image source={iconMark} style={styles.mark} resizeMode="contain" />
      </View>
      <Text style={[styles.tagline, { bottom: insets.bottom + 32 }]}>DOAR HOJE, TRANSFORMAR AMANHÃ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plate: {
    width: 208,
    height: 208,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  mark: {
    width: 150,
    height: 150,
  },
  tagline: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#ffffff',
    fontFamily: 'PlusJakartaSans-600',
    fontSize: 13,
    letterSpacing: 0.6,
    opacity: 0.92,
  },
});
