import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { SplashView } from '@/components/SplashView';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { AvailableDonationsScreen } from '@/screens/AvailableDonationsScreen';
import { ClaimedByMeScreen } from '@/screens/ClaimedByMeScreen';
import { DisputesListScreen } from '@/screens/DisputesListScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { MySuccessStoriesScreen } from '@/screens/MySuccessStoriesScreen';
import { NewDisputeScreen } from '@/screens/NewDisputeScreen';
import { NewSuccessStoryScreen } from '@/screens/NewSuccessStoryScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { SignInScreen } from '@/screens/SignInScreen';
import { SignUpScreen } from '@/screens/SignUpScreen';
import { VerificationStatusScreen } from '@/screens/VerificationStatusScreen';
import { colors, radius } from '@/theme/tokens';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type OnboardingStackParamList = {
  Register: undefined;
};

export type VerificationStackParamList = {
  VerificationStatus: undefined;
};

export type DisputesStackParamList = {
  DisputesList: undefined;
  /** publicCode is the only donation identifier ever shown on screen — donationId is API-only. */
  NewDispute: { donationId: string; publicCode: string };
};

export type ClaimedByMeStackParamList = {
  // Real-device finding, 2026-08-07 — a "donation claimed/estimate changed"
  // notification always landed on the generic top of this list, never the
  // specific donation it was about. donationId lets it deep-link to one.
  ClaimedByMeList: { donationId?: string } | undefined;
  /** publicCode is the only donation identifier ever shown on screen — donationId is API-only. */
  NewSuccessStory: { donationId: string; publicCode: string };
  MySuccessStories: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  AvailableDonations: undefined;
  ClaimedByMe:
    | {
        screen?: keyof ClaimedByMeStackParamList;
        params?: ClaimedByMeStackParamList['NewSuccessStory'] | ClaimedByMeStackParamList['ClaimedByMeList'];
      }
    | undefined;
  Disputes: { screen?: keyof DisputesStackParamList; params?: DisputesStackParamList['NewDispute'] } | undefined;
  Notifications: undefined;
  Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const VerificationStack = createNativeStackNavigator<VerificationStackParamList>();
const DisputesStack = createNativeStackNavigator<DisputesStackParamList>();
const ClaimedByMeStack = createNativeStackNavigator<ClaimedByMeStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();

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

function DisputesNavigator() {
  return (
    <DisputesStack.Navigator screenOptions={{ headerShown: false }}>
      <DisputesStack.Screen name="DisputesList" component={DisputesListScreen} />
      <DisputesStack.Screen name="NewDispute" component={NewDisputeScreen} />
    </DisputesStack.Navigator>
  );
}

function ClaimedByMeNavigator() {
  return (
    <ClaimedByMeStack.Navigator screenOptions={{ headerShown: false }}>
      <ClaimedByMeStack.Screen name="ClaimedByMeList" component={ClaimedByMeScreen} />
      <ClaimedByMeStack.Screen name="NewSuccessStory" component={NewSuccessStoryScreen} />
      <ClaimedByMeStack.Screen name="MySuccessStories" component={MySuccessStoriesScreen} />
    </ClaimedByMeStack.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { institution, loading: institutionLoading, refetch: refetchInstitution } = useOwnInstitution();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Real-device finding, 2026-08-07 — both of these used to render nothing,
  // which showed as a jarring blank white flash between the branded
  // SplashView (App.tsx) finishing and the sign-in/next screen appearing.
  // Keeping SplashView on screen through both gaps makes the transition
  // continuous instead of a splash, a white flash, then the real screen.
  if (authLoading) return <SplashView />;

  return (
    <NavigationContainer>
      {!session ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="SignIn" component={SignInScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
        </AuthStack.Navigator>
      ) : institutionLoading ? (
        <SplashView />
      ) : !institution ? (
        <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
          <OnboardingStack.Screen name="Register">
            {() => <RegisterScreen onRegistered={refetchInstitution} />}
          </OnboardingStack.Screen>
        </OnboardingStack.Navigator>
      ) : !institution.Verified ? (
        <VerificationStack.Navigator screenOptions={{ headerShown: false }}>
          <VerificationStack.Screen name="VerificationStatus" component={VerificationStatusScreen} />
        </VerificationStack.Navigator>
      ) : (
        <>
        <AppTab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textFaint,
            tabBarStyle: {
              backgroundColor: colors.surface,
              // Navigation step, 2026-08-07 — rounded top corners + a soft
              // upward shadow read as a deliberately designed surface,
              // rather than the flat 1px border every default tab bar ships
              // with.
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
            name="AvailableDonations"
            component={AvailableDonationsScreen}
            options={{ tabBarLabel: tabLabel(t('nav.availableDonations')), tabBarIcon: tabIcon('cube') }}
          />
          <AppTab.Screen
            name="ClaimedByMe"
            component={ClaimedByMeNavigator}
            options={{ tabBarLabel: tabLabel(t('nav.claimedDonations')), tabBarIcon: tabIcon('checkmark-circle') }}
          />
          <AppTab.Screen
            name="Disputes"
            component={DisputesNavigator}
            options={{ tabBarLabel: tabLabel(t('nav.disputes')), tabBarIcon: tabIcon('alert-circle') }}
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
        <WhatsAppFloat />
        </>
      )}
    </NavigationContainer>
  );
}
