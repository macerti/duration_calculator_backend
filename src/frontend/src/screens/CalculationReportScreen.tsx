import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { api } from "../api/client";
import { ParameterSet } from "../types/engine";
import { resolveMostCriticalRisk } from "../utils/riskResolution";
import ResponsiveContainer from "../components/ResponsiveContainer";
import Breadcrumbs from "../components/Breadcrumbs";

type Props = NativeStackScreenProps<RootStackParamList, "CalculationReport">;

/**
 * Full traceability report — Option 2 from Mahdi's feedback: rather than
 * cluttering the wizard's input screens with a formula next to every field,
 * everything (inputs, formulas used, intermediate results, factors +
 * justifications, risk/sector basis, final program) is laid out here in one
 * place after the calculation, so the wizard itself stays simple while this
 * stays fully auditable. PDF export is on the roadmap, not built yet.
 */
export default function CalculationReportScreen({ route, navigation }: Props) {
  const { clientId, clientName, dossierRef, sites, result, roundingOverrides } = route.params;
  const [params, setParams] = useState<ParameterSet | null>(null);

  useEffect(() => {
    api.getParameters().then(setParams).catch(() => setParams(null));
  }, []);

  const factorLabel = (standard: string, direction: "augmentation" | "reduction", index: number): string => {
    if (!params) return `Facteur #${index}`;
    const item = params.factorCatalogue.find((f) => f.standard === standard && f.direction === direction && f.index === index);
    return item?.label ?? `Facteur #${index}`;
  };

  const getRounded = (key: string, calculated: number | null | undefined) => {
    const safe = typeof calculated === "number" && !Number.isNaN(calculated) ? calculated : 0;
    return roundingOverrides?.[key] ?? safe;
  };

  return (
    <ResponsiveContainer maxWidth={900}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* BUG-025 #1: the report previously relied on the native stack
            header's default back arrow (a separate, differently-styled back
            mechanism) instead of the breadcrumb hierarchy used everywhere
            else in the app. `navigation.goBack()` returns to the exact
            in-progress wizard/Synthèse state, since this screen is reached
            by a push, not a reset. */}
        <Breadcrumbs
          items={[
            { icon: "home-outline", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })) },
            {
              label: "Clients",
              onPress: () => navigation.dispatch(CommonActions.reset({ index: 1, routes: [{ name: "Home" }, { name: "ClientsList" }] })),
            },
            {
              label: clientName,
              onPress: () =>
                navigation.dispatch(
                  CommonActions.reset({ index: 2, routes: [{ name: "Home" }, { name: "ClientsList" }, { name: "ClientDetail", params: { clientId, clientName } }] })
                ),
            },
            { label: dossierRef || "Calcul", onPress: () => navigation.goBack() },
            { label: "Rapport" },
          ]}
        />
        <Text style={styles.title}>Rapport de calcul</Text>
        <Text style={styles.subtitle}>
          {clientName} — {dossierRef || "Sans référence"}
        </Text>
        <Text style={styles.generatedAt}>Généré le {new Date().toLocaleString("fr-FR")}</Text>

        {!params && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Chargement des libellés de facteurs…</Text>
          </View>
        )}

        {result.orgRiskByStandard && Object.keys(result.orgRiskByStandard).length > 0 && (
          <Section title="Risque global (multi-sites)">
            {Object.entries(result.orgRiskByStandard).map(([std, risk]) => (
              <Text key={std} style={styles.line}>
                {std} : <Text style={styles.bold}>{risk as string}</Text>
              </Text>
            ))}
          </Section>
        )}

        {result.sites.map((siteResult: any) => {
          const wizardSite = sites.find((s: any) => s.siteId === siteResult.siteId);
          return (
            <View key={siteResult.siteId} style={styles.siteBlock}>
              <Text style={styles.siteTitle}>
                {siteResult.name} {wizardSite?.isHq ? "(Siège)" : ""}
              </Text>

              {wizardSite && wizardSite.sectors.length > 0 && (
                <Section title="Identification">
                  <Text style={styles.line}>Client : {clientName}</Text>
                  <Text style={styles.line}>Site : {siteResult.name}</Text>
                  {wizardSite.sectors.map((s: any) => (
                    <Text key={s.codeNace} style={styles.line}>
                      Secteur : {s.description} (Code NACE {s.codeNace}, Code EAC {s.codeEac})
                    </Text>
                  ))}
                </Section>
              )}

              <Section title="Effectifs — détail et calcul du NAE">
                <Text style={styles.line}>Effectif total déclaré : {wizardSite?.personnel.declaredTotal ?? "—"}</Text>
                <Text style={styles.formulaLine}>{siteResult.nae.indirectLine.explanation}</Text>
                <Text style={styles.formulaLine}>{siteResult.nae.nonShiftLine.explanation}</Text>
                {siteResult.nae.shiftLines.map((line: any, i: number) => (
                  <Text key={i} style={styles.formulaLine}>
                    {line.label} : {line.explanation}
                  </Text>
                ))}
                <Text style={styles.line}>Équipes (agrégé) : {siteResult.nae.shiftAggregationExplanation}</Text>
                <Text style={[styles.line, styles.bold]}>NAE total (Nombre Ajusté d'Employés) : {siteResult.nae.totalNae}</Text>
              </Section>

              {siteResult.standards.map((std: any) => {
                const wizardCfg = wizardSite?.standardConfigs[std.standard];
                const autoRisk = wizardSite ? resolveMostCriticalRisk(wizardSite.sectors, std.standard) : null;
                const effectiveRisk = wizardCfg?.riskOverride ?? autoRisk;
                return (
                  <View key={std.standard}>
                    <Section title={`${std.standard} — Risque et base de calcul`}>
                      <Text style={styles.line}>
                        Niveau de risque retenu : <Text style={styles.bold}>{effectiveRisk ?? "—"}</Text>
                        {wizardCfg?.riskOverride && autoRisk && wizardCfg.riskOverride !== autoRisk
                          ? ` (auto-résolu : ${autoRisk}, modifié manuellement pour ce calcul)`
                          : ""}
                      </Text>
                      <Text style={styles.formulaLine}>
                        Durée de base IAF (NAE={siteResult.nae.totalNae}) : {std.baseDuration.days} j
                        {std.baseDuration.extrapolated ? " (extrapolée au-delà du dernier palier IAF)" : ""}
                      </Text>
                      <Text style={styles.formulaLine}>
                        {std.baseDuration.days} j (base) × {std.stageDayCoefficient.toFixed(3)} (coefficient d'étape "
                        {wizardCfg?.stage ?? "—"}") = {std.iafCalculated.toFixed(3)} j
                      </Text>
                      {std.synergyResult && (
                        <Text style={styles.formulaLine}>
                          Synergie (capacité équipe {std.synergyResult.capacityPercent.toFixed(1)}%) : {std.synergyFinalPercent}%
                        </Text>
                      )}
                    </Section>

                    <Section title={`${std.standard} — Facteurs d'augmentation / réduction`}>
                      {wizardCfg && wizardCfg.augmentation.ticked.length > 0 && (
                        <>
                          <Text style={styles.subheading}>Augmentations (catalogue) :</Text>
                          {wizardCfg.augmentation.ticked.map((t: any) => (
                            <Text key={t.index} style={styles.line}>
                              • {factorLabel(std.standard, "augmentation", t.index)} : +{t.valuePercent}%
                            </Text>
                          ))}
                        </>
                      )}
                      {wizardCfg && wizardCfg.reduction.ticked.length > 0 && (
                        <>
                          <Text style={styles.subheading}>Réductions (catalogue) :</Text>
                          {wizardCfg.reduction.ticked.map((t: any) => (
                            <Text key={t.index} style={styles.line}>
                              • {factorLabel(std.standard, "reduction", t.index)} : {t.valuePercent}%
                            </Text>
                          ))}
                        </>
                      )}
                      {wizardCfg && wizardCfg.justificationText.trim() !== "" && (
                        <Text style={styles.line}>Justification (catalogue) : {wizardCfg.justificationText}</Text>
                      )}
                      {wizardCfg && wizardCfg.autresAugmentation.length > 0 && (
                        <>
                          <Text style={styles.subheading}>Autres augmentations :</Text>
                          {wizardCfg.autresAugmentation.map((a: any, i: number) => (
                            <Text key={i} style={styles.line}>
                              • {a.label || "Autre"} : +{a.valuePercent || 0}% — justification : {a.justification?.trim() || "— non renseignée —"}
                            </Text>
                          ))}
                        </>
                      )}
                      {wizardCfg && wizardCfg.autresReduction.length > 0 && (
                        <>
                          <Text style={styles.subheading}>Autres réductions :</Text>
                          {wizardCfg.autresReduction.map((a: any, i: number) => (
                            <Text key={i} style={styles.line}>
                              • {a.label || "Autre"} : -{Math.abs(Number(a.valuePercent) || 0)}% — justification :{" "}
                              {a.justification?.trim() || "— non renseignée —"}
                            </Text>
                          ))}
                        </>
                      )}
                      <Text style={styles.line}>
                        Total appliqué : {std.factorResult.finalPercent > 0 ? "+" : ""}
                        {std.factorResult.finalPercent}%{std.factorResult.capsBreached ? " (plafonné)" : ""}
                      </Text>
                      <Text style={styles.formulaLine}>
                        {std.iafCalculated.toFixed(3)} × (1 {std.factorResult.finalPercent >= 0 ? "+" : "-"}{" "}
                        {Math.abs(std.factorResult.finalPercent)}%) = {std.iafWithFactors.toFixed(3)} j
                      </Text>
                    </Section>

                    <Section title={`${std.standard} — Programme d'audit`}>
                      <View style={styles.yearGroup}>
                        <Text style={styles.yearGroupTitle}>Visite initiale</Text>
                        <ProgramLine
                          label="Étape 1"
                          calculated={std.stage1Days}
                          final={getRounded(`${siteResult.siteId}:${std.standard}:stage1`, std.stage1Days)}
                        />
                        <ProgramLine
                          label="Étape 2"
                          calculated={std.stage2Days}
                          final={getRounded(`${siteResult.siteId}:${std.standard}:stage2`, std.stage2Days)}
                        />
                        <ProgramLine
                          label="Rédaction du rapport"
                          calculated={std.years[0]?.reportWritingFinal}
                          final={getRounded(`${siteResult.siteId}:${std.standard}:report1`, std.years[0]?.reportWritingFinal)}
                        />
                      </View>
                      {std.years.slice(1).map((y: any) => (
                        <View key={y.year} style={styles.yearGroup}>
                          <Text style={styles.yearGroupTitle}>
                            Année {y.year} — {y.sampledThisYear ? "échantillonnée" : "non échantillonnée cette année"}
                          </Text>
                          <ProgramLine
                            label="Visite sur site"
                            calculated={y.onSiteDurationFinal}
                            final={getRounded(`${siteResult.siteId}:${std.standard}:year${y.year}`, y.onSiteDurationFinal)}
                          />
                          <ProgramLine
                            label="Rédaction du rapport"
                            calculated={y.reportWritingFinal}
                            final={getRounded(`${siteResult.siteId}:${std.standard}:report${y.year}`, y.reportWritingFinal)}
                          />
                        </View>
                      ))}
                    </Section>
                  </View>
                );
              })}
            </View>
          );
        })}

        {result.sampling?.length > 0 && (
          <Section title="Échantillonnage multi-sites (IAF MD1)">
            {result.sampling.map((s: any, i: number) => (
              <Text key={i} style={styles.line}>
                {s.standard} — année {s.year} : {s.sampleSize} site(s) sur {s.eligibleSiteCount} éligibles
              </Text>
            ))}
          </Section>
        )}

        <View style={styles.archiveNote}>
          <Text style={styles.archiveNoteText}>
            Ce rapport reflète les données saisies, les règles GS0106/IAF appliquées, les facteurs et justificatifs
            renseignés, et les ajustements manuels effectués au moment de sa génération. L'export PDF n'est pas
            encore disponible — fonctionnalité prévue sur la feuille de route.
          </Text>
        </View>
      </ScrollView>
    </ResponsiveContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ProgramLine({ label, calculated, final }: { label: string; calculated: number; final: number }) {
  const adjusted = Math.abs(final - calculated) > 0.001;
  return (
    <Text style={styles.line}>
      {label} : <Text style={styles.bold}>{final.toFixed(2)} j</Text>
      {adjusted ? ` (calculé : ${calculated.toFixed(2)} j, ajusté manuellement)` : ""}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: "800", color: "#1c1c1e" },
  subtitle: { fontSize: 14, color: "#555", marginTop: 4 },
  generatedAt: { fontSize: 11, color: "#999", marginTop: 2, marginBottom: 16 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  loadingText: { fontSize: 12, color: "#888" },
  siteBlock: { marginTop: 16, borderTopWidth: 2, borderTopColor: "#1c1c1e", paddingTop: 12 },
  siteTitle: { fontSize: 17, fontWeight: "800", color: "#1c1c1e", marginBottom: 8 },
  section: { backgroundColor: "#f9f9fb", borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#eee" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#1c1c1e", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.3 },
  subheading: { fontSize: 12, fontWeight: "700", color: "#555", marginTop: 8, marginBottom: 2 },
  yearGroup: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e2e5",
    borderLeftWidth: 3,
    borderLeftColor: "#1c1c1e",
    paddingHorizontal: 10,
    paddingTop: 8,
    marginTop: 8,
  },
  yearGroupTitle: { fontSize: 11, fontWeight: "800", color: "#1c1c1e", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  line: { fontSize: 13, color: "#333", marginBottom: 3, lineHeight: 18 },
  formulaLine: { fontSize: 12, color: "#777", fontFamily: "monospace", marginBottom: 3 },
  bold: { fontWeight: "700", color: "#1c1c1e" },
  archiveNote: { backgroundColor: "#fff8e6", borderRadius: 10, padding: 12, marginTop: 16 },
  archiveNoteText: { fontSize: 12, color: "#7a5c00", lineHeight: 17 },
});
