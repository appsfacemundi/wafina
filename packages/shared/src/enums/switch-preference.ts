/**
 * Governs whether the app offers to switch Active Country when GPS detects the
 * user is somewhere else (Module 1, Phase 3A). Never drives an automatic switch
 * by itself — it only controls whether the prompt is shown at all.
 */
export const SWITCH_PREFERENCES = ['Always_Ask', 'Never_Ask_Automatically'] as const;
export type SwitchPreference = (typeof SWITCH_PREFERENCES)[number];
