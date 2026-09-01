import React from "react";
import { View, Text, StyleSheet, TextInput, Switch } from "react-native";
import SegmentedPicker from "./SegmentedPicker";
import FactorPicker, { FactorSelectionState } from "./FactorPicker";
import { RiskLevel, Stage, StandardCode } from "../types/engine";

export interface StandardConfigState {
  standard: StandardCode;
  riskLevel: RiskLevel;
  stage: Stage;
  stage1Selected: boolean;
  stage2Selected: boolean;
  augmentation: FactorSelectionState;
  reduction: FactorSelectionState;
  justificationText: string;
  sampledYear2: boolean;
  sampledYear3: boolean;
}

export function emptyStandardConfig(standard: StandardCode): StandardConfigState {
  return {
    standard,
    riskLevel: "Moyen",
    stage: "Initial",
    stage1Selected: true,
    stage2Selected: true,
    augmentation: { ticked: [], autreValue: "" },
    reduction: { ticked: [], autreValue: "" },
    justificationText: "",
    sampledYear2: true,
    sampledYear3: true,
  };
}

const RISK_OPTIONS: { value: RiskLevel; label: string }[] = [
  { value: "Faible", label: "Faible" },
  { value: "Moyen", label: "Moyen" },
  { value: "Elevé", label: "Élevé" },
  { value: "Limité", label: "Limité" },
];

const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: "Initial", label: "Initial" },
  { value: "Renouvellement", label: "Renouvellement" },
  { value: "Suivi 1", label: "Suivi 1" },
  { value: "Suivi 2", label: "Suivi 2" },
];

interface Props {
  config: StandardConfigState;
  onChange: (next: StandardConfigState) => void;
}

export default function StandardConfigPanel({ config, onChange }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{config.standard}</Text>

      <SegmentedPicker
        label="Niveau de risque"
        options={RISK_OPTIONS}
        value={config.riskLevel}
        onChange={(riskLevel) => onChange({ ...config, riskLevel })}
      />

      <SegmentedPicker
        label="Étape du cycle"
        options={STAGE_OPTIONS}
        value={config.stage}
        onChange={(stage) => onChange({ ...config, stage })}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Étape 1 incluse</Text>
        <Switch value={config.stage1Selected} onValueChange={(v) => onChange({ ...config, stage1Selected: v })} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Étape 2 incluse</Text>
        <Switch value={config.stage2Selected} onValueChange={(v) => onChange({ ...config, stage2Selected: v })} />
      </View>

      <FactorPicker
        standard={config.standard}
        direction="augmentation"
        selection={config.augmentation}
        onChange={(augmentation) => onChange({ ...config, augmentation })}
      />
      <FactorPicker
        standard={config.standard}
        direction="reduction"
        selection={config.reduction}
        onChange={(reduction) => onChange({ ...config, reduction })}
      />

      <Text style={styles.label}>Justification (obligatoire si facteurs sélectionnés)</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={3}
        placeholder="Justification de la sélection des facteurs..."
        value={config.justificationText}
        onChangeText={(justificationText) => onChange({ ...config, justificationText })}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Échantillonné année 2</Text>
        <Switch value={config.sampledYear2} onValueChange={(v) => onChange({ ...config, sampledYear2: v })} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Échantillonné année 3</Text>
        <Switch value={config.sampledYear3} onValueChange={(v) => onChange({ ...config, sampledYear3: v })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#f9f9fb", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#eee" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#1c1c1e" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  switchLabel: { fontSize: 13, color: "#444" },
  label: { fontSize: 13, color: "#444", marginTop: 6, marginBottom: 6 },
  textArea: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, fontSize: 13, textAlignVertical: "top", minHeight: 60, backgroundColor: "#fff" },
});
