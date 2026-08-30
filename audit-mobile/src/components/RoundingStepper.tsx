import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props {
  label: string;
  calculatedValue: number | null | undefined; // raw engine output; may be missing on data saved before this field existed
  value: number | null | undefined; // current (possibly manually adjusted) value
  onChange: (v: number) => void;
  step?: number;
}

/**
 * Suggests the nearest "clean" quarter-day above the calculated value —
 * a guide only, never applied automatically. Rule: 0.00–0.25 → 0.25,
 * 0.26–0.50 → 0.50, 0.51–0.75 → 0.75, 0.76–1.00 → next whole day. This is
 * exactly ceil(x × 4) / 4 — verified against every boundary example given.
 */
function roundUpToQuarterGuide(value: number): number {
  return Math.ceil(value * 4) / 4;
}

export default function RoundingStepper({ label, calculatedValue, value, onChange, step = 0.25 }: Props) {
  // Guards data saved before this field existed (older engine versions
  // didn't compute per-visit report-writing) — without this, reading
  // .toFixed() on undefined crashes the whole screen. See BUGLOG.
  const safeCalculated = typeof calculatedValue === "number" && !Number.isNaN(calculatedValue) ? calculatedValue : 0;
  const safeValue = typeof value === "number" && !Number.isNaN(value) ? value : safeCalculated;

  const isAdjusted = Math.abs(safeValue - safeCalculated) > 0.001;
  const guide = roundUpToQuarterGuide(safeCalculated);
  const guideDiffersFromCalculated = Math.abs(guide - safeCalculated) > 0.001;

  const nudge = (delta: number) => {
    const next = Math.max(0, Math.round((safeValue + delta) * 100) / 100);
    onChange(next);
  };

  const reset = () => onChange(safeCalculated);
  const applyGuide = () => onChange(guide);

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.calculated}>
          Calculé : {safeCalculated.toFixed(2)} j{isAdjusted ? " (ajusté manuellement)" : ""}
        </Text>
        {guideDiffersFromCalculated && (
          <Pressable onPress={applyGuide}>
            <Text style={styles.guide}>suggestion : {guide.toFixed(2)} j</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.control}>
        <Pressable style={styles.stepBtn} onPress={() => nudge(-step)}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{safeValue.toFixed(2)}</Text>
        <Pressable style={styles.stepBtn} onPress={() => nudge(step)}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
      {isAdjusted && (
        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={styles.resetText}>↺</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  label: { fontSize: typography.body, color: colors.contentSecondary, fontWeight: "600" },
  calculated: { fontSize: typography.caption, color: colors.contentQuaternary, marginTop: 2 },
  guide: { fontSize: typography.caption, color: colors.contentTertiary, marginTop: 1, fontStyle: "italic" },
  control: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSunken, borderRadius: radius.md, marginLeft: spacing.sm },
  stepBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontSize: 18, color: colors.contentSecondary, fontWeight: "600" },
  value: { fontSize: typography.bodyLarge, fontWeight: "700", color: colors.contentPrimary, minWidth: 46, textAlign: "center" },
  resetBtn: { marginLeft: 6, padding: 6 },
  resetText: { fontSize: 16, color: colors.link },
});
