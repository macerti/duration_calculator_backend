import React, { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ToastProvider } from "./src/components/Toast";
import ErrorBoundary from "./src/components/ErrorBoundary";

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
    clientName: string;
    dossierRef: string;
    sites: WizardSite[];
    result: any;
    roundingOverrides: Record<string, number>;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
              options={{ title: "Rapport de calcul" }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </ToastProvider>
    </ErrorBoundary>
  );
}
