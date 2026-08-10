/**
 * Metro resolves `import x from './foo.png'` to a numeric asset ID at
 * bundle time (its own resolver, unrelated to tsc) — this repo has no
 * `expo-env.d.ts` and Expo's own ambient types (node_modules/expo/types)
 * only cover CSS modules, not images, so tsc has never had a type for a
 * `.png` import until now. Only surfaced once the brand-redesign screens
 * (SplashView, SignInScreen, SignUpScreen) started importing icon-mark.png
 * directly instead of referencing it via the Expo asset registry string path.
 */
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const value: ImageSourcePropType;
  export default value;
}
