import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { DonateScreen } from '@/screens/DonateScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { ImpactScreen } from '@/screens/ImpactScreen';
import { InstitutionsScreen } from '@/screens/InstitutionsScreen';
import { MyDonationsScreen } from '@/screens/MyDonationsScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { OnboardingProfileScreen } from '@/screens/OnboardingProfileScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { SignInScreen } from '@/screens/SignInScreen';
import { SignUpScreen } from '@/screens/SignUpScreen';
import { SwitchCountryPrompt } from '@/components/SwitchCountryPrompt';
import { colors } from '@/theme/tokens';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type OnboardingStackParamList = {
  OnboardingProfile: undefined;
};

export type MyDonationsStackParamList = {
  MyDonationsList: undefined;
  Impact: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Donate: undefined;
  MyDonations: { screen?: keyof MyDonationsStackParamList } | undefined;
  Institutions: undefined;
  Notifications: undefined;
  Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();
const MyDonationsStack = createNativeStackNavigator<MyDonationsStackParamList>();

function MyDonationsNavigator() {
  return (
    <MyDonationsStack.Navigator screenOptions={{ headerShown: false }}>
      <MyDonationsStack.Screen name="MyDonationsList" component={MyDonationsScreen} />
      <MyDonationsStack.Screen name="Impact" component={ImpactScreen} />
    </MyDonationsStack.Navigator>
  );
}

function tabLabel(label: string) {
  return ({ color }: { color: string }) => (
    <Text
      style={{ fontFamily: 'WorkSans-600', fontSize: 10.5, color, textAlign: 'center' }}
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
function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)} size={22} color={color} />
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();

  // Nothing renders while Firebase resolves the initial auth state — avoids a
  // flash of the sign-in screen for already-authenticated users on cold start.
  if (loading) return null;

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
        <AppTab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textFaint,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: 68,
              paddingTop: 8,
              paddingBottom: 10,
            },
            tabBarItemStyle: { paddingVertical: 2 },
            tabBarLabelStyle: { fontFamily: 'WorkSans-600', fontSize: 10 },
          }}
        >
          <AppTab.Screen
            name="Home"
            component={HomeScreen}
            options={{ tabBarLabel: tabLabel('Início'), tabBarIcon: tabIcon('home') }}
          />
          <AppTab.Screen
            name="Donate"
            component={DonateScreen}
            options={{ tabBarLabel: tabLabel('Doar'), tabBarIcon: tabIcon('gift') }}
          />
          <AppTab.Screen
            name="MyDonations"
            component={MyDonationsNavigator}
            options={{ tabBarLabel: tabLabel('Doações'), tabBarIcon: tabIcon('receipt') }}
          />
          <AppTab.Screen
            name="Institutions"
            component={InstitutionsScreen}
            options={{ tabBarLabel: tabLabel('Instituições'), tabBarIcon: tabIcon('business') }}
          />
          <AppTab.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ tabBarLabel: tabLabel('Notificações'), tabBarIcon: tabIcon('notifications') }}
          />
          <AppTab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ tabBarLabel: tabLabel('Definições'), tabBarIcon: tabIcon('settings') }}
          />
        </AppTab.Navigator>
        </>
      )}
    </NavigationContainer>
  );
}
