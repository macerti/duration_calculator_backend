import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { api } from "../api/client";
import { FactorCatalogueItem, StandardCode } from "../types/engine";

export interface FactorSelectionState {
  ticked: { index: number; valuePercent: number }[];
  autreValue: string; // free-text "Autre" percent, empty = not used
}

interface Props {
  standard: StandardCode;
  direction: "augmentation" | "reduction";
  selection: FactorSelectionState;
  onChange: (next: FactorSelectionState) => void;
}

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

  const isTicked = (index: number) => selection.ticked.some((t) => t.index === index);

  const toggle = (item: FactorCatalogueItem) => {
    const sign = direction === "augmentation" ? 1 : -1;
    if (isTicked(item.index)) {
      onChange({ ...selection, ticked: selection.ticked.filter((t) => t.index !== item.index) });
    } else {
      onChange({
        ...selection,
        ticked: [...selection.ticked, { index: item.index, valuePercent: item.capPercent * sign }],
      });
    }
  };

  const title = direction === "augmentation" ? "Facteurs d'augmentation" : "Facteurs de réduction";

  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!items) return <ActivityIndicator style={{ marginVertical: 10 }} />;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {items.map((item) => (
        <Pressable key={item.index} style={styles.row} onPress={() => toggle(item)}>
          <View style={[styles.checkbox, isTicked(item.index) && styles.checkboxChecked]}>
            {isTicked(item.index) && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.itemCap}>
              max {direction === "augmentation" ? "+" : "-"}
              {item.capPercent}%
            </Text>
          </View>
        </Pressable>
      ))}
      <View style={styles.autreRow}>
        <Text style={styles.itemLabel}>Autre ({direction === "augmentation" ? "augmentation" : "réduction"})</Text>
        <TextInput
          style={styles.autreInput}
          keyboardType="numeric"
          placeholder="0"
          value={selection.autreValue}
          onChangeText={(v) => onChange({ ...selection, autreValue: v })}
        />
        <Text style={styles.pct}>%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  title: { fontWeight: "700", fontSize: 14, marginBottom: 8, color: "#1c1c1e" },
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: "#bbb", alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkboxChecked: { backgroundColor: "#1c1c1e", borderColor: "#1c1c1e" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  itemLabel: { fontSize: 13, color: "#333", lineHeight: 18 },
  itemCap: { fontSize: 11, color: "#999", marginTop: 2 },
  autreRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  autreInput: { borderWidth: 1, borderColor: "#ddd", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, width: 60, fontSize: 13 },
  pct: { color: "#999", fontSize: 13 },
  errorText: { color: "#c53030", fontSize: 12 },
});
