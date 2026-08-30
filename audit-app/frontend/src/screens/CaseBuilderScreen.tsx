import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import NumberField from "../components/NumberField";
import SiteEditor, { SiteState, emptySite } from "../components/SiteEditor";
import { api, ApiError } from "../api/client";
import { CalculationCaseInput } from "../types/engine";

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

export default function CaseBuilderScreen() {
  const [dossierRef, setDossierRef] = useState("");
  const [cycleYears, setCycleYears] = useState("3");
  const [sites, setSites] = useState<SiteState[]>([emptySite(true)]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const updateSite = (index: number, next: SiteState) => {
    const copy = [...sites];
    copy[index] = next;
    setSites(copy);
  };

  const addSite = () => setSites([...sites, emptySite(false)]);
  const removeSite = (index: number) => sites.length > 1 && setSites(sites.filter((_, i) => i !== index));

  const buildInput = (): CalculationCaseInput => ({
    dossierRef: dossierRef || `DRAFT-${Date.now()}`,
    date: new Date().toISOString(),
    commercial: "",
    scopeText: "",
    cycleYears: num(cycleYears) || 3,
    auditBlanc: "Non",
    extension: { active: false },
    multiSite: sites.length > 1,
    parameterSetId: "default-v1",
    sites: sites.map((site) => ({
      siteId: site.siteId,
      name: site.name,
      isHq: site.isHq,
      naceCode: site.naceCode,
      personnel: {
        siteId: site.siteId,
        declaredTotalHeadcount: num(site.declaredTotal),
        shiftTeams: site.shifts.map((s, i) => ({
          label: `Equipe ${i + 1}`,
          headcount: num(s.headcount),
          pctRepetitiveOrSimilar: num(s.pctRepetitive) / 100,
        })),
        nonShift: { headcount: num(site.nonShiftHeadcount), pctRepetitiveOrSimilar: num(site.nonShiftPct) / 100 },
        indirect: { headcount: num(site.indirectHeadcount) },
      },
      standards: site.activeStandards.map((std) => {
        const cfg = site.standardConfigs[std];
        const autreAug =
          cfg.augmentation.autreValue.trim() !== ""
            ? { label: "Autre", valuePercent: num(cfg.augmentation.autreValue) }
            : undefined;
        const autreRed =
          cfg.reduction.autreValue.trim() !== ""
            ? { label: "Autre", valuePercent: -Math.abs(num(cfg.reduction.autreValue)) }
            : undefined;
        return {
          standard: std,
          active: true,
          stage: cfg.stage,
          riskLevel: cfg.riskLevel,
          stage1Selected: cfg.stage1Selected,
          stage2Selected: cfg.stage2Selected,
          factors: {
            standard: std,
            ticked: [...cfg.augmentation.ticked, ...cfg.reduction.ticked],
            autreAugmentation: autreAug,
            autreReduction: autreRed,
            justificationText: cfg.justificationText,
          },
          sampledThisYear: { 1: true, 2: cfg.sampledYear2, 3: cfg.sampledYear3 },
          isExtensionSite: false,
        };
      }),
    })),
  });

  const canSubmit = sites.every((s) => s.declaredTotal.trim() !== "" && s.activeStandards.length > 0) && !loading;

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.calculateCase(buildInput());
      setResult(res);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <Text style={styles.sectionTitle}>Dossier</Text>
      <NumberField label="Référence" value={dossierRef} onChangeText={setDossierRef} placeholder="Référence dossier" />
      <NumberField label="Durée du cycle" value={cycleYears} onChangeText={setCycleYears} suffix="ans" />
      {sites.length > 1 && <Text style={styles.multiSiteNote}>Dossier multi-sites ({sites.length} sites)</Text>}

      <Text style={styles.sectionTitle}>Sites</Text>
      {sites.map((site, i) => (
        <SiteEditor
          key={site.siteId}
          site={site}
          onChange={(next) => updateSite(i, next)}
          onRemove={sites.length > 1 ? () => removeSite(i) : undefined}
        />
      ))}
      <Pressable style={styles.addSiteButton} onPress={addSite}>
        <Text style={styles.addSiteButtonText}>+ Ajouter un site</Text>
      </Pressable>

      <Pressable style={[styles.calcButton, !canSubmit && styles.calcButtonDisabled]} onPress={handleCalculate} disabled={!canSubmit}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.calcButtonText}>Calculer la durée d'audit</Text>}
      </Pressable>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Total tous sites : {result.totalDaysAllSites} jours</Text>

          {result.orgRiskByStandard && Object.keys(result.orgRiskByStandard).length > 0 && (
            <View style={styles.orgRiskBox}>
              {Object.entries(result.orgRiskByStandard).map(([std, risk]) => (
                <Text key={std} style={styles.orgRiskText}>
                  Risque global {std} : {risk as string}
                </Text>
              ))}
            </View>
          )}

          {result.sampling?.length > 0 && (
            <View style={styles.samplingBox}>
              <Text style={styles.samplingTitle}>Échantillonnage (multi-sites)</Text>
              {result.sampling.map((s: any, i: number) => (
                <Text key={i} style={styles.samplingText}>
                  {s.standard} — année {s.year} : {s.sampleSize} site(s) sur {s.eligibleSiteCount}
                </Text>
              ))}
            </View>
          )}

          {result.warnings?.length > 0 && (
            <View style={styles.warnBox}>
              {result.warnings.map((w: string, i: number) => (
                <Text key={i} style={styles.warnText}>
                  ⚠ {w}
                </Text>
              ))}
            </View>
          )}

          {result.sites?.map((site: any) => (
            <View key={site.siteId} style={styles.siteResult}>
              <Text style={styles.siteResultTitle}>
                {site.name} — NAE {site.nae.totalNae}
              </Text>
              {site.standards.map((std: any) => (
                <View key={std.standard} style={styles.stdResult}>
                  <Text style={styles.stdResultTitle}>{std.standard}</Text>
                  <ResultRow
                    label="Base (IAF)"
                    value={`${std.baseDuration.days} j${std.baseDuration.extrapolated ? " (extrapolé)" : ""}`}
                  />
                  <ResultRow label="Facteurs" value={`${std.factorResult.finalPercent > 0 ? "+" : ""}${std.factorResult.finalPercent}%`} />
                  <ResultRow label="Net (avant étapes)" value={`${std.netDuration.toFixed(2)} j`} />
                  <ResultRow label="Étape 1" value={`${std.stage1Days.toFixed(2)} j`} />
                  <ResultRow label="Étape 2" value={`${std.stage2Days.toFixed(2)} j`} />
                  {std.years.map((y: any) => (
                    <ResultRow key={y.year} label={`Année ${y.year} (${y.stageCode || "-"})`} value={`${y.onSiteDurationFinal.toFixed(2)} j`} />
                  ))}
                  <ResultRow label="Préparation/rapport" value={`${std.prepReportFinal.toFixed(2)} j`} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{std.totalDaysFinal} j</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultRowLabel}>{label}</Text>
      <Text style={styles.resultRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 20, marginBottom: 8, color: "#1c1c1e" },
  multiSiteNote: { fontSize: 12, color: "#0066cc", fontWeight: "600", marginTop: 4 },
  addSiteButton: { borderWidth: 1, borderColor: "#1c1c1e", borderStyle: "dashed", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginBottom: 10 },
  addSiteButtonText: { color: "#1c1c1e", fontWeight: "600" },
  calcButton: { backgroundColor: "#1c1c1e", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  calcButtonDisabled: { backgroundColor: "#bbb" },
  calcButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  errorBox: { backgroundColor: "#fdecea", borderRadius: 10, padding: 12, marginTop: 16 },
  errorText: { color: "#c53030", fontSize: 13 },
  resultBox: { backgroundColor: "#eefaf0", borderRadius: 10, padding: 16, marginTop: 16 },
  resultTitle: { fontSize: 17, fontWeight: "700", color: "#1a7f37", marginBottom: 10 },
  orgRiskBox: { marginBottom: 10 },
  orgRiskText: { fontSize: 12, color: "#333", marginBottom: 2 },
  samplingBox: { backgroundColor: "#fff", borderRadius: 8, padding: 10, marginBottom: 10 },
  samplingTitle: { fontWeight: "700", fontSize: 12, marginBottom: 4, color: "#1c1c1e" },
  samplingText: { fontSize: 12, color: "#555" },
  warnBox: { marginBottom: 10 },
  warnText: { color: "#b7791f", fontSize: 12, marginBottom: 4 },
  siteResult: { marginTop: 8 },
  siteResultTitle: { fontWeight: "700", fontSize: 14, color: "#1c1c1e", marginBottom: 6 },
  stdResult: { backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#e0f0e3" },
  stdResultTitle: { fontWeight: "700", fontSize: 13, marginBottom: 6, color: "#1a7f37" },
  resultRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  resultRowLabel: { fontSize: 12, color: "#666" },
  resultRowValue: { fontSize: 12, color: "#333", fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#e0f0e3", marginTop: 6, paddingTop: 6 },
  totalLabel: { fontSize: 13, fontWeight: "700", color: "#1c1c1e" },
  totalValue: { fontSize: 13, fontWeight: "700", color: "#1a7f37" },
});
