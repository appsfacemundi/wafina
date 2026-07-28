import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ConfigurationError } from './configuration-error';
import { env, isFirebaseConfigured } from './env';

/**
 * Lazily initializes Firebase Admin so the server can boot (and /health can
 * respond) before a Firebase project exists. Anything that actually needs
 * auth gets a clear "not configured" error instead of a startup crash.
 */
export function getFirebaseAuth() {
  if (!isFirebaseConfigured()) {
    throw new ConfigurationError(
      'Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
    );
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        privateKey: env.firebase.privateKey,
      }),
    });
  }

  return getAuth();
}
