import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import NumberField from "../components/NumberField";
import { api, ApiError } from "../api/client";
import { NaeApiResult } from "../api/client";

interface ShiftRow {
  headcount: string;
  pctRepetitive: string; // stored as 0-100 in the UI, converted to 0-1 for the API
}

const emptyShift = (): ShiftRow => ({ headcount: "", pctRepetitive: "0" });

export default function NaeCalculatorScreen() {
  const [declaredTotal, setDeclaredTotal] = useState("");
  const [shifts, setShifts] = useState<ShiftRow[]>([emptyShift()]);
  const [nonShiftHeadcount, setNonShiftHeadcount] = useState("");
  const [nonShiftPct, setNonShiftPct] = useState("0");
  const [indirectHeadcount, setIndirectHeadcount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NaeApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addShift = () => {
    if (shifts.length >= 5) {
      Alert.alert("Maximum reached", "Up to 5 shift teams are supported (per GS0106 rule e).");
      return;
    }
    setShifts([...shifts, emptyShift()]);
  };

  const removeShift = (index: number) => {
    if (shifts.length === 1) return;
    setShifts(shifts.filter((_, i) => i !== index));
  };

  const updateShift = (index: number, field: keyof ShiftRow, value: string) => {
    const next = [...shifts];
    next[index] = { ...next[index], [field]: value };
    setShifts(next);
  };

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

  const canSubmit =
    declaredTotal.trim() !== "" &&
    shifts.every((s) => s.headcount.trim() !== "") &&
    !loading;

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.calculateNae({
        siteId: "mobile-input",
        declaredTotalHeadcount: num(declaredTotal),
        shiftTeams: shifts.map((s, i) => ({
          label: `Equipe ${i + 1}`,
          headcount: num(s.headcount),
          pctRepetitiveOrSimilar: num(s.pctRepetitive) / 100,
        })),
        nonShift: { headcount: num(nonShiftHeadcount), pctRepetitiveOrSimilar: num(nonShiftPct) / 100 },
        indirect: { headcount: num(indirectHeadcount) },
      });
      setResult(res);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.sectionTitle}>Déclaration</Text>
      <NumberField label="Effectif total déclaré" value={declaredTotal} onChangeText={setDeclaredTotal} suffix="pers." />

      <Text style={styles.sectionTitle}>Équipes (postées)</Text>
      <Text style={styles.hint}>La 1ère équipe listée est traitée comme l'équipe clé (rule e).</Text>
      {shifts.map((s, i) => (
        <View key={i} style={styles.shiftCard}>
          <View style={styles.shiftHeader}>
            <Text style={styles.shiftLabel}>Équipe {i + 1}{i === 0 ? " (clé)" : ""}</Text>
            {shifts.length > 1 && (
              <Pressable onPress={() => removeShift(i)}>
                <Text style={styles.removeText}>Retirer</Text>
              </Pressable>
            )}
          </View>
          <NumberField label="Effectif" value={s.headcount} onChangeText={(v) => updateShift(i, "headcount", v)} suffix="pers." />
          <NumberField
            label="% tâches répétitives/similaires"
            value={s.pctRepetitive}
            onChangeText={(v) => updateShift(i, "pctRepetitive", v)}
            suffix="%"
          />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addShift}>
        <Text style={styles.addButtonText}>+ Ajouter une équipe</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Personnel non posté</Text>
      <NumberField label="Effectif" value={nonShiftHeadcount} onChangeText={setNonShiftHeadcount} suffix="pers." />
      <NumberField label="% tâches répétitives/similaires" value={nonShiftPct} onChangeText={setNonShiftPct} suffix="%" />

      <Text style={styles.sectionTitle}>Personnel indirect (admin/RH/finance)</Text>
      <NumberField label="Effectif" value={indirectHeadcount} onChangeText={setIndirectHeadcount} suffix="pers." />

      <Pressable
        style={[styles.calcButton, !canSubmit && styles.calcButtonDisabled]}
        onPress={handleCalculate}
        disabled={!canSubmit}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.calcButtonText}>Calculer le NAE</Text>}
      </Pressable>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultBox}>
          {!result.crossCheckOk && (
            <Text style={styles.warnText}>{result.crossCheckMessage}</Text>
          )}
          {result.crossCheckOk && (
            <>
              <Text style={styles.resultTitle}>NAE total : {result.totalNae}</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Équipes (ajusté)</Text>
                <Text style={styles.breakdownValue}>{result.directShiftAdjusted}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Non posté</Text>
                <Text style={styles.breakdownValue}>{result.directNonShift}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Indirect</Text>
                <Text style={styles.breakdownValue}>{result.indirectAdjusted}</Text>
              </View>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 20, marginBottom: 8, color: "#1c1c1e" },
  hint: { fontSize: 12, color: "#888", marginBottom: 10 },
  shiftCard: { backgroundColor: "#f5f5f7", borderRadius: 10, padding: 12, marginBottom: 10 },
  shiftHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  shiftLabel: { fontWeight: "600", color: "#333" },
  removeText: { color: "#c53030", fontSize: 13 },
  addButton: { paddingVertical: 10, alignItems: "center" },
  addButtonText: { color: "#0066cc", fontWeight: "600" },
  calcButton: { backgroundColor: "#1c1c1e", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  calcButtonDisabled: { backgroundColor: "#bbb" },
  calcButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  errorBox: { backgroundColor: "#fdecea", borderRadius: 10, padding: 12, marginTop: 16 },
  errorText: { color: "#c53030", fontSize: 13 },
  warnText: { color: "#b7791f", fontSize: 13, fontWeight: "600" },
  resultBox: { backgroundColor: "#eefaf0", borderRadius: 10, padding: 16, marginTop: 16 },
  resultTitle: { fontSize: 18, fontWeight: "700", color: "#1a7f37", marginBottom: 10 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  breakdownLabel: { color: "#555", fontSize: 13 },
  breakdownValue: { color: "#333", fontSize: 13, fontWeight: "600" },
});
