import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { IntegrationLevel, StandardCode } from "../types/engine";
import { colors, radius, spacing, typography } from "../theme/tokens";

export interface SynergyAuditorRow {
  id: string;
  qualifiedStandards: Partial<Record<StandardCode, boolean>>; // matrix cell per column
}

export interface SynergyFormValue {
  enabled: boolean;
  // Self-assessed against SGS criteria (GS0106 spec) — the app derives
  // Basique/Élevé/Non applicable FROM these, never picked directly.
  criteriaSingleAuditProgram: boolean;
  criteriaSingleManagementReview: boolean;
  criteriaSingleDocControl: boolean;
  criteriaSingleResponsiblePerson: boolean;
  auditors: SynergyAuditorRow[];
}

export function emptySynergy(): SynergyFormValue {
  return {
    enabled: false,
    criteriaSingleAuditProgram: false,
    criteriaSingleManagementReview: false,
    criteriaSingleDocControl: false,
    criteriaSingleResponsiblePerson: false,
    auditors: [{ id: `a-${Date.now()}`, qualifiedStandards: {} }],
  };
}

/** Derives Basique/Élevé/Non applicable from the checked criteria — never a
 * direct manual pick. Basique needs the first 3; Élevé additionally needs
 * the 4th (single person responsible for the whole IMS). */
export function deriveIntegrationLevel(v: SynergyFormValue): IntegrationLevel {
  const basiqueCriteria = v.criteriaSingleAuditProgram && v.criteriaSingleManagementReview && v.criteriaSingleDocControl;
  if (basiqueCriteria && v.criteriaSingleResponsiblePerson) return "Elevé";
  if (basiqueCriteria) return "Basique";
  return "Non applicable";
}

interface Props {
  value: SynergyFormValue;
  onChange: (next: SynergyFormValue) => void;
  standards: StandardCode[]; // columns of the matrix — this site's active standards
}

