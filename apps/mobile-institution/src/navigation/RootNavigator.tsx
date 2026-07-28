import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { AvailableDonationsScreen } from '@/screens/AvailableDonationsScreen';
import { ClaimedByMeScreen } from '@/screens/ClaimedByMeScreen';
import { DisputesListScreen } from '@/screens/DisputesListScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { NewDisputeScreen } from '@/screens/NewDisputeScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { SignInScreen } from '@/screens/SignInScreen';
import { SignUpScreen } from '@/screens/SignUpScreen';
import { VerificationStatusScreen } from '@/screens/VerificationStatusScreen';
import { colors } from '@/theme/tokens';

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
  NewDispute: { donationId: string };
};

export type AppTabParamList = {
  Home: undefined;
  AvailableDonations: undefined;
  ClaimedByMe: undefined;
  Disputes: { screen?: keyof DisputesStackParamList; params?: DisputesStackParamList['NewDispute'] } | undefined;
  Notifications: undefined;
  Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const VerificationStack = createNativeStackNavigator<VerificationStackParamList>();
const DisputesStack = createNativeStackNavigator<DisputesStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();

function tabLabel(label: string) {
  return ({ color }: { color: string }) => (
    <Text
      style={{ fontFamily: 'WorkSans-600', fontSize: 9.5, color, textAlign: 'center' }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {label}
    </Text>
  );
}

function DisputesNavigator() {
  return (
    <DisputesStack.Navigator screenOptions={{ headerShown: false }}>
      <DisputesStack.Screen name="DisputesList" component={DisputesListScreen} />
      <DisputesStack.Screen name="NewDispute" component={NewDisputeScreen} />
    </DisputesStack.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { institution, loading: institutionLoading, refetch: refetchInstitution } = useOwnInstitution();

  // Nothing renders while Firebase resolves the initial auth state, or (once
  // signed in) while we're finding out whether an institution profile exists
  // yet — avoids a flash of the wrong screen for an already-registered user.
  if (authLoading) return null;

  return (
    <NavigationContainer>
      {!session ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="SignIn" component={SignInScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
        </AuthStack.Navigator>
      ) : institutionLoading ? null : !institution ? (
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
        <AppTab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textFaint,
            tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
            tabBarLabelStyle: { fontFamily: 'WorkSans-600', fontSize: 10 },
          }}
        >
          <AppTab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: tabLabel('Início') }} />
          <AppTab.Screen
            name="AvailableDonations"
            component={AvailableDonationsScreen}
            options={{ tabBarLabel: tabLabel('Disponíveis') }}
          />
          <AppTab.Screen
            name="ClaimedByMe"
            component={ClaimedByMeScreen}
            options={{ tabBarLabel: tabLabel('Reclamadas') }}
          />
          <AppTab.Screen
            name="Disputes"
            component={DisputesNavigator}
            options={{ tabBarLabel: tabLabel('Disputas') }}
          />
          <AppTab.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ tabBarLabel: tabLabel('Notificações') }}
          />
          <AppTab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ tabBarLabel: tabLabel('Definições') }}
          />
        </AppTab.Navigator>
      )}
    </NavigationContainer>
  );
}
