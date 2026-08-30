import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RootStackParamList } from "../../App";
import { api, ApiError } from "../api/client";
import { CalculationCaseInput, NaceRiskEntry, StandardCode } from "../types/engine";
import Breadcrumbs from "../components/Breadcrumbs";
import StepTabs, { StepDef } from "../components/StepTabs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import NumberField from "../components/NumberField";
import DualSectorPicker from "../components/DualSectorPicker";
import PersonnelForm, { PersonnelFormValue, isPersonnelValid } from "../components/PersonnelForm";
import StandardConfigPanel, { StandardConfigState, emptyStandardConfig } from "../components/StandardConfigPanel";
import SynergyPanel, { SynergyFormValue, emptySynergy } from "../components/SynergyPanel";
import RoundingStepper from "../components/RoundingStepper";
import { useToast } from "../components/Toast";
import { resolveMostCriticalRisk } from "../utils/riskResolution";
import { useBreakpoint } from "../hooks/useBreakpoint";

type Props = NativeStackScreenProps<RootStackParamList, "CalculationWizard">;

const AVAILABLE_STANDARDS: StandardCode[] = ["ISO9001", "ISO45001", "ISO14001"];
const STEPS: StepDef[] = [
  { key: "sites", label: "Sites & Secteurs", shortLabel: "Sites" },
  { key: "personnel", label: "Effectif (NAE)", shortLabel: "Effectif" },
  { key: "factors", label: "Facteurs", shortLabel: "Facteurs" },
  { key: "recap", label: "Récapitulatif", shortLabel: "Récap" },
];

export interface WizardSite {
  siteId: string;
  name: string;
  isHq: boolean;
  sectors: NaceRiskEntry[];
  personnel: PersonnelFormValue;
  activeStandards: StandardCode[];
  standardConfigs: Record<string, StandardConfigState>;
  synergy: SynergyFormValue;
}

let siteCounter = 0;
function emptyWizardSite(isHq: boolean): WizardSite {
  siteCounter += 1;
  return {
    siteId: `site-${siteCounter}-${Date.now()}`,
    name: isHq ? "Siège" : `Site ${siteCounter}`,
    isHq,
    sectors: [],
    personnel: { declaredTotal: "", indirectHeadcount: "", nonShiftHeadcount: "", nonShiftPct: "0", shifts: [{ headcount: "", pctRepetitive: "0" }] },
    activeStandards: ["ISO9001"],
    standardConfigs: { ISO9001: emptyStandardConfig("ISO9001") },
    synergy: emptySynergy(),
  };
}

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

