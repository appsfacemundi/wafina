/**
 * `getReactNativePersistence` is Firebase's own documented API for RN (see the
 * doc comment on the real implementation in
 * @firebase/auth/dist/.../platform_react_native/persistence/react_native.d.ts,
 * which shows this exact import). Metro resolves it correctly via the
 * "react-native" export condition at runtime; tsc's package-export resolution
 * doesn't follow that condition through firebase/auth's nested exports map,
 * so it's declared here to keep the real signature instead of using `any`.
 */
export {}; // Makes this a module, so the block below augments firebase/auth instead of replacing it.

declare module 'firebase/auth' {
  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }

  // Persistence is already declared by the real module this merges with.
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
