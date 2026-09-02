import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import NumberField from "./NumberField";
import { ShiftRow } from "../types/wizard";

export interface PersonnelFormValue {
  declaredTotal: string;
  indirectHeadcount: string;
  nonShiftHeadcount: string;
  nonShiftPct: string;
  shifts: ShiftRow[];
}

interface Props {
  value: PersonnelFormValue;
  onChange: (next: PersonnelFormValue) => void;
}

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

/** Shared with the wizard screen so "is this site's personnel complete and
 * consistent" is defined in exactly one place. */
export function isPersonnelValid(p: PersonnelFormValue): boolean {
  if (p.declaredTotal.trim() === "") return false;
  const attributed = num(p.indirectHeadcount) + num(p.nonShiftHeadcount) + p.shifts.reduce((sum, t) => sum + num(t.headcount), 0);
  return attributed === num(p.declaredTotal);
}

export default function PersonnelForm({ value, onChange }: Props) {
  const indirect = num(value.indirectHeadcount);
  const nonShift = num(value.nonShiftHeadcount);
  const declaredTotal = num(value.declaredTotal);
  const directTotal = Math.max(declaredTotal - indirect, 0);
  const shiftsTotal = value.shifts.reduce((s, t) => s + num(t.headcount), 0);
  const equipeRemaining = Math.max(directTotal - nonShift, 0);
  const attributedSoFar = indirect + nonShift + shiftsTotal;
  const diff = declaredTotal - attributedSoFar;

  // Progressive expansion: as soon as the last shift row's headcount is
  // filled and people still remain unattributed, silently add the next
  // shift row — the user never has to press "add" mid-flow, only ever
  // answers "how many in the next group" until nothing is left over.
  useEffect(() => {
    if (value.declaredTotal.trim() === "" || value.shifts.length >= 5) return;
    const last = value.shifts[value.shifts.length - 1];
    const lastFilled = last.headcount.trim() !== "";
    const remainingAfterLast = directTotal - nonShift - shiftsTotal;
    if (lastFilled && remainingAfterLast > 0) {
      onChange({ ...value, shifts: [...value.shifts, { headcount: "", pctRepetitive: "0" }] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.shifts.map((s) => s.headcount).join(","), value.nonShiftHeadcount, value.declaredTotal]);

  const validation = useMemo(() => {
    if (value.declaredTotal.trim() === "") return null;
    if (diff === 0) return { kind: "ok" as const, message: "Le total correspond." };
    if (diff > 0)
      return {
        kind: "warn" as const,
        message: `Il manque ${diff} personne(s) non attribuée(s) (indirect + non-posté + équipes = ${attributedSoFar}, déclaré = ${declaredTotal}).`,
      };
    return {
      kind: "error" as const,
      message: `${Math.abs(diff)} personne(s) en trop par rapport au total déclaré (attribué = ${attributedSoFar}, déclaré = ${declaredTotal}).`,
    };
  }, [diff, attributedSoFar, declaredTotal, value.declaredTotal]);

  const updateShift = (i: number, field: keyof ShiftRow, v: string) => {
    const next = [...value.shifts];
    next[i] = { ...next[i], [field]: v };
    onChange({ ...value, shifts: next });
  };
  const removeShift = (i: number) => {
    if (value.shifts.length === 1) return;
    onChange({ ...value, shifts: value.shifts.filter((_, idx) => idx !== i) });
  };

  const ordinal = (n: number) => (n === 1 ? "première" : n === 2 ? "deuxième" : n === 3 ? "troisième" : n === 4 ? "quatrième" : "cinquième");

  return (
    <View>
      <Text style={styles.stepIntro}>Combien de personnes travaillent sur ce site, au total ?</Text>
      <NumberField
        label="Effectif total déclaré"
        value={value.declaredTotal}
        onChangeText={(declaredTotal) => onChange({ ...value, declaredTotal })}
        suffix="pers."
      />

      {value.declaredTotal.trim() !== "" && (
        <>
          <Text style={styles.stepIntro}>Combien sont en fonctions indirectes (admin, RH, finance) ?</Text>
          <NumberField
            label="Personnel indirect"
            value={value.indirectHeadcount}
            onChangeText={(indirectHeadcount) => onChange({ ...value, indirectHeadcount })}
            suffix="pers."
          />

          {value.indirectHeadcount.trim() !== "" && (
            <>
              <Text style={styles.stepIntro}>
                Parmi les {directTotal} personnes restantes (fonction directe), combien ne travaillent PAS en équipe (non posté) ?
              </Text>
              <NumberField
                label="Personnel direct — non posté"
                value={value.nonShiftHeadcount}
                onChangeText={(nonShiftHeadcount) => onChange({ ...value, nonShiftHeadcount })}
                suffix="pers."
              />
              <NumberField
                label="% de tâches répétitives/similaires (non posté)"
                value={value.nonShiftPct}
                onChangeText={(nonShiftPct) => onChange({ ...value, nonShiftPct })}
                suffix="%"
              />
            </>
          )}

          {value.nonShiftHeadcount.trim() !== "" && equipeRemaining > 0 && (
            <>
              <Text style={styles.stepIntro}>
                Parmi les {equipeRemaining} personnes travaillant en équipe, combien dans la {ordinal(1)} équipe ?
              </Text>
              {value.shifts.map((s, i) => {
                const priorSum = value.shifts.slice(0, i).reduce((sum, t) => sum + num(t.headcount), 0);
                const remainingBeforeThis = equipeRemaining - priorSum;
                if (remainingBeforeThis <= 0 && i > 0) return null; // nothing left to ask about
                return (
                  <View key={i} style={styles.shiftCard}>
                    <View style={styles.shiftHeader}>
                      <Text style={styles.shiftLabel}>
                        {i === 0
                          ? "1ère équipe (la plus importante)"
                          : `Parmi les ${remainingBeforeThis} restantes, ${ordinal(i + 1)} équipe`}
                      </Text>
                      {value.shifts.length > 1 && (
                        <Pressable onPress={() => removeShift(i)}>
                          <Text style={styles.removeText}>Retirer</Text>
                        </Pressable>
                      )}
                    </View>
                    <NumberField label="Effectif" value={s.headcount} onChangeText={(v) => updateShift(i, "headcount", v)} suffix="pers." />
                    <NumberField
                      label="% de tâches répétitives/similaires"
                      value={s.pctRepetitive}
                      onChangeText={(v) => updateShift(i, "pctRepetitive", v)}
                      suffix="%"
                    />
                  </View>
                );
              })}
            </>
          )}

          {validation && (
            <View
              style={[
                styles.validationBox,
                validation.kind === "ok" && styles.validationOk,
                validation.kind === "warn" && styles.validationWarn,
                validation.kind === "error" && styles.validationError,
              ]}
            >
              <Text style={styles.validationText}>{validation.message}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stepIntro: { fontSize: 14, color: "#1c1c1e", fontWeight: "600", marginTop: 18, marginBottom: 8 },
  shiftCard: { backgroundColor: "#f5f5f7", borderRadius: 10, padding: 12, marginBottom: 10 },
  shiftHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 4 },
  shiftLabel: { fontWeight: "600", color: "#333", flex: 1, fontSize: 13 },
  removeText: { color: "#c53030", fontSize: 13 },
  validationBox: { borderRadius: 10, padding: 12, marginTop: 12 },
  validationOk: { backgroundColor: "#eefaf0" },
  validationWarn: { backgroundColor: "#fff8e6" },
  validationError: { backgroundColor: "#fdecea" },
  validationText: { fontSize: 13, fontWeight: "600", color: "#333" },
});
