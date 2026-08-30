import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Switch } from "react-native";
import SegmentedPicker from "./SegmentedPicker";
import FactorPicker, { FactorSelectionState } from "./FactorPicker";
import AutreFactorList, { AutreFactorEntry } from "./AutreFactorList";
import { api } from "../api/client";
import { RiskLevel, Stage, StandardCode } from "../types/engine";
import { colors, radius, spacing, typography } from "../theme/tokens";

export interface StandardConfigState {
  standard: StandardCode;
  stage: Stage;
  stage1Selected: boolean;
  stage2Selected: boolean;
  riskOverride: RiskLevel | null; // null = use the auto-resolved value from sectors
  augmentation: FactorSelectionState;
  reduction: FactorSelectionState;
  autresAugmentation: AutreFactorEntry[];
  autresReduction: AutreFactorEntry[];
  justificationText: string; // covers the catalogue-ticked factor selections
  sampledYear2: boolean;
  sampledYear3: boolean;
}

export function emptyStandardConfig(standard: StandardCode): StandardConfigState {
  return {
    standard,
    stage: "Initial",
    stage1Selected: true,
    stage2Selected: true,
    riskOverride: null,
    augmentation: { ticked: [] },
    reduction: { ticked: [] },
    autresAugmentation: [],
    autresReduction: [],
    justificationText: "",
    sampledYear2: true,
    sampledYear3: true,
  };
}

const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: "Initial", label: "Initial" },
  { value: "Renouvellement", label: "Renouvellement" },
  { value: "Suivi 1", label: "Suivi 1" },
  { value: "Suivi 2", label: "Suivi 2" },
];

const RISK_OPTIONS: { value: RiskLevel; label: string }[] = [
  { value: "Faible", label: "Faible" },
  { value: "Moyen", label: "Moyen" },
  { value: "Elevé", label: "Élevé" },
  { value: "Limité", label: "Limité" },
];

interface Props {
  config: StandardConfigState;
  onChange: (next: StandardConfigState) => void;
  resolvedRisk: RiskLevel | null; // auto-computed upstream from the site's declared sector(s)
  sampleSizeHint?: { year: number; sampleSize: number; eligibleSiteCount: number }[]; // context only, never forces the toggle
}

const num = (v: string) => (v.trim() === "" ? 0 : Math.abs(Number(v)) || 0);

export default function StandardConfigPanel({ config, onChange, resolvedRisk, sampleSizeHint }: Props) {
  const [caps, setCaps] = useState<{ maxAugmentationPercent: number; maxReductionPercent: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getParameters()
      .then((p) => !cancelled && setCaps(p.aggregateFactorCaps))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const augTotal =
    config.augmentation.ticked.reduce((s, t) => s + t.valuePercent, 0) +
    config.autresAugmentation.reduce((s, a) => s + num(a.valuePercent), 0);
  const redTotal =
    config.reduction.ticked.reduce((s, t) => s + t.valuePercent, 0) -
    config.autresReduction.reduce((s, a) => s + num(a.valuePercent), 0);
  const netTotal = augTotal + redTotal;

  const augCapped = caps ? augTotal > caps.maxAugmentationPercent : false;
  const redCapped = caps ? redTotal < caps.maxReductionPercent : false;

  const effectiveRisk = config.riskOverride ?? resolvedRisk;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{config.standard}</Text>
      </View>

      <SegmentedPicker
        label="Niveau de risque"
        options={RISK_OPTIONS}
        value={effectiveRisk ?? undefined}
        onChange={(riskOverride) => onChange({ ...config, riskOverride })}
      />
      {config.riskOverride && resolvedRisk && config.riskOverride !== resolvedRisk && (
        <Text style={styles.overrideHint}>
          Risque auto-résolu à partir du secteur : {resolvedRisk}. Valeur ci-dessus modifiée manuellement pour ce
          calcul.
        </Text>
      )}
      {config.riskOverride && (
        <Text onPress={() => onChange({ ...config, riskOverride: null })} style={styles.resetLink}>
          ↺ Revenir au risque auto-résolu ({resolvedRisk ?? "non déterminé"})
        </Text>
      )}

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
      <AutreFactorList
        direction="augmentation"
        entries={config.autresAugmentation}
        onChange={(autresAugmentation) => onChange({ ...config, autresAugmentation })}
      />

      <FactorPicker
        standard={config.standard}
        direction="reduction"
        selection={config.reduction}
        onChange={(reduction) => onChange({ ...config, reduction })}
      />
      <AutreFactorList
        direction="reduction"
        entries={config.autresReduction}
        onChange={(autresReduction) => onChange({ ...config, autresReduction })}
      />

      <View style={styles.totalsBox}>
        <Text style={styles.totalsLine}>
          Augmentation : <Text style={styles.totalsValue}>+{augTotal}%</Text>
          {caps && augCapped && <Text style={styles.cappedText}> (plafond {caps.maxAugmentationPercent}% — dépassement affiché)</Text>}
        </Text>
        <Text style={styles.totalsLine}>
          Réduction : <Text style={styles.totalsValue}>{redTotal}%</Text>
          {caps && redCapped && <Text style={styles.cappedText}> (plafond {caps.maxReductionPercent}% — dépassement affiché)</Text>}
        </Text>
        <Text style={styles.totalsNet}>Total net (avant plafonnement) : {netTotal > 0 ? "+" : ""}{netTotal}%</Text>
      </View>

      <Text style={styles.label}>Justification (facteurs du catalogue ci-dessus)</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={3}
        placeholder="Justification de la sélection des facteurs du catalogue..."
        value={config.justificationText}
        onChangeText={(justificationText) => onChange({ ...config, justificationText })}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Échantillonnée année 2</Text>
        <Switch value={config.sampledYear2} onValueChange={(v) => onChange({ ...config, sampledYear2: v })} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Échantillonnée année 3</Text>
        <Switch value={config.sampledYear3} onValueChange={(v) => onChange({ ...config, sampledYear3: v })} />
      </View>
      <Text style={styles.samplingHint}>
        Décision manuelle par site — cette bascule ne doit pas nécessairement correspondre au nombre de sites
        échantillonnés au niveau du dossier (voir la Synthèse pour ce total calculé par l'IAF MD1).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing.md + 2, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderSubtle },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  cardTitle: { fontSize: typography.title, fontWeight: "700", color: colors.contentPrimary },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginTop: 6, marginBottom: 6, fontWeight: "600" },
  overrideHint: { fontSize: typography.caption, color: colors.warning, marginTop: -8, marginBottom: 8 },
  resetLink: { fontSize: typography.small, color: colors.link, marginTop: -6, marginBottom: 10 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  switchLabel: { fontSize: typography.body, color: colors.contentSecondary },
  textArea: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: 10, fontSize: typography.body, textAlignVertical: "top", minHeight: 60, backgroundColor: colors.surfaceBase },
  totalsBox: { backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.sm + 2, marginBottom: spacing.sm },
  totalsLine: { fontSize: typography.small, color: colors.contentSecondary, marginBottom: 2 },
  totalsValue: { fontWeight: "700", color: colors.contentPrimary },
  cappedText: { color: colors.warning, fontWeight: "600" },
  totalsNet: { fontSize: typography.body, fontWeight: "700", color: colors.contentPrimary, marginTop: 4 },
  samplingHint: { fontSize: typography.caption, color: colors.contentQuaternary, marginTop: 4, lineHeight: 15 },
});
