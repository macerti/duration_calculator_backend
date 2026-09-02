import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
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

  // Editable field state (BUG-027 #3). The field mirrors `safeValue` as
  // text, except while the user is actively editing it — otherwise every
  // external update (+/-, reset, guide, or a parent recalculation) would
  // stomp on a keystroke mid-edit. Comma is accepted as a decimal
  // separator (fr-DZ/fr-FR keyboards) alongside period.
  const [text, setText] = useState(safeValue.toFixed(2));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(safeValue.toFixed(2));
    }
  }, [safeValue, isFocused]);

  const commitText = () => {
    const normalized = text.replace(",", ".").replace(/[^0-9.]/g, "");
    const parsed = parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      // Same two-decimal, non-negative rounding the +/- buttons already use,
      // so typed and stepped values can never diverge in precision.
      const clamped = Math.max(0, Math.round(parsed * 100) / 100);
      setText(clamped.toFixed(2));
      onChange(clamped);
    } else {
      // Empty or unparseable input reverts to the last valid value instead
      // of propagating NaN or leaving the field blank.
      setText(safeValue.toFixed(2));
    }
    setIsFocused(false);
  };

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
        <TextInput
          style={styles.value}
          value={text}
          onFocus={() => setIsFocused(true)}
          onChangeText={(t) => setText(t.replace(/[^0-9.,]/g, ""))}
          onBlur={commitText}
          onSubmitEditing={commitText}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          underlineColorAndroid="transparent"
        />
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
  value: {
    fontSize: typography.bodyLarge,
    fontWeight: "700",
    color: colors.contentPrimary,
    minWidth: 46,
    textAlign: "center",
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  resetBtn: { marginLeft: 6, padding: 6 },
  resetText: { fontSize: 16, color: colors.link },
});
