import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';
import { SplashView } from '@/components/SplashView';
import { ToastProvider } from '@/context/ToastContext';
import i18n, { loadPersistedLanguage } from '@/i18n';
import { RootNavigator } from '@/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync();

// Brand Identity phase, 2026-08-07 — a real minimum so the on-brand
// SplashView (see its own comment) is actually visible on a fast connection
// instead of flashing for a few ms while fonts load, which are normally
// cached and near-instant.
const MIN_SPLASH_MS = 1200;

export default function App() {
  const [fontsLoaded] = useFonts({
    'Manrope-400': require('./assets/fonts/manrope-400.ttf'),
    'Manrope-600': require('./assets/fonts/manrope-600.ttf'),
    'Manrope-700': require('./assets/fonts/manrope-700.ttf'),
    'Manrope-800': require('./assets/fonts/manrope-800.ttf'),
    'PlusJakartaSans-600': require('./assets/fonts/plusjakartasans-600.ttf'),
    'PlexMono-400': require('./assets/fonts/plexmono-400.ttf'),
    // Tab bar icons — loaded explicitly here (rather than relying on
    // @expo/vector-icons' own async self-load on first mount) so they're
    // guaranteed ready before the tab bar's first paint.
    ...Ionicons.font,
  });
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  // Launch-critical, 2026-08-08 — restores a previously-chosen language (and
  // re-applies I18nManager's RTL flag for Arabic) before the real UI ever
  // renders, so a fresh launch after a restart-for-RTL comes up already
  // correctly oriented instead of flashing LTR first.
  const [langLoaded, setLangLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    loadPersistedLanguage().finally(() => setLangLoaded(true));
  }, []);

  useEffect(() => {
    // Dismiss the native/OS splash as soon as fonts are ready — SplashView
    // below takes over the screen immediately after, so there's no gap.
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded || !minTimeElapsed || !langLoaded) {
    return (
      <SafeAreaProvider>
        <SplashView />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </AuthProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
