import React, { useEffect } from "react";
import { Platform, View, StyleSheet, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ToastProvider } from "./src/components/Toast";
import ErrorBoundary from "./src/components/ErrorBoundary";
import VersionFooter from "./src/components/VersionFooter";
import { useAuth } from "./src/hooks/useAuth";
import LoginScreen from "./src/screens/LoginScreen";
import { colors } from "./src/theme/tokens";

import HomeScreen from "./src/screens/HomeScreen";
import ClientsListScreen from "./src/screens/ClientsListScreen";
import ClientDetailScreen from "./src/screens/ClientDetailScreen";
import CalculationWizardScreen, { WizardSite } from "./src/screens/CalculationWizardScreen";
import CalculationReportScreen from "./src/screens/CalculationReportScreen";

export type RootStackParamList = {
  Home: undefined;
  ClientsList: undefined;
  ClientDetail: { clientId: number; clientName: string };
  CalculationWizard: { clientId: number; clientName: string; caseId?: number };
  CalculationReport: {
    clientId: number;
    clientName: string;
    dossierRef: string;
    sites: WizardSite[];
    result: any;
    roundingOverrides: Record<string, number>;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * AuthGate — sits between the outer ErrorBoundary/ToastProvider shell and
 * the actual navigation stack. It checks the PHP session (GET /auth/me)
 * before rendering anything:
 *
 *  - Loading  → blank screen with a spinner (< 1 s in practice)
 *  - Not auth → LoginScreen with Microsoft + Google buttons
 *  - Auth OK  → full app navigation stack
 *
 * The actual OAuth dance happens entirely in the PHP backend; the frontend
 * only redirects the browser to /api/auth/microsoft (or /google) and
 * lets PHP handle Microsoft/Google, the code exchange, and the session cookie.
 * On return (/?auth=ok), this component re-fetches /auth/me and the session
 * is now valid → app shows normally.
 */
function AuthGate() {
  const { isLoading, isAuthenticated, error, loginWithMicrosoft, loginWithGoogle } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.contentTertiary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onMicrosoft={loginWithMicrosoft}
        onGoogle={loginWithGoogle}
        error={error}
      />
    );
  }

  // Authenticated: render the full navigation stack.
  return (
    <View style={styles.navArea}>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Audit Duration Calculator" }} />
          <Stack.Screen name="ClientsList" component={ClientsListScreen} options={{ title: "Mes clients" }} />
          <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: "Client" }} />
          <Stack.Screen
            name="CalculationWizard"
            component={CalculationWizardScreen}
            options={{ title: "Calcul", headerShown: false }}
          />
          <Stack.Screen
            name="CalculationReport"
            component={CalculationReportScreen}
            options={{ title: "Rapport de calcul", headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  // Mobile web: a native browser "pull down to reload" gesture would reload
  // the whole page and wipe all in-progress wizard state. This disables that
  // specific browser gesture (vertical overscroll bounce/refresh) without
  // touching horizontal scroll or the app's own scroll views — the app has
  // no custom pull-to-refresh of its own yet (see ROADMAP.md), so for now
  // the only correct behavior is "never lose data to this gesture."
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.style.overscrollBehaviorY = "contain";
      document.body.style.overscrollBehaviorY = "contain";
    }
  }, []);

  return (
    <ErrorBoundary onGoHome={() => Platform.OS === "web" && typeof window !== "undefined" && window.location.reload()}>
      <ToastProvider>
        <View style={styles.root}>
          {/* Auth gate: handles login/loading/app rendering */}
          <AuthGate />
          {/* FEAT-003: version/last-update footer, visible on every screen
              regardless of which stack screen is active — kept as a sibling
              of the navigator rather than per-screen so there is exactly
              one place this can drift out of sync. */}
          <VersionFooter />
        </View>
      </ToastProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navArea: { flex: 1 },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceSunken,
  },
});
