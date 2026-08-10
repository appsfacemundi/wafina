import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { SplashView } from '@/components/SplashView';
import { DonateScreen } from '@/screens/DonateScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { ImpactScreen } from '@/screens/ImpactScreen';
import { InstitutionsScreen } from '@/screens/InstitutionsScreen';
import { MyDonationsScreen } from '@/screens/MyDonationsScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { OnboardingProfileScreen } from '@/screens/OnboardingProfileScreen';
import { ReceberScreen } from '@/screens/ReceberScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { SignInScreen } from '@/screens/SignInScreen';
import { SignUpScreen } from '@/screens/SignUpScreen';
import { SwitchCountryPrompt } from '@/components/SwitchCountryPrompt';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { colors, radius } from '@/theme/tokens';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type OnboardingStackParamList = {
  OnboardingProfile: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Impact: undefined;
  // Real-device finding, 2026-08-07 — a "donation claimed/delivered"
  // notification always landed on the generic top of this list, never the
  // specific donation it was about, because there was no way to pass one
  // through. `donationId` lets NotificationsScreen deep-link to it.
  MyDonations: { donationId?: string } | undefined;
  Institutions: undefined;
  Notifications: undefined;
  Settings: undefined;
};

// UX follow-up, 2026-08-07 — Donate lives outside the tab bar entirely now
// (reached only via HomeScreen's "Doar agora" button), rather than as a
// screen registered on the tab navigator with a hidden button. The earlier
// `tabBarButton: () => null` approach still reserved that tab's full-width
// flex slot even with nothing rendered in it, leaving a dead gap in the bar
// (confirmed via a real-device report) — bottom-tab layout has no way to
// exclude a registered screen from taking a slot short of not registering it
// there at all. Wrapping the tabs in this outer stack, with Donate as a
// sibling screen instead of a tab, is what actually removes the slot.
export type RootStackParamList = {
  Tabs: { screen?: keyof AppTabParamList } | undefined;
  Donate: undefined;
  // RC1 RECEBER — same off-tab-bar sibling pattern as Donate (see the comment
  // above RootStackParamList): reached only via HomeScreen's card, never a
  // registered tab.
  Receber: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function tabLabel(label: string) {
  return ({ color }: { color: string }) => (
    <Text
      style={{ fontFamily: 'Manrope-600', fontSize: 11.5, color, textAlign: 'center' }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {label}
    </Text>
  );
}

// Real-device finding, 2026-08-05: six text-only tabs at 9.5px were reported
// as too small to reliably tap. Icons don't change each tab's tap-target
// width (fixed by having six tabs), but they do make each one instantly
// recognizable without reading the shrunk label, and the taller bar below
// gives more forgiving vertical tap room.
//
// Navigation step, 2026-08-07 — the active tab now gets a soft pill behind
// its icon instead of relying on tint color alone to show selection state,
// matching the numbered-badge/chip visual language introduced elsewhere in
// this redesign rather than looking like a leftover default tab bar.
function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={[navStyles.iconWrap, focused && navStyles.iconWrapActive]}>
      <Ionicons name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)} size={24} color={color} />
    </View>
  );
}

const navStyles = StyleSheet.create({
  iconWrap: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  iconWrapActive: {
    backgroundColor: colors.accentSoft,
  },
});

function AppTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <AppTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          // Navigation step, 2026-08-07 — rounded top corners + a soft
          // upward shadow read as a deliberately designed surface, rather
          // than the flat 1px border every default tab bar ships with.
          borderTopWidth: 0,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 12,
          // React Navigation uses a custom `height` as-is — unlike its own
          // default sizing, it does NOT add insets.bottom on top — but
          // still applies insets.bottom as inner padding. A fixed height
          // that didn't account for that padding on a real device (3
          // button nav or gesture nav both report a non-zero inset here)
          // squeezed the icon+label into a sliver. Adding insets.bottom
          // to the total height, matching what React Navigation's own
          // default does, fixes it.
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        tabBarItemStyle: { paddingVertical: 3 },
        tabBarLabelStyle: { fontFamily: 'Manrope-600', fontSize: 11 },
      }}
    >
      <AppTab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: tabLabel(t('nav.home')), tabBarIcon: tabIcon('home') }}
      />
      <AppTab.Screen
        name="Impact"
        component={ImpactScreen}
        // UX follow-up, 2026-08-07 — promoted from a small text link buried
        // inside MyDonationsScreen to its own tab, filling the slot Donate
        // left behind (see RootStackParamList comment) instead of leaving it
        // empty.
        options={{ tabBarLabel: tabLabel(t('nav.impact')), tabBarIcon: tabIcon('heart') }}
      />
      <AppTab.Screen
        name="MyDonations"
        component={MyDonationsScreen}
        options={{ tabBarLabel: tabLabel(t('nav.myDonations')), tabBarIcon: tabIcon('receipt') }}
      />
      <AppTab.Screen
        name="Institutions"
        component={InstitutionsScreen}
        options={{ tabBarLabel: tabLabel(t('nav.institutions')), tabBarIcon: tabIcon('business') }}
      />
      <AppTab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarLabel: tabLabel(t('nav.notifications')), tabBarIcon: tabIcon('notifications') }}
      />
      <AppTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: tabLabel(t('nav.settings')), tabBarIcon: tabIcon('settings') }}
      />
    </AppTab.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();

  // Real-device finding, 2026-08-07 — this used to render nothing while
  // Firebase resolves the initial auth state, which showed as a jarring
  // blank white flash between the branded SplashView (App.tsx) finishing
  // and the sign-in screen appearing. Keeping SplashView on screen through
  // this gap as well makes the transition continuous instead of two splashes
  // with a white gap between them.
  if (loading) return <SplashView />;

  return (
    <NavigationContainer>
      {!session ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="SignIn" component={SignInScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
        </AuthStack.Navigator>
      ) : !session.profileComplete ? (
        <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
          <OnboardingStack.Screen name="OnboardingProfile" component={OnboardingProfileScreen} />
        </OnboardingStack.Navigator>
      ) : (
        <>
        <SwitchCountryPrompt />
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Tabs" component={AppTabs} />
          <RootStack.Screen name="Donate" component={DonateScreen} options={{ presentation: 'modal' }} />
          <RootStack.Screen name="Receber" component={ReceberScreen} />
        </RootStack.Navigator>
        <WhatsAppFloat />
        </>
      )}
    </NavigationContainer>
  );
}
