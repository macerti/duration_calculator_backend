import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { api } from "../api/client";
import { API_BASE_URL } from "../config/api";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

type HealthState =
  | { status: "loading" }
  | { status: "ok"; parameterSetId: string; version: number; dbConnected: boolean; dbBackedParameters: boolean }
  | { status: "error"; message: string };

export default function HomeScreen({ navigation }: Props) {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setHealth({
        status: "ok",
        parameterSetId: h.parameterSetId,
        version: h.version,
        dbConnected: h.dbConnected,
        dbBackedParameters: h.dbBackedParameters,
      });
    } catch (e: any) {
      setHealth({ status: "error", message: e.message });
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkHealth();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Audit Duration Calculator</Text>
      <Text style={styles.subtitle}>GS0106 / IAF MD5 / MD1 / MD11 engine</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>API connection</Text>
        {health.status === "loading" && <ActivityIndicator />}
        {health.status === "error" && (
          <>
            <Text style={styles.statusBad}>Unreachable</Text>
            <Text style={styles.statusDetail}>{health.message}</Text>
            <Text style={styles.statusDetail}>Trying: {API_BASE_URL}</Text>
          </>
        )}
        {health.status === "ok" && (
          <>
            <Text style={styles.statusGood}>Connected</Text>
            <Text style={styles.statusDetail}>
              Parameter set: {health.parameterSetId} (v{health.version})
            </Text>
            <Text style={styles.statusDetail}>
              Database: {health.dbConnected ? "connected" : "not connected (using in-memory bootstrap)"}
            </Text>
            {health.dbConnected && !health.dbBackedParameters && (
              <Text style={styles.statusWarn}>DB connected but no active parameter set — run db:seed on the server.</Text>
            )}
          </>
        )}
      </View>

      <Pressable style={styles.navButton} onPress={() => navigation.navigate("NaeCalculator")}>
        <Text style={styles.navButtonText}>NAE Calculator</Text>
        <Text style={styles.navButtonSubtext}>Compute adjusted headcount for a site</Text>
      </Pressable>

      <Pressable style={styles.navButton} onPress={() => navigation.navigate("CaseBuilder")}>
        <Text style={styles.navButtonText}>Case Calculator</Text>
        <Text style={styles.navButtonSubtext}>Full audit duration calculation (single site, multi-standard)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 24, fontWeight: "700", marginTop: 40 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  statusCard: { backgroundColor: "#f5f5f7", borderRadius: 12, padding: 16, marginBottom: 24 },
  statusLabel: { fontSize: 12, color: "#888", textTransform: "uppercase", marginBottom: 6 },
  statusGood: { color: "#1a7f37", fontWeight: "700", fontSize: 16 },
  statusBad: { color: "#c53030", fontWeight: "700", fontSize: 16 },
  statusWarn: { color: "#b7791f", marginTop: 4, fontSize: 12 },
  statusDetail: { color: "#555", fontSize: 12, marginTop: 4 },
  navButton: { backgroundColor: "#1c1c1e", borderRadius: 12, padding: 18, marginBottom: 12 },
  navButtonDisabled: { backgroundColor: "#3a3a3c" },
  navButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  navButtonSubtext: { color: "#aaa", fontSize: 12, marginTop: 4 },
});
