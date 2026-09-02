import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { colors, typography } from "../theme/tokens";

export interface StepDef {
  key: string;
  label: string;
  shortLabel: string;
}

interface Props {
  steps: StepDef[];
  current: string;
  onSelect: (key: string) => void;
  completedKeys: string[]; // steps with enough data to be worth visiting
}

export default function StepTabs({ steps, current, onSelect, completedKeys }: Props) {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";

  return (
    <View style={[styles.wrap, isMobile ? styles.wrapMobile : styles.wrapDesktop]}>
      {steps.map((step, i) => {
        const active = step.key === current;
        const reachable = completedKeys.includes(step.key) || i === 0;
        return (
          <Pressable
            key={step.key}
            style={[styles.tab, active && styles.tabActive, !reachable && styles.tabDisabled]}
            onPress={() => reachable && onSelect(step.key)}
            disabled={!reachable}
          >
            <View style={[styles.stepNum, active && styles.stepNumActive]}>
              <Text style={[styles.stepNumText, active && styles.stepNumTextActive]}>{i + 1}</Text>
            </View>
            <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
              {isMobile ? step.shortLabel : step.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", backgroundColor: colors.surfaceBase },
  wrapMobile: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingBottom: 8,
    paddingTop: 6,
  },
  wrapDesktop: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, paddingVertical: 10, marginBottom: 10 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 6, gap: 4, flexDirection: "row", justifyContent: "center" },
  tabActive: {},
  tabDisabled: { opacity: 0.4 },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#e5e5e7", alignItems: "center", justifyContent: "center" },
  stepNumActive: { backgroundColor: colors.actionPrimary },
  stepNumText: { fontSize: typography.caption, fontWeight: "700", color: colors.contentTertiary },
  stepNumTextActive: { color: colors.contentInverse },
  tabText: { fontSize: typography.caption, color: colors.contentTertiary, fontWeight: "600" },
  tabTextActive: { color: colors.contentPrimary },
});