export default function SynergyPanel({ value, onChange, standards }: Props) {
  const level = deriveIntegrationLevel(value);

  const addAuditor = () => {
    if (value.auditors.length >= 7) return; // matches the spec's matrix size (up to 7 auditors)
    onChange({ ...value, auditors: [...value.auditors, { id: `a-${Date.now()}`, qualifiedStandards: {} }] });
  };
  const removeAuditor = (id: string) => {
    if (value.auditors.length <= 1) return;
    onChange({ ...value, auditors: value.auditors.filter((a) => a.id !== id) });
  };
  const toggleCell = (auditorId: string, std: StandardCode) => {
    onChange({
      ...value,
      auditors: value.auditors.map((a) =>
        a.id === auditorId ? { ...a, qualifiedStandards: { ...a.qualifiedStandards, [std]: !a.qualifiedStandards[std] } } : a
      ),
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Synergie / Intégration (IAF MD11)</Text>
        <Pressable onPress={() => onChange({ ...value, enabled: !value.enabled })} style={styles.toggle}>
          <Text style={styles.toggleText}>{value.enabled ? "Activée" : "Non appliquée"}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Ce site couvre {standards.length} normes. Le niveau d'intégration est auto-évalué à partir des critères
        ci-dessous, pas choisi directement.
      </Text>

      {value.enabled && (
        <>
          <Text style={styles.label}>Critères d'intégration du système de management (auto-évaluation)</Text>
          <CriteriaCheckbox
            label="Un seul programme d'audit interne couvrant l'ensemble du système"
            checked={value.criteriaSingleAuditProgram}
            onToggle={() => onChange({ ...value, criteriaSingleAuditProgram: !value.criteriaSingleAuditProgram })}
          />
          <CriteriaCheckbox
            label="Une seule revue de direction couvrant l'ensemble du système"
            checked={value.criteriaSingleManagementReview}
            onToggle={() => onChange({ ...value, criteriaSingleManagementReview: !value.criteriaSingleManagementReview })}
          />
          <CriteriaCheckbox
            label="Un seul système de gestion documentaire couvrant l'ensemble du système"
            checked={value.criteriaSingleDocControl}
            onToggle={() => onChange({ ...value, criteriaSingleDocControl: !value.criteriaSingleDocControl })}
          />
          <CriteriaCheckbox
            label="Une seule personne responsable de l'ensemble du système (requis en plus des 3 ci-dessus pour 'Élevé')"
            checked={value.criteriaSingleResponsiblePerson}
            onToggle={() => onChange({ ...value, criteriaSingleResponsiblePerson: !value.criteriaSingleResponsiblePerson })}
          />

          <View style={styles.levelResult}>
            <Text style={styles.levelResultText}>
              Niveau retenu : <Text style={styles.levelResultValue}>{level}</Text>
            </Text>
          </View>

          <Text style={styles.label}>Équipe d'audit — qualifications par norme</Text>
          <View style={styles.matrixWrap}>
            <View style={styles.matrixHeaderRow}>
              <Text style={styles.matrixCornerCell}>Auditeur</Text>
              {standards.map((std) => (
                <Text key={std} style={styles.matrixHeaderCell}>
                  {std}
                </Text>
              ))}
              <View style={{ width: 60 }} />
            </View>
            {value.auditors.map((auditor, i) => (
              <View key={auditor.id} style={styles.matrixRow}>
                <Text style={styles.matrixRowLabel}>Aud. {i + 1}</Text>
                {standards.map((std) => (
                  <Pressable key={std} style={styles.matrixCell} onPress={() => toggleCell(auditor.id, std)}>
                    <View style={[styles.matrixCheckbox, auditor.qualifiedStandards[std] && styles.matrixCheckboxChecked]}>
                      {auditor.qualifiedStandards[std] && <Text style={styles.matrixCheckmark}>✓</Text>}
                    </View>
                  </Pressable>
                ))}
                <View style={{ width: 60, alignItems: "center" }}>
                  {value.auditors.length > 1 && (
                    <Pressable onPress={() => removeAuditor(auditor.id)}>
                      <Text style={styles.removeText}>Retirer</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
          <Pressable style={styles.addButton} onPress={addAuditor}>
            <Text style={styles.addButtonText}>+ Ajouter un auditeur</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function CriteriaCheckbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.criteriaRow} onPress={onToggle}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked && <Text style={styles.checkmark}>✓</Text>}</View>
      <Text style={styles.criteriaLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing.md + 2, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderSubtle },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  title: { fontSize: typography.bodyLarge, fontWeight: "700", color: colors.contentPrimary },
  toggle: { backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm + 2 },
  toggleText: { fontSize: typography.caption, fontWeight: "700", color: colors.contentSecondary },
  hint: { fontSize: typography.caption, color: colors.contentQuaternary, marginBottom: spacing.sm + 2 },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginTop: spacing.sm, marginBottom: spacing.sm, fontWeight: "600" },
  criteriaRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.borderDefault, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  checkmark: { color: colors.contentInverse, fontSize: typography.body, fontWeight: "700" },
  criteriaLabel: { flex: 1, fontSize: typography.body, color: colors.contentSecondary, lineHeight: 18 },
  levelResult: { backgroundColor: colors.successSurface, borderRadius: radius.md, padding: spacing.sm + 2, marginVertical: spacing.sm },
  levelResultText: { fontSize: typography.body, color: colors.contentSecondary },
  levelResultValue: { fontWeight: "700", color: colors.success },
  matrixWrap: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, overflow: "hidden" },
  matrixHeaderRow: { flexDirection: "row", backgroundColor: colors.surfaceSunken, paddingVertical: 8 },
  matrixCornerCell: { width: 70, fontSize: typography.caption, fontWeight: "700", color: colors.contentTertiary, paddingLeft: 8 },
  matrixHeaderCell: { flex: 1, fontSize: typography.caption, fontWeight: "700", color: colors.contentTertiary, textAlign: "center" },
  matrixRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  matrixRowLabel: { width: 70, fontSize: typography.small, color: colors.contentSecondary, paddingLeft: 8 },
  matrixCell: { flex: 1, alignItems: "center" },
  matrixCheckbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.borderDefault, alignItems: "center", justifyContent: "center" },
  matrixCheckboxChecked: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  matrixCheckmark: { color: colors.contentInverse, fontSize: typography.small, fontWeight: "700" },
  removeText: { color: colors.error, fontSize: typography.caption },
  addButton: { paddingVertical: spacing.sm, alignItems: "flex-start" },
  addButtonText: { color: colors.link, fontWeight: "600", fontSize: typography.body },
});
