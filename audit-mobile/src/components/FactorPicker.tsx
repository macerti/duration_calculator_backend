import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { api } from "../api/client";
import { FactorCatalogueItem, StandardCode } from "../types/engine";
import { colors, radius, spacing, typography } from "../theme/tokens";

export interface FactorSelectionState {
  ticked: { index: number; valuePercent: number }[];
}

interface Props {
  standard: StandardCode;
  direction: "augmentation" | "reduction";
  selection: FactorSelectionState;
  onChange: (next: FactorSelectionState) => void;
}

/**
 * Catalogue factor picker. Ticking a line defaults its value to the
 * catalogue's cap, but the value is then freely editable per-line — for
 * *this calculation only*, never changing the catalogue itself (see
 * ORIENTATIONS.md / the explicit request this implements).
 */
export default function FactorPicker({ standard, direction, selection, onChange }: Props) {
  const [items, setItems] = useState<FactorCatalogueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getParameters()
      .then((params) => {
        if (cancelled) return;
        const filtered = params.factorCatalogue.filter(
          (f) => f.standard === standard && f.direction === direction && f.index > 0
        );
        setItems(filtered);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [standard, direction]);

  const tickedEntry = (index: number) => selection.ticked.find((t) => t.index === index);

  const toggle = (item: FactorCatalogueItem) => {
    const sign = direction === "augmentation" ? 1 : -1;
    if (tickedEntry(item.index)) {
      onChange({ ticked: selection.ticked.filter((t) => t.index !== item.index) });
    } else {
      onChange({ ticked: [...selection.ticked, { index: item.index, valuePercent: item.capPercent * sign }] });
    }
  };

  const updateValue = (index: number, rawValue: string) => {
    const num = rawValue.trim() === "" ? 0 : Math.abs(Number(rawValue)) || 0;
    const sign = direction === "augmentation" ? 1 : -1;
    onChange({ ticked: selection.ticked.map((t) => (t.index === index ? { ...t, valuePercent: num * sign } : t)) });
  };

  const title = direction === "augmentation" ? "Facteurs d'augmentation" : "Facteurs de réduction";

  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!items) return <ActivityIndicator style={{ marginVertical: 10 }} />;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {items.map((item) => {
        const entry = tickedEntry(item.index);
        const ticked = !!entry;
        return (
          <View key={item.index} style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => toggle(item)}>
              <View style={[styles.checkbox, ticked && styles.checkboxChecked]}>
                {ticked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemCap}>
                  plafond {direction === "augmentation" ? "+" : "-"}
                  {item.capPercent}%
                </Text>
              </View>
            </Pressable>
            {ticked && (
              <View style={styles.valueEditRow}>
                <Text style={styles.valueSign}>{direction === "augmentation" ? "+" : "-"}</Text>
                <TextInput
                  style={styles.valueInput}
                  keyboardType="numeric"
                  value={String(Math.abs(entry.valuePercent))}
                  onChangeText={(v) => updateValue(item.index, v)}
                />
                <Text style={styles.pct}>%</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  title: { fontWeight: "700", fontSize: typography.bodyLarge, marginBottom: spacing.sm, color: colors.contentPrimary },
  row: { paddingVertical: spacing.sm },
  rowMain: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: "#bbb", alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkboxChecked: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  checkmark: { color: colors.contentInverse, fontSize: typography.body, fontWeight: "700" },
  itemLabel: { fontSize: typography.body, color: colors.contentSecondary, lineHeight: 18 },
  itemCap: { fontSize: typography.caption, color: colors.contentQuaternary, marginTop: 2 },
  valueEditRow: { flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 30, gap: 6 },
  valueSign: { fontSize: typography.body, color: colors.contentTertiary, fontWeight: "700" },
  valueInput: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 6, width: 60, fontSize: typography.body },
  pct: { color: colors.contentQuaternary, fontSize: typography.body },
  errorText: { color: colors.error, fontSize: typography.small },
});
