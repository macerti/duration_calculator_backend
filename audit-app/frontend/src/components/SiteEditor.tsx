import React from "react";
import { View, Text, StyleSheet, Pressable, Switch } from "react-native";
import NumberField from "./NumberField";
import StandardConfigPanel, { StandardConfigState, emptyStandardConfig } from "./StandardConfigPanel";
import { StandardCode } from "../types/engine";

export interface ShiftRow {
  headcount: string;
  pctRepetitive: string;
}

export interface SiteState {
  siteId: string;
  name: string;
  isHq: boolean;
  naceCode: string;
  declaredTotal: string;
  shifts: ShiftRow[];
  nonShiftHeadcount: string;
  nonShiftPct: string;
  indirectHeadcount: string;
  activeStandards: StandardCode[];
  standardConfigs: Record<string, StandardConfigState>;
}

let siteCounter = 0;
export function emptySite(isHq: boolean): SiteState {
  siteCounter += 1;
  return {
    siteId: `site-${siteCounter}-${Date.now()}`,
    name: isHq ? "Siège" : `Site ${siteCounter}`,
    isHq,
    naceCode: "",
    declaredTotal: "",
    shifts: [{ headcount: "", pctRepetitive: "0" }],
    nonShiftHeadcount: "",
    nonShiftPct: "0",
    indirectHeadcount: "",
    activeStandards: ["ISO9001"],
    standardConfigs: { ISO9001: emptyStandardConfig("ISO9001") },
  };
}

const AVAILABLE_STANDARDS: StandardCode[] = ["ISO9001", "ISO45001", "ISO14001"];

interface Props {
  site: SiteState;
  onChange: (next: SiteState) => void;
  onRemove?: () => void;
}

export default function SiteEditor({ site, onChange, onRemove }: Props) {
  const updateShift = (i: number, field: keyof ShiftRow, value: string) => {
    const next = [...site.shifts];
    next[i] = { ...next[i], [field]: value };
    onChange({ ...site, shifts: next });
  };
  const addShift = () => {
    if (site.shifts.length >= 5) return;
    onChange({ ...site, shifts: [...site.shifts, { headcount: "", pctRepetitive: "0" }] });
  };
  const removeShift = (i: number) => {
    if (site.shifts.length === 1) return;
    onChange({ ...site, shifts: site.shifts.filter((_, idx) => idx !== i) });
  };

  const toggleStandard = (std: StandardCode) => {
    if (site.activeStandards.includes(std)) {
      onChange({ ...site, activeStandards: site.activeStandards.filter((s) => s !== std) });
    } else {
      onChange({
        ...site,
        activeStandards: [...site.activeStandards, std],
        standardConfigs: site.standardConfigs[std]
          ? site.standardConfigs
          : { ...site.standardConfigs, [std]: emptyStandardConfig(std) },
      });
    }
  };

  return (
    <View style={styles.siteCard}>
      <View style={styles.siteHeader}>
        <NumberField label="Nom du site" value={site.name} onChangeText={(name) => onChange({ ...site, name })} />
        {onRemove && (
          <Pressable onPress={onRemove} style={styles.removeSiteBtn}>
            <Text style={styles.removeSiteText}>Retirer ce site</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Site siège (HQ)</Text>
        <Switch value={site.isHq} onValueChange={(isHq) => onChange({ ...site, isHq })} />
      </View>

      <NumberField label="Code NACE" value={site.naceCode} onChangeText={(naceCode) => onChange({ ...site, naceCode })} placeholder="ex: 15" />

      <Text style={styles.subTitle}>Personnel</Text>
      <NumberField
        label="Effectif total déclaré"
        value={site.declaredTotal}
        onChangeText={(declaredTotal) => onChange({ ...site, declaredTotal })}
        suffix="pers."
      />
      {site.shifts.map((s, i) => (
        <View key={i} style={styles.shiftCard}>
          <View style={styles.shiftHeaderRow}>
            <Text style={styles.shiftLabel}>
              Équipe {i + 1}
              {i === 0 ? " (clé)" : ""}
            </Text>
            {site.shifts.length > 1 && (
              <Pressable onPress={() => removeShift(i)}>
                <Text style={styles.removeText}>Retirer</Text>
              </Pressable>
            )}
          </View>
          <NumberField label="Effectif" value={s.headcount} onChangeText={(v) => updateShift(i, "headcount", v)} suffix="pers." />
          <NumberField label="% répétitif" value={s.pctRepetitive} onChangeText={(v) => updateShift(i, "pctRepetitive", v)} suffix="%" />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addShift}>
        <Text style={styles.addButtonText}>+ Ajouter une équipe</Text>
      </Pressable>
      <NumberField
        label="Non posté — effectif"
        value={site.nonShiftHeadcount}
        onChangeText={(nonShiftHeadcount) => onChange({ ...site, nonShiftHeadcount })}
        suffix="pers."
      />
      <NumberField
        label="Non posté — % répétitif"
        value={site.nonShiftPct}
        onChangeText={(nonShiftPct) => onChange({ ...site, nonShiftPct })}
        suffix="%"
      />
      <NumberField
        label="Indirect — effectif"
        value={site.indirectHeadcount}
        onChangeText={(indirectHeadcount) => onChange({ ...site, indirectHeadcount })}
        suffix="pers."
      />

      <Text style={styles.subTitle}>Normes de ce site</Text>
      <View style={styles.standardRow}>
        {AVAILABLE_STANDARDS.map((std) => {
          const active = site.activeStandards.includes(std);
          return (
            <Pressable key={std} style={[styles.stdChip, active && styles.stdChipActive]} onPress={() => toggleStandard(std)}>
              <Text style={[styles.stdChipText, active && styles.stdChipTextActive]}>{std}</Text>
            </Pressable>
          );
        })}
      </View>

      {site.activeStandards.map((std) => (
        <StandardConfigPanel
          key={std}
          config={site.standardConfigs[std] ?? emptyStandardConfig(std)}
          onChange={(next) => onChange({ ...site, standardConfigs: { ...site.standardConfigs, [std]: next } })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  siteCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: "#1c1c1e" },
  siteHeader: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  removeSiteBtn: { marginBottom: 12 },
  removeSiteText: { color: "#c53030", fontSize: 12 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  switchLabel: { fontSize: 13, color: "#444" },
  subTitle: { fontSize: 14, fontWeight: "700", marginTop: 14, marginBottom: 8, color: "#1c1c1e" },
  shiftCard: { backgroundColor: "#f5f5f7", borderRadius: 10, padding: 12, marginBottom: 10 },
  shiftHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  shiftLabel: { fontWeight: "600", color: "#333" },
  removeText: { color: "#c53030", fontSize: 13 },
  addButton: { paddingVertical: 8, alignItems: "center" },
  addButtonText: { color: "#0066cc", fontWeight: "600" },
  standardRow: { flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  stdChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: "#ddd" },
  stdChipActive: { backgroundColor: "#1c1c1e", borderColor: "#1c1c1e" },
  stdChipText: { fontSize: 13, color: "#333" },
  stdChipTextActive: { color: "#fff", fontWeight: "600" },
});
