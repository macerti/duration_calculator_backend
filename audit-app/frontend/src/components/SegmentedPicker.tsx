import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}

export default function SegmentedPicker<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
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
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, color: "#444", marginBottom: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff" },
  segmentActive: { backgroundColor: "#1c1c1e", borderColor: "#1c1c1e" },
  segmentText: { fontSize: 13, color: "#333" },
  segmentTextActive: { color: "#fff", fontWeight: "600" },
});