export default function CalculationWizardScreen({ route, navigation }: Props) {
  const { clientId, clientName, caseId } = route.params;
  const toast = useToast();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";

  const [existingCaseId, setExistingCaseId] = useState<number | undefined>(caseId);
  const [currentStep, setCurrentStep] = useState<string>("sites");
  const [dossierRef, setDossierRef] = useState("");
  const [cycleYears, setCycleYears] = useState("3");
  const [sites, setSites] = useState<WizardSite[]>([emptyWizardSite(true)]);
  const [activeSiteIndex, setActiveSiteIndex] = useState(0);

  const [loadingExisting, setLoadingExisting] = useState(!!caseId);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [roundingOverrides, setRoundingOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!caseId) return;
    api
      .getCase(caseId)
      .then(({ input, result: r, roundingOverrides: ro }) => {
        setDossierRef(input.dossierRef ?? "");
        setCycleYears(String(input.cycleYears ?? 3));
        setResult(r);
        setRoundingOverrides(ro ?? {});
        setCurrentStep("recap");
      })
      .catch((e) => toast.show(e instanceof ApiError ? e.message : "Erreur de chargement", "error"))
      .finally(() => setLoadingExisting(false));
  }, [caseId]);

  // --- All site mutations go through functional setState updates, reading
  // only from the PREVIOUS committed state, never from a closure-captured
  // `sites`/`activeSite` variable. Two edits landing in the same tick (e.g. a
  // field's onChange firing right as a step-tab or site-tab press fires)
  // previously risked the second update silently discarding the first,
  // because the update was built from a stale outer-scope snapshot. This is
  // what caused both "switching steps loses what I typed" and "a factor
  // entered on one site ends up not applied" — see BUGLOG.
  const updateSite = (index: number, updater: (site: WizardSite) => WizardSite) => {
    setSites((prev) => {
      const copy = [...prev];
      copy[index] = updater(copy[index]);
      return copy;
    });
  };

  const addSite = () => setSites((prev) => [...prev, emptyWizardSite(false)]);

  const removeSite = (index: number) => {
    setSites((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    setActiveSiteIndex((prev) => (prev >= sites.length - 1 ? 0 : prev));
  };

  const toggleStandard = (siteIndex: number, std: StandardCode) => {
    updateSite(siteIndex, (site) => {
      const active = site.activeStandards.includes(std);
      return {
        ...site,
        activeStandards: active ? site.activeStandards.filter((s) => s !== std) : [...site.activeStandards, std],
        standardConfigs: site.standardConfigs[std] ? site.standardConfigs : { ...site.standardConfigs, [std]: emptyStandardConfig(std) },
      };
    });
  };

  const setRounded = (key: string, v: number) => setRoundingOverrides((prev) => ({ ...prev, [key]: v }));

  const sitesValid = sites.every((s) => s.sectors.length > 0 && s.activeStandards.length > 0);

  const firstInvalidPersonnelIndex = useMemo(
    () => sites.findIndex((s) => !isPersonnelValid(s.personnel)),
    [sites]
  );
  const personnelValid = firstInvalidPersonnelIndex === -1;

  const completedKeys = ["sites", ...(sitesValid ? ["personnel"] : []), ...(sitesValid && personnelValid ? ["factors", "recap"] : [])];

  // --- Navigation: "Retour" (within-wizard step back) is local state only.
  // "Accueil" and breadcrumb jumps use a hard stack reset so the native
  // back button afterwards behaves predictably instead of returning into a
  // stale wizard screen still sitting in history from before the jump.
  const goHome = () => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] }));
  };
  const goToClientsList = () => {
    navigation.dispatch(CommonActions.reset({ index: 1, routes: [{ name: "Home" }, { name: "ClientsList" }] }));
  };
  const goToClientDetail = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 2,
        routes: [{ name: "Home" }, { name: "ClientsList" }, { name: "ClientDetail", params: { clientId, clientName } }],
      })
    );
  };

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
      naceCode: site.sectors.map((s) => s.codeNace).join(","),
      personnel: {
        siteId: site.siteId,
        declaredTotalHeadcount: num(site.personnel.declaredTotal),
        shiftTeams: site.personnel.shifts.map((s, i) => ({
          label: `Equipe ${i + 1}`,
          headcount: num(s.headcount),
          pctRepetitiveOrSimilar: num(s.pctRepetitive) / 100,
        })),
        nonShift: { headcount: num(site.personnel.nonShiftHeadcount), pctRepetitiveOrSimilar: num(site.personnel.nonShiftPct) / 100 },
        indirect: { headcount: num(site.personnel.indirectHeadcount) },
      },
      standards: site.activeStandards.map((std) => {
        const cfg = site.standardConfigs[std];
        const risk = resolveMostCriticalRisk(site.sectors, std) ?? "Moyen";
        const autreAug = cfg.augmentation.autreValue.trim() !== "" ? { label: "Autre", valuePercent: num(cfg.augmentation.autreValue) } : undefined;
        const autreRed = cfg.reduction.autreValue.trim() !== "" ? { label: "Autre", valuePercent: -Math.abs(num(cfg.reduction.autreValue)) } : undefined;
        const synergy =
          site.activeStandards.length >= 2 && site.synergy.enabled
            ? {
                auditorCapabilities: site.synergy.auditors.map((a, i) => ({
                  auditorId: a.id || `a${i}`,
                  qualifiedStandardCount: num(a.qualifiedCount),
                })),
                standardsCoveredCount: site.activeStandards.length,
                integrationLevel: site.synergy.integrationLevel,
              }
            : undefined;
        return {
          standard: std,
          active: true,
          stage: cfg.stage,
          riskLevel: risk,
          stage1Selected: cfg.stage1Selected,
          stage2Selected: cfg.stage2Selected,
          factors: {
            standard: std,
            ticked: [...cfg.augmentation.ticked, ...cfg.reduction.ticked],
            autreAugmentation: autreAug,
            autreReduction: autreRed,
            justificationText: cfg.justificationText,
          },
          synergy,
          sampledThisYear: { 1: true, 2: cfg.sampledYear2, 3: cfg.sampledYear3 },
          isExtensionSite: false,
        };
      }),
    })),
  });

  const goToRecap = async () => {
    setCalculating(true);
    try {
      const r = await api.calculateCase(buildInput());
      setResult(r);
      setRoundingOverrides({});
      setCurrentStep("recap");
      if (r.warnings?.length > 0) toast.show(r.warnings[0], "error");
    } catch (e: any) {
      toast.show(e instanceof ApiError ? e.message : "Erreur de calcul", "error");
    } finally {
      setCalculating(false);
    }
  };

  const save = async (status: "draft" | "calculated" | "validated") => {
    setSaving(true);
    try {
      const input = buildInput();
      if (existingCaseId) {
        await api.updateCase(existingCaseId, input, status, roundingOverrides);
      } else {
        const res = await api.saveCase({ ...input, clientId, status });
        setExistingCaseId(res.id);
      }
      toast.show("Calcul enregistré", "success");
    } catch (e: any) {
      toast.show(e instanceof ApiError ? e.message : "Erreur d'enregistrement", "error");
    } finally {
      setSaving(false);
    }
  };

  const roundKey = (siteId: string, std: string, field: string) => `${siteId}:${std}:${field}`;
  const getRounded = (key: string, calculated: number | null | undefined) => {
    const safe = typeof calculated === "number" && !Number.isNaN(calculated) ? calculated : 0;
    return roundingOverrides[key] ?? safe;
  };

  const finalTotal = result
    ? result.sites.reduce((sum: number, site: any) => {
        return (
          sum +
          site.standards.reduce((s2: number, std: any) => {
            let t = 0;
            t += getRounded(roundKey(site.siteId, std.standard, "stage1"), std.stage1Days);
            t += getRounded(roundKey(site.siteId, std.standard, "stage2"), std.stage2Days);
            std.years.forEach((y: any) => {
              if (y.year !== 1) t += getRounded(roundKey(site.siteId, std.standard, `year${y.year}`), y.onSiteDurationFinal);
              t += getRounded(roundKey(site.siteId, std.standard, `report${y.year}`), y.reportWritingFinal);
            });
            return s2 + t;
          }, 0)
        );
      }, 0)
    : 0;

  if (loadingExisting) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const activeSite = sites[activeSiteIndex];
  const currentSitePersonnelValid = isPersonnelValid(activeSite.personnel);
  const otherIncompleteSite =
    currentSitePersonnelValid && firstInvalidPersonnelIndex !== -1 && firstInvalidPersonnelIndex !== activeSiteIndex
      ? sites[firstInvalidPersonnelIndex]
      : null;

  return (
    <ResponsiveContainer maxWidth={1100}>
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20, paddingBottom: isMobile ? 90 : 30 }}>
          <View style={styles.topRow}>
            <Pressable onPress={goHome} style={styles.homeBtn} hitSlop={8}>
              <Ionicons name="home-outline" size={20} color="#1c1c1e" />
            </Pressable>
            <Breadcrumbs
              items={[
                { label: "Clients", onPress: goToClientsList },
                { label: clientName, onPress: goToClientDetail },
                { label: dossierRef || "Nouveau calcul" },
              ]}
            />
          </View>

          {!isMobile && <StepTabs steps={STEPS} current={currentStep} onSelect={setCurrentStep} completedKeys={completedKeys} />}

          {currentStep === "sites" && (
            <View>
              <Text style={styles.sectionTitle}>Dossier</Text>
              <NumberField label="Référence" value={dossierRef} onChangeText={setDossierRef} placeholder="Référence du calcul" />
              <NumberField label="Durée du cycle" value={cycleYears} onChangeText={setCycleYears} suffix="ans" />

              <Text style={styles.sectionTitle}>Sites</Text>
              {sites.map((site, i) => (
                <View key={site.siteId} style={styles.siteCard}>
                  <View style={styles.siteHeader}>
                    <NumberField label="Nom du site" value={site.name} onChangeText={(name) => updateSite(i, (s) => ({ ...s, name }))} />
                    {sites.length > 1 && (
                      <Pressable onPress={() => removeSite(i)} style={styles.removeSiteBtn}>
                        <Text style={styles.removeSiteText}>Retirer</Text>
                      </Pressable>
                    )}
                  </View>

                  <DualSectorPicker
                    selectedEntries={site.sectors}
                    onChange={(sectors) => updateSite(i, (s) => ({ ...s, sectors }))}
                    activeStandards={site.activeStandards}
                  />

                  <Text style={styles.label}>Normes concernées</Text>
                  <View style={styles.standardRow}>
                    {AVAILABLE_STANDARDS.map((std) => {
                      const active = site.activeStandards.includes(std);
                      return (
                        <Pressable key={std} style={[styles.stdChip, active && styles.stdChipActive]} onPress={() => toggleStandard(i, std)}>
                          <Text style={[styles.stdChipText, active && styles.stdChipTextActive]}>{std}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <Pressable style={styles.addSiteButton} onPress={addSite}>
                <Text style={styles.addSiteButtonText}>+ Ajouter un site</Text>
              </Pressable>

              <Pressable
                style={[styles.nextButton, !sitesValid && styles.nextButtonDisabled]}
                disabled={!sitesValid}
                onPress={() => setCurrentStep("personnel")}
              >
                <Text style={styles.nextButtonText}>Continuer vers l'effectif</Text>
              </Pressable>
              {!sitesValid && <Text style={styles.stepHint}>Chaque site a besoin d'au moins 1 secteur et 1 norme pour continuer.</Text>}
            </View>
          )}

          {currentStep === "personnel" && (
            <View>
              {sites.length > 1 && (
                <View style={styles.siteSelectorRow}>
                  {sites.map((s, i) => {
                    const ok = isPersonnelValid(s.personnel);
                    return (
                      <Pressable
                        key={s.siteId}
                        style={[styles.siteTab, activeSiteIndex === i && styles.siteTabActive]}
                        onPress={() => setActiveSiteIndex(i)}
                      >
                        <Text style={[styles.siteTabText, activeSiteIndex === i && styles.siteTabTextActive]}>
                          {s.name} {s.personnel.declaredTotal.trim() !== "" ? (ok ? "✓" : "•") : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <Text style={styles.sectionTitle}>Effectif — {activeSite.name}</Text>
              <PersonnelForm value={activeSite.personnel} onChange={(personnel) => updateSite(activeSiteIndex, (s) => ({ ...s, personnel }))} />

              {otherIncompleteSite && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxText}>
                    L'effectif de "{activeSite.name}" est complet. L'effectif de "{otherIncompleteSite.name}" doit encore être renseigné.
                  </Text>
                </View>
              )}

              <View style={styles.stepNavRow}>
                <Pressable style={styles.backButton} onPress={() => setCurrentStep("sites")}>
                  <Text style={styles.backButtonText}>Retour</Text>
                </Pressable>
                {otherIncompleteSite ? (
                  <Pressable style={styles.nextButton} onPress={() => setActiveSiteIndex(firstInvalidPersonnelIndex)}>
                    <Text style={styles.nextButtonText}>Aller à l'effectif de "{otherIncompleteSite.name}"</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.nextButton, !personnelValid && styles.nextButtonDisabled]}
                    disabled={!personnelValid}
                    onPress={() => setCurrentStep("factors")}
                  >
                    <Text style={styles.nextButtonText}>Continuer vers les facteurs</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {currentStep === "factors" && (
            <View>
              {sites.length > 1 && (
                <View style={styles.siteSelectorRow}>
                  {sites.map((s, i) => (
                    <Pressable
                      key={s.siteId}
                      style={[styles.siteTab, activeSiteIndex === i && styles.siteTabActive]}
                      onPress={() => setActiveSiteIndex(i)}
                    >
                      <Text style={[styles.siteTabText, activeSiteIndex === i && styles.siteTabTextActive]}>{s.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {sites.length > 1 && (
                <Text style={styles.siteSelectorHint}>
                  Chaque site (y compris le siège) a ses propres facteurs — vérifiez que vous êtes sur le bon onglet.
                </Text>
              )}
              <Text style={styles.sectionTitle}>Facteurs — {activeSite.name}</Text>
              {activeSite.activeStandards.length >= 2 && (
                <SynergyPanel
                  value={activeSite.synergy}
                  onChange={(synergy) => updateSite(activeSiteIndex, (s) => ({ ...s, synergy }))}
                  standardsCount={activeSite.activeStandards.length}
                />
              )}
              {activeSite.activeStandards.map((std) => (
                <StandardConfigPanel
                  key={std}
                  config={activeSite.standardConfigs[std] ?? emptyStandardConfig(std)}
                  resolvedRisk={resolveMostCriticalRisk(activeSite.sectors, std)}
                  onChange={(next) =>
                    updateSite(activeSiteIndex, (s) => ({ ...s, standardConfigs: { ...s.standardConfigs, [std]: next } }))
                  }
                />
              ))}

              <View style={styles.stepNavRow}>
                <Pressable style={styles.backButton} onPress={() => setCurrentStep("personnel")}>
                  <Text style={styles.backButtonText}>Retour</Text>
                </Pressable>
                <Pressable style={styles.nextButton} onPress={goToRecap} disabled={calculating}>
                  {calculating ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextButtonText}>Calculer</Text>}
                </Pressable>
              </View>
            </View>
          )}

          {currentStep === "recap" && (
            <View>
              <Text style={styles.sectionTitle}>Récapitulatif</Text>
              {!result && <Text style={styles.stepHint}>Aucun résultat pour l'instant — terminez les étapes précédentes puis "Calculer".</Text>}
              {result && (
                <>
                  {result.orgRiskByStandard && Object.keys(result.orgRiskByStandard).length > 0 && (
                    <View style={styles.recapBox}>
                      <Text style={styles.recapBoxTitle}>Risque global</Text>
                      {Object.entries(result.orgRiskByStandard).map(([std, risk]) => (
                        <Text key={std} style={styles.recapLine}>
                          {std} : {risk as string}
                        </Text>
                      ))}
                    </View>
                  )}

                  {result.sites.map((site: any) => {
                    const wizardSite = sites.find((s) => s.siteId === site.siteId);
                    return (
                      <View key={site.siteId} style={styles.recapSite}>
                        <Text style={styles.recapSiteTitle}>
                          {site.name} — NAE {site.nae.totalNae}
                        </Text>
                        {wizardSite && wizardSite.sectors.length > 0 && (
                          <Text style={styles.recapSectors}>
                            {wizardSite.sectors.map((s) => `${s.codeNace} (EAC ${s.codeEac})`).join(" · ")}
                          </Text>
                        )}
                        {site.standards.map((std: any) => (
                          <View key={std.standard} style={styles.recapStd}>
                            <Text style={styles.recapStdTitle}>{std.standard}</Text>
                            <Text style={styles.recapDetail}>
                              Base IAF : {std.baseDuration.days} j · Facteurs : {std.factorResult.finalPercent > 0 ? "+" : ""}
                              {std.factorResult.finalPercent}%
                              {std.synergyResult ? ` · Synergie : ${std.synergyFinalPercent}%` : ""}
                            </Text>

                            <View style={styles.yearGroup}>
                              <Text style={styles.yearGroupTitle}>Visite initiale</Text>
                              <RoundingStepper
                                label="Étape 1"
                                calculatedValue={std.stage1Days}
                                value={getRounded(roundKey(site.siteId, std.standard, "stage1"), std.stage1Days)}
                                onChange={(v) => setRounded(roundKey(site.siteId, std.standard, "stage1"), v)}
                              />
                              <RoundingStepper
                                label="Étape 2"
                                calculatedValue={std.stage2Days}
                                value={getRounded(roundKey(site.siteId, std.standard, "stage2"), std.stage2Days)}
                                onChange={(v) => setRounded(roundKey(site.siteId, std.standard, "stage2"), v)}
                              />
                              <RoundingStepper
                                label="Rédaction du rapport"
                                calculatedValue={std.years[0]?.reportWritingFinal}
                                value={getRounded(roundKey(site.siteId, std.standard, "report1"), std.years[0]?.reportWritingFinal)}
                                onChange={(v) => setRounded(roundKey(site.siteId, std.standard, "report1"), v)}
                              />
                            </View>

                            {std.years.slice(1).map((y: any) => (
                              <View key={y.year} style={styles.yearGroup}>
                                <Text style={styles.yearGroupTitle}>
                                  Année {y.year}
                                  {y.stageCode ? ` (${y.stageCode})` : ""}
                                  {!y.sampledThisYear ? " — non échantillonnée" : ""}
                                </Text>
                                <RoundingStepper
                                  label="Visite sur site"
                                  calculatedValue={y.onSiteDurationFinal}
                                  value={getRounded(roundKey(site.siteId, std.standard, `year${y.year}`), y.onSiteDurationFinal)}
                                  onChange={(v) => setRounded(roundKey(site.siteId, std.standard, `year${y.year}`), v)}
                                />
                                <RoundingStepper
                                  label="Rédaction du rapport"
                                  calculatedValue={y.reportWritingFinal}
                                  value={getRounded(roundKey(site.siteId, std.standard, `report${y.year}`), y.reportWritingFinal)}
                                  onChange={(v) => setRounded(roundKey(site.siteId, std.standard, `report${y.year}`), v)}
                                />
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    );
                  })}

                  <View style={styles.finalTotalBox}>
                    <Text style={styles.finalTotalLabel}>Durée totale à auditer</Text>
                    <Text style={styles.finalTotalValue}>{finalTotal.toFixed(2)} jours</Text>
                  </View>

                  <Pressable
                    style={styles.reportButton}
                    onPress={() =>
                      navigation.navigate("CalculationReport", {
                        clientName,
                        dossierRef,
                        sites,
                        result,
                        roundingOverrides,
                      })
                    }
                  >
                    <Text style={styles.reportButtonText}>📄 Voir le rapport de calcul complet</Text>
                  </Pressable>

                  <View style={styles.stepNavRow}>
                    <Pressable style={styles.backButton} onPress={() => setCurrentStep("factors")}>
                      <Text style={styles.backButtonText}>Retour</Text>
                    </Pressable>
                    <Pressable style={styles.saveButton} onPress={() => save("calculated")} disabled={saving}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextButtonText}>Enregistrer</Text>}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {isMobile && <StepTabs steps={STEPS} current={currentStep} onSelect={setCurrentStep} completedKeys={completedKeys} />}
      </View>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  homeBtn: { padding: 6, marginRight: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 16, marginBottom: 8, color: "#1c1c1e" },
  label: { fontSize: 13, color: "#444", marginTop: 6, marginBottom: 6, fontWeight: "600" },
  siteCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: "#1c1c1e" },
  siteHeader: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  removeSiteBtn: { marginBottom: 12 },
  removeSiteText: { color: "#c53030", fontSize: 12 },
  standardRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  stdChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: "#ddd" },
  stdChipActive: { backgroundColor: "#1c1c1e", borderColor: "#1c1c1e" },
  stdChipText: { fontSize: 13, color: "#333" },
  stdChipTextActive: { color: "#fff", fontWeight: "600" },
  addSiteButton: { borderWidth: 1, borderColor: "#1c1c1e", borderStyle: "dashed", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginBottom: 16 },
  addSiteButtonText: { color: "#1c1c1e", fontWeight: "600" },
  siteSelectorRow: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  siteSelectorHint: { fontSize: 11, color: "#b7791f", marginBottom: 10 },
  siteTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#f0f0f0" },
  siteTabActive: { backgroundColor: "#1c1c1e" },
  siteTabText: { fontSize: 12, color: "#555", fontWeight: "600" },
  siteTabTextActive: { color: "#fff" },
  stepNavRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  nextButton: { flex: 1, backgroundColor: "#1c1c1e", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  nextButtonDisabled: { backgroundColor: "#bbb" },
  nextButtonText: { color: "#fff", fontWeight: "700", fontSize: 15, textAlign: "center" },
  backButton: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: "#ddd" },
  backButtonText: { color: "#333", fontWeight: "600", fontSize: 14 },
  saveButton: { flex: 1, backgroundColor: "#1a7f37", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  stepHint: { fontSize: 12, color: "#b7791f", marginTop: 8, textAlign: "center" },
  infoBox: { backgroundColor: "#e7f0fb", borderRadius: 10, padding: 12, marginTop: 12 },
  infoBoxText: { fontSize: 13, color: "#1c4e80", fontWeight: "600" },
  recapBox: { backgroundColor: "#eefaf0", borderRadius: 10, padding: 12, marginBottom: 12 },
  recapBoxTitle: { fontWeight: "700", fontSize: 12, marginBottom: 4, color: "#1c1c1e" },
  recapLine: { fontSize: 12, color: "#333" },
  recapSite: { marginBottom: 16 },
  recapSiteTitle: { fontWeight: "700", fontSize: 14, color: "#1c1c1e", marginBottom: 2 },
  recapSectors: { fontSize: 11, color: "#888", marginBottom: 8 },
  recapStd: { backgroundColor: "#f9f9fb", borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#eee" },
  recapStdTitle: { fontWeight: "700", fontSize: 13, color: "#1c1c1e", marginBottom: 4 },
  recapDetail: { fontSize: 12, color: "#666", marginBottom: 2 },
  yearGroup: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e2e5",
    borderLeftWidth: 3,
    borderLeftColor: "#1c1c1e",
    paddingHorizontal: 10,
    paddingTop: 8,
    marginTop: 10,
  },
  yearGroupTitle: { fontSize: 12, fontWeight: "800", color: "#1c1c1e", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  finalTotalBox: { backgroundColor: "#1c1c1e", borderRadius: 12, padding: 18, alignItems: "center", marginTop: 8 },
  finalTotalLabel: { color: "#aaa", fontSize: 12, marginBottom: 4 },
  finalTotalValue: { color: "#fff", fontSize: 28, fontWeight: "800" },
  reportButton: { borderWidth: 1, borderColor: "#1c1c1e", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  reportButtonText: { color: "#1c1c1e", fontWeight: "700", fontSize: 14 },
});
