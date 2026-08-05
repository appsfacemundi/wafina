import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
// getReactNativePersistence is declared in src/types/firebase-auth-rn.d.ts —
// see that file for why tsc needs the assist here.
import { browserLocalPersistence, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// Web is a dev-only preview target (never shipped) used to sanity-check UI
// changes in a browser before an EAS build — getReactNativePersistence
// doesn't exist on Firebase's web build and throws if called there.
export const firebaseAuth = initializeAuth(app, {
  persistence: Platform.OS === 'web' ? browserLocalPersistence : getReactNativePersistence(AsyncStorage),
});
