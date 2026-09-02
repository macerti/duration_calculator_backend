import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { api } from "../api/client";
import { colors, radius, spacing, typography } from "../theme/tokens";

type State = "loading" | "ok" | "error";

export default function StatusPill() {
  const [state, setState] = useState<State>("loading");
  const [detail, setDetail] = useState<string>("");

  const check = useCallback(async () => {
    try {
      const h = await api.health();
      setState("ok");
      setDetail(h.dbConnected ? "Connecté" : "Mode local (sans BDD)");
    } catch {
      setState("error");
      setDetail("API injoignable");
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const color = state === "ok" ? colors.success : state === "error" ? colors.error : colors.contentQuaternary;

  return (
    <Pressable style={styles.pill} onPress={check}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{state === "loading" ? "Vérification…" : detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  text: { fontSize: typography.caption, color: colors.contentSecondary },
});
