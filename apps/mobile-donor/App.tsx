import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { RootNavigator } from '@/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    'Fraunces-600': require('./assets/fonts/fraunces-600.ttf'),
    'Fraunces-Italic-400': require('./assets/fonts/fraunces-italic-400.ttf'),
    'WorkSans-400': require('./assets/fonts/worksans-400.ttf'),
    'WorkSans-600': require('./assets/fonts/worksans-600.ttf'),
    'WorkSans-700': require('./assets/fonts/worksans-700.ttf'),
    'PlexMono-400': require('./assets/fonts/plexmono-400.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
