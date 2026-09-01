import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./src/screens/HomeScreen";
import NaeCalculatorScreen from "./src/screens/NaeCalculatorScreen";
import CaseBuilderScreen from "./src/screens/CaseBuilderScreen";

export type RootStackParamList = {
  Home: undefined;
  NaeCalculator: undefined;
  CaseBuilder: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Audit Duration Calculator" }} />
        <Stack.Screen name="NaeCalculator" component={NaeCalculatorScreen} options={{ title: "NAE Calculator" }} />
        <Stack.Screen name="CaseBuilder" component={CaseBuilderScreen} options={{ title: "Case Calculator" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
