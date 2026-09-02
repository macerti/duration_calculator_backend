import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}

export default function SegmentedPicker<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      {label !== "" && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onChange(opt.value)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md + 2 },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  segment: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surfaceBase },
  segmentActive: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  segmentText: { fontSize: typography.body, color: colors.contentSecondary },
  segmentTextActive: { color: colors.contentInverse, fontWeight: "600" },
});
