import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import StatusPill from "../components/StatusPill";
import ResponsiveContainer from "../components/ResponsiveContainer";
import { colors, radius } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  return (
    <ResponsiveContainer maxWidth={600}>
      <View style={styles.container}>
        <StatusPill />

        <Text style={styles.title}>Audit Duration Calculator</Text>
        <Text style={styles.subtitle}>GS0106 / IAF MD5 / MD1 / MD11</Text>

        <Pressable style={styles.ctaButton} onPress={() => navigation.navigate("ClientsList")}>
          <Text style={styles.ctaButtonText}>Mes clients</Text>
          <Text style={styles.ctaButtonSubtext}>Créer ou reprendre un calcul de durée d'audit</Text>
        </Pressable>
      </View>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  title: { fontSize: 24, fontWeight: "700", marginTop: 16 },
  subtitle: { fontSize: 13, color: colors.contentTertiary, marginBottom: 32 },
  ctaButton: { backgroundColor: colors.actionPrimary, borderRadius: radius.xxl, padding: 22 },
  ctaButtonText: { color: colors.contentInverse, fontSize: 17, fontWeight: "700" },
  ctaButtonSubtext: { color: colors.contentDisabled, fontSize: 12, marginTop: 6 },
});
