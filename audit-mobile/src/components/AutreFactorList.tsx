import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

export interface AutreFactorEntry {
  id: string;
  label: string;
  valuePercent: string; // stored as string for controlled-input editing, parsed on submit
  justification: string;
}

interface Props {
  direction: "augmentation" | "reduction";
  entries: AutreFactorEntry[];
  onChange: (next: AutreFactorEntry[]) => void;
}

let counter = 0;
export function emptyAutreEntry(): AutreFactorEntry {
  counter += 1;
  return { id: `autre-${Date.now()}-${counter}`, label: "", valuePercent: "", justification: "" };
}

/** Unlimited "Autre" (custom) factor entries, each with its own label,
 * percentage, and dedicated justification — as many as the calculation
 * actually needs, not capped at one. */
export default function AutreFactorList({ direction, entries, onChange }: Props) {
  const add = () => onChange([...entries, emptyAutreEntry()]);
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const update = (id: string, patch: Partial<AutreFactorEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const title = direction === "augmentation" ? "Autre(s) — augmentation" : "Autre(s) — réduction";

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {entries.map((entry, i) => (
        <View key={entry.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIndex}>#{i + 1}</Text>
            <Pressable onPress={() => remove(entry.id)}>
              <Text style={styles.removeText}>Retirer</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.labelInput}
            value={entry.label}
            onChangeText={(label) => update(entry.id, { label })}
            placeholder="Motif (ex: contexte spécifique au client)"
            placeholderTextColor={colors.contentQuaternary}
          />
          <View style={styles.valueRow}>
            <Text style={styles.valueSign}>{direction === "augmentation" ? "+" : "-"}</Text>
            <TextInput
              style={styles.valueInput}
              keyboardType="numeric"
              value={entry.valuePercent}
              onChangeText={(valuePercent) => update(entry.id, { valuePercent })}
              placeholder="0"
              placeholderTextColor={colors.contentQuaternary}
            />
            <Text style={styles.pct}>%</Text>
          </View>
          <TextInput
            style={styles.justificationInput}
            value={entry.justification}
            onChangeText={(justification) => update(entry.id, { justification })}
            placeholder="Justification (obligatoire pour cette entrée)"
            placeholderTextColor={colors.contentQuaternary}
            multiline
          />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={add}>
        <Text style={styles.addButtonText}>+ Ajouter {direction === "augmentation" ? "une augmentation" : "une réduction"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  title: { fontWeight: "700", fontSize: typography.bodyLarge, marginBottom: spacing.sm, color: colors.contentPrimary },
  card: { backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.sm + 2, marginBottom: spacing.sm },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  cardIndex: { fontSize: typography.caption, color: colors.contentTertiary, fontWeight: "700" },
  removeText: { color: colors.error, fontSize: typography.small },
  labelInput: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 6, fontSize: typography.body, backgroundColor: colors.surfaceBase, marginBottom: 6 },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  valueSign: { fontSize: typography.body, color: colors.contentTertiary, fontWeight: "700" },
  valueInput: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 6, width: 60, fontSize: typography.body, backgroundColor: colors.surfaceBase },
  pct: { color: colors.contentQuaternary, fontSize: typography.body },
  justificationInput: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.sm, padding: 8, fontSize: typography.small, backgroundColor: colors.surfaceBase, minHeight: 44, textAlignVertical: "top" },
  addButton: { paddingVertical: 8, alignItems: "flex-start" },
  addButtonText: { color: colors.link, fontWeight: "600", fontSize: typography.body },
});
