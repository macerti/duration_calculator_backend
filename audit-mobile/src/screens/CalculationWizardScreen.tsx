import React, { useEffect, useMemo, useRef, useState } from "react";
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
import TextField from "../components/TextField";
import DualSectorPicker from "../components/DualSectorPicker";
import PersonnelForm, { PersonnelFormValue, isPersonnelValid } from "../components/PersonnelForm";
import StandardConfigPanel, { StandardConfigState, emptyStandardConfig } from "../components/StandardConfigPanel";
import SynergyPanel, { SynergyFormValue, emptySynergy, deriveIntegrationLevel } from "../components/SynergyPanel";
import RoundingStepper from "../components/RoundingStepper";
import { useToast } from "../components/Toast";
import { resolveMostCriticalRisk } from "../utils/riskResolution";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { colors, radius, spacing, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "CalculationWizard">;

const AVAILABLE_STANDARDS: StandardCode[] = ["ISO9001", "ISO45001", "ISO14001"];
const STEPS: StepDef[] = [
  { key: "sites", label: "Sites & Secteurs", shortLabel: "Sites" },
  { key: "personnel", label: "Effectif (NAE)", shortLabel: "Effectif" },
  { key: "factors", label: "Facteurs", shortLabel: "Facteurs" },
  { key: "synthese", label: "Synthèse", shortLabel: "Synthèse" },
];
const AUTOSAVE_DEBOUNCE_MS = 1200;

export interface WizardSite {
  siteId: string;
  isHq: boolean;
  displayName: string; // the editable part — fixed "Siège"/"Site NN" label is derived from position, not stored
  address: string;
  sectors: NaceRiskEntry[];
  personnel: PersonnelFormValue;
  activeStandards: StandardCode[];
  standardConfigs: Record<string, StandardConfigState>;
  synergy: SynergyFormValue;
}

let siteCounter = 0;
function emptyWizardSite(isHq: boolean, prefillName: string): WizardSite {
  siteCounter += 1;
  return {
    siteId: `site-${siteCounter}-${Date.now()}`,
    isHq,
    displayName: prefillName,
    address: "",
    sectors: [],
    personnel: { declaredTotal: "", indirectHeadcount: "", nonShiftHeadcount: "", nonShiftPct: "0", shifts: [{ headcount: "", pctRepetitive: "0" }] },
    activeStandards: ["ISO9001"],
    standardConfigs: { ISO9001: emptyStandardConfig("ISO9001") },
    synergy: emptySynergy(),
  };
}

/** "Siège" for the HQ, "Site 01"/"Site 02"/... for the rest, numbered by
 * position among non-HQ sites so deleting one renumbers the remainder
 * automatically — never a stored, staleable number. */
function siteKindLabel(site: WizardSite, allSites: WizardSite[]): string {
  if (site.isHq) return "Siège";
  const nonHq = allSites.filter((s) => !s.isHq);
  const position = nonHq.findIndex((s) => s.siteId === site.siteId);
  return `Site ${String(position + 1).padStart(2, "0")}`;
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
  const [sites, setSites] = useState<WizardSite[]>([emptyWizardSite(true, clientName)]);
  const [activeSiteIndex, setActiveSiteIndex] = useState(0);
  const [activeStandardTab, setActiveStandardTab] = useState<StandardCode | null>(null);
  // BUG-025 #3 root cause: the Synthèse per-site standard tab was previously
  // read from `activeStandardTab`/`stdTab`, which are scoped to the single
  // site being edited in the Facteurs step (`activeSite`). Synthèse renders
  // ALL sites at once, so reusing that single shared value meant (a) tapping
  // a second-standard tab for a site other than the current Facteurs-active
  // one had no visible effect whenever the Facteurs-active site didn't also
  // have that standard, and (b) even when it did appear to work, selecting a
  // standard for one site would leak into every other site sharing that
  // standard. This is a separate, per-site-keyed selection instead.
  const [syntheseStandardTabBySite, setSyntheseStandardTabBySite] = useState<Record<string, StandardCode>>({});

  const [loadingExisting, setLoadingExisting] = useState(!!caseId);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [roundingOverrides, setRoundingOverrides] = useState<Record<string, number>>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);

  const hydratedRef = useRef(false); // guards against autosave firing before initial load/create finishes
  const prevStepRef = useRef(currentStep);

  // BUG-027 #1 root cause: activeSiteIndex is shared across the Effectif and
  // Facteurs steps. Effectif lets the user jump between site tabs freely, so
  // whichever site was last active there stayed active when Facteurs opened —
  // Facteurs could open on the last-viewed site instead of Siège. Reset only
  // on the transition INTO "factors" (guarded by prevStepRef so this doesn't
  // fire on every render while already in the step, which would fight the
  // Précédent/Site suivant navigation below).
  useEffect(() => {
    if (currentStep === "factors" && prevStepRef.current !== "factors") {
      setActiveSiteIndex(0);
    }
    prevStepRef.current = currentStep;
  }, [currentStep]);

  // --- Load an existing case, fully hydrating editable state from wizardState ---
  useEffect(() => {
    if (!caseId) return;
    api
      .getCase(caseId)
      .then(({ input, result: r, roundingOverrides: ro, wizardState }) => {
        setDossierRef(input.dossierRef ?? "");
        setCycleYears(String(input.cycleYears ?? 3));
        setResult(r);
        setRoundingOverrides(ro ?? {});
        if (wizardState && Array.isArray(wizardState) && wizardState.length > 0) {
          setSites(wizardState as WizardSite[]);
          setCurrentStep("sites"); // full data available — let them edit from the start, not just view Synthèse
        } else {
          // Older saved case, no wizardState — known limitation, see ROADMAP.md.
          setCurrentStep("synthese");
        }
        hydratedRef.current = true;
      })
      .catch((e) => toast.show(e instanceof ApiError ? e.message : "Erreur de chargement", "error"))
      .finally(() => setLoadingExisting(false));
  }, [caseId]);

  const createInitialDraft = async () => {
    if (caseId || existingCaseId) return;
    setDraftSaveError(null);
    hydratedRef.current = false;
    try {
      const res = await api.saveCase({ ...buildInput(), clientId, status: "draft", wizardState: sites });
      setExistingCaseId(res.id);
      hydratedRef.current = true;
      setLastSavedAt(new Date());
    } catch (e: any) {
      // Do not swallow the failure: without a case id there is nothing for
      // autosave to PUT. Keep the wizard usable, but make the unsaved state
      // explicit and give the user a deterministic retry path.
      hydratedRef.current = false;
      setDraftSaveError(e instanceof ApiError ? e.message : "Impossible d'enregistrer le brouillon.");
    }
  };

  // --- Create a draft immediately for a brand-new calculation, before any real data exists ---
  useEffect(() => {
    void createInitialDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Debounced autosave on every change, once hydrated/created ---
  useEffect(() => {
    if (!hydratedRef.current || !existingCaseId) return;
    const timer = setTimeout(() => {
      api
        .updateCase(existingCaseId, buildInput(), undefined, undefined, sites)
        .then(() => setLastSavedAt(new Date()))
        .catch(() => toast.show("Échec de la sauvegarde automatique — vérifiez votre connexion.", "error"));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, dossierRef, cycleYears, existingCaseId]);

  const updateSite = (index: number, updater: (site: WizardSite) => WizardSite) => {
    setSites((prev) => {
      const copy = [...prev];
      copy[index] = updater(copy[index]);
      return copy;
    });
  };

  const addSite = () => setSites((prev) => [...prev, emptyWizardSite(false, "")]);

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

  const firstInvalidPersonnelIndex = useMemo(() => sites.findIndex((s) => !isPersonnelValid(s.personnel)), [sites]);
  const personnelValid = firstInvalidPersonnelIndex === -1;

  const completedKeys = ["sites", ...(sitesValid ? ["personnel"] : []), ...(sitesValid && personnelValid ? ["factors", "synthese"] : [])];

  const goHome = () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] }));
  const goToClientsList = () =>
    navigation.dispatch(CommonActions.reset({ index: 1, routes: [{ name: "Home" }, { name: "ClientsList" }] }));
  const goToClientDetail = () =>
    navigation.dispatch(
      CommonActions.reset({ index: 2, routes: [{ name: "Home" }, { name: "ClientsList" }, { name: "ClientDetail", params: { clientId, clientName } }] })
    );

  function buildInput(): CalculationCaseInput {
    return {
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
        name: site.displayName || siteKindLabel(site, sites),
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
          const risk = cfg.riskOverride ?? resolveMostCriticalRisk(site.sectors, std) ?? "Moyen";
          const autresAugmentation = cfg.autresAugmentation
            .filter((a) => a.label.trim() !== "" || num(a.valuePercent) !== 0)
            .map((a) => ({ label: a.label || "Autre", valuePercent: num(a.valuePercent) }));
          const autresReduction = cfg.autresReduction
            .filter((a) => a.label.trim() !== "" || num(a.valuePercent) !== 0)
            .map((a) => ({ label: a.label || "Autre", valuePercent: -Math.abs(num(a.valuePercent)) }));
          const synergy =
            site.activeStandards.length >= 2 && site.synergy.enabled
              ? {
                  auditorCapabilities: site.synergy.auditors.map((a, i) => ({
                    auditorId: a.id || `a${i}`,
                    qualifiedStandardCount: Object.values(a.qualifiedStandards).filter(Boolean).length,
                  })),
                  standardsCoveredCount: site.activeStandards.length,
                  integrationLevel: deriveIntegrationLevel(site.synergy),
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
              autresAugmentation,
              autresReduction,
              justificationText: cfg.justificationText,
            },
            synergy,
            sampledThisYear: { 1: true, 2: cfg.sampledYear2, 3: cfg.sampledYear3 },
            isExtensionSite: false,
          };
        }),
      })),
    };
  }

  const goToSynthese = async () => {
    setCalculating(true);
    try {
      const r = await api.calculateCase(buildInput());
      setResult(r);
      setRoundingOverrides({});
      setCurrentStep("synthese");
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
        await api.updateCase(existingCaseId, input, status, roundingOverrides, sites);
      } else {
        const res = await api.saveCase({ ...input, clientId, status, wizardState: sites });
        setExistingCaseId(res.id);
      }
      setLastSavedAt(new Date());
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

  // Sub-tab for the currently selected site's standards (used by both Facteurs and Synthèse)
  const stdTab = activeStandardTab && activeSite.activeStandards.includes(activeStandardTab) ? activeStandardTab : activeSite.activeStandards[0];

  const sampleSizeHintFor = (std: StandardCode) => result?.sampling?.filter((s: any) => s.standard === std);

  return (
    <ResponsiveContainer maxWidth={1100}>
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20, paddingBottom: isMobile ? 90 : 30 }}>
          <View style={styles.topRow}>
            <Breadcrumbs
              items={[
                { icon: "home-outline", onPress: goHome },
                { label: "Clients", onPress: goToClientsList },
                { label: clientName, onPress: goToClientDetail },
                { label: dossierRef || "Nouveau calcul" },
              ]}
            />
            {lastSavedAt && (
              <Text style={styles.savedIndicator}>Enregistré {lastSavedAt.toLocaleTimeString("fr-FR")}</Text>
            )}
            <Pressable
              style={styles.headerSaveBtn}
              onPress={() => void save(result ? "calculated" : "draft")}
              disabled={saving}
              hitSlop={8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.contentInverse} />
              ) : (
                <Ionicons name="save-outline" size={16} color={colors.contentInverse} />
              )}
            </Pressable>
          </View>

          {draftSaveError && (
            <View style={styles.draftErrorBox}>
              <Text style={styles.draftErrorText}>Brouillon non enregistré : {draftSaveError}</Text>
              <Pressable style={styles.retryButton} onPress={() => void createInitialDraft()} disabled={saving}>
                <Text style={styles.retryButtonText}>Réessayer l'enregistrement</Text>
              </Pressable>
            </View>
          )}

          {!isMobile && <StepTabs steps={STEPS} current={currentStep} onSelect={setCurrentStep} completedKeys={completedKeys} />}

          {currentStep === "sites" && (
            <View>
              <Text style={styles.sectionTitle}>Dossier</Text>
              <NumberField label="Référence" value={dossierRef} onChangeText={setDossierRef} placeholder="Référence du calcul" />
              <NumberField label="Durée du cycle" value={cycleYears} onChangeText={setCycleYears} suffix="ans" />

              <Text style={styles.sectionTitle}>Sites</Text>
              {sites.map((site, i) => (
                <View key={site.siteId} style={styles.siteCard}>
                  <View style={styles.siteKindRow}>
                    {site.isHq && <Ionicons name="business-outline" size={20} color={colors.contentPrimary} style={{ marginRight: 6 }} />}
                    <Text style={styles.siteKindLabel}>{siteKindLabel(site, sites)}</Text>
                    {sites.length > 1 && !site.isHq && (
                      <Pressable onPress={() => removeSite(i)} style={styles.removeSiteBtn}>
                        <Text style={styles.removeSiteText}>Retirer</Text>
                      </Pressable>
                    )}
                  </View>
                  <TextField
                    label={site.isHq ? "Nom (pré-rempli avec le nom du client, modifiable)" : "Nom du site (optionnel)"}
                    value={site.displayName}
                    onChangeText={(displayName) => updateSite(i, (s) => ({ ...s, displayName }))}
                    placeholder={site.isHq ? clientName : "Ex: Usine Nord"}
                  />
                  <TextField
                    label="Adresse (optionnel)"
                    value={site.address}
                    onChangeText={(address) => updateSite(i, (s) => ({ ...s, address }))}
                    placeholder="Adresse du site"
                  />

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
                      <Pressable key={s.siteId} style={[styles.siteTab, activeSiteIndex === i && styles.siteTabActive]} onPress={() => setActiveSiteIndex(i)}>
                        <Text style={[styles.siteTabText, activeSiteIndex === i && styles.siteTabTextActive]}>
                          {siteKindLabel(s, sites)} {s.personnel.declaredTotal.trim() !== "" ? (ok ? "✓" : "•") : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <Text style={styles.sectionTitle}>
                Effectif — {siteKindLabel(activeSite, sites)}
                {activeSite.displayName ? ` (${activeSite.displayName})` : ""}
              </Text>
              <PersonnelForm value={activeSite.personnel} onChange={(personnel) => updateSite(activeSiteIndex, (s) => ({ ...s, personnel }))} />

              {otherIncompleteSite && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxText}>
                    L'effectif de "{siteKindLabel(activeSite, sites)}" est complet. L'effectif de "
                    {siteKindLabel(otherIncompleteSite, sites)}" doit encore être renseigné.
                  </Text>
                </View>
              )}

              <View style={styles.stepNavRow}>
                <Pressable style={styles.backButton} onPress={() => setCurrentStep("sites")}>
                  <Text style={styles.backButtonText}>Retour</Text>
                </Pressable>
                {otherIncompleteSite ? (
                  <Pressable style={styles.nextButton} onPress={() => setActiveSiteIndex(firstInvalidPersonnelIndex)}>
                    <Text style={styles.nextButtonText}>Aller à l'effectif de "{siteKindLabel(otherIncompleteSite, sites)}"</Text>
                  </Pressable>
                ) : (
                  <Pressable style={[styles.nextButton, !personnelValid && styles.nextButtonDisabled]} disabled={!personnelValid} onPress={() => setCurrentStep("factors")}>
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
                    <Pressable key={s.siteId} style={[styles.siteTab, activeSiteIndex === i && styles.siteTabActive]} onPress={() => setActiveSiteIndex(i)}>
                      <Text style={[styles.siteTabText, activeSiteIndex === i && styles.siteTabTextActive]}>{siteKindLabel(s, sites)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={styles.sectionTitle}>
                Facteurs — {siteKindLabel(activeSite, sites)}
                {activeSite.displayName ? ` (${activeSite.displayName})` : ""}
              </Text>

              {activeSite.activeStandards.length >= 2 && (
                <SynergyPanel
                  value={activeSite.synergy}
                  onChange={(synergy) => updateSite(activeSiteIndex, (s) => ({ ...s, synergy }))}
                  standards={activeSite.activeStandards}
                />
              )}

              {activeSite.activeStandards.length > 1 && (
                <View style={styles.standardSubTabs}>
                  {activeSite.activeStandards.map((std) => (
                    <Pressable key={std} style={[styles.subTab, stdTab === std && styles.subTabActive]} onPress={() => setActiveStandardTab(std)}>
                      <Text style={[styles.subTabText, stdTab === std && styles.subTabTextActive]}>{std}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {stdTab && (
                <StandardConfigPanel
                  key={stdTab}
                  config={activeSite.standardConfigs[stdTab] ?? emptyStandardConfig(stdTab)}
                  resolvedRisk={resolveMostCriticalRisk(activeSite.sectors, stdTab)}
                  sampleSizeHint={sampleSizeHintFor(stdTab)}
                  onChange={(next) => updateSite(activeSiteIndex, (s) => ({ ...s, standardConfigs: { ...s.standardConfigs, [stdTab]: next } }))}
                />
              )}

              <View style={styles.stepNavRow}>
                <Pressable
                  style={styles.backButton}
                  onPress={() => (activeSiteIndex > 0 ? setActiveSiteIndex(activeSiteIndex - 1) : setCurrentStep("personnel"))}
                >
                  <Text style={styles.backButtonText}>
                    {activeSiteIndex > 0 ? `Précédent (${siteKindLabel(sites[activeSiteIndex - 1], sites)})` : "Retour"}
                  </Text>
                </Pressable>
                {activeSiteIndex < sites.length - 1 ? (
                  // Sequential guided flow (BUG-027 #1): with 2+ sites, the primary
                  // forward action moves to the next site — Siège → Site 01 → Site
                  // 02 → … — rather than exposing "Calculer" while sites remain
                  // unprocessed. Clicking through without entering factors is the
                  // "explicit skip" the bug asks for, since Facteurs entry has no
                  // validation gate. The site-tab row above still allows jumping
                  // directly to any site for users who prefer that.
                  <Pressable style={styles.nextButton} onPress={() => setActiveSiteIndex(activeSiteIndex + 1)}>
                    <Text style={styles.nextButtonText}>Site suivant — {siteKindLabel(sites[activeSiteIndex + 1], sites)}</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.nextButton} onPress={goToSynthese} disabled={calculating}>
                    {calculating ? <ActivityIndicator color={colors.contentInverse} /> : <Text style={styles.nextButtonText}>Calculer</Text>}
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {currentStep === "synthese" && (
            <View>
              <Text style={styles.sectionTitle}>Synthèse</Text>
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

                  {result.sites.map((siteResult: any) => {
                    const wizardSite = sites.find((s) => s.siteId === siteResult.siteId);
                    const selectedStdForSite = syntheseStandardTabBySite[siteResult.siteId];
                    const siteStdTab =
                      wizardSite && selectedStdForSite && wizardSite.activeStandards.includes(selectedStdForSite)
                        ? selectedStdForSite
                        : wizardSite?.activeStandards[0] ?? siteResult.standards[0]?.standard;
                    const stdResult = siteResult.standards.find((st: any) => st.standard === siteStdTab) ?? siteResult.standards[0];
                    return (
                      <View key={siteResult.siteId} style={styles.recapSite}>
                        <Text style={styles.recapSiteTitle}>
                          {wizardSite ? siteKindLabel(wizardSite, sites) : siteResult.name}
                          {wizardSite?.displayName ? ` (${wizardSite.displayName})` : ""} — NAE {siteResult.nae.totalNae}
                        </Text>
                        {wizardSite && wizardSite.sectors.length > 0 && (
                          <Text style={styles.recapSectors}>{wizardSite.sectors.map((s) => `${s.codeNace} (EAC ${s.codeEac})`).join(" · ")}</Text>
                        )}

                        {siteResult.standards.length > 1 && (
                          <View style={styles.standardSubTabs}>
                            {siteResult.standards.map((st: any) => (
                              <Pressable
                                key={st.standard}
                                style={[styles.subTab, (siteStdTab === st.standard) && styles.subTabActive]}
                                onPress={() =>
                                  setSyntheseStandardTabBySite((prev) => ({ ...prev, [siteResult.siteId]: st.standard }))
                                }
                              >
                                <Text style={[styles.subTabText, siteStdTab === st.standard && styles.subTabTextActive]}>{st.standard}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}

                        {stdResult && (
                          <View style={styles.recapStd}>
                            <Text style={styles.recapDetail}>
                              Base IAF : {stdResult.baseDuration.days} j · Facteurs : {stdResult.factorResult.finalPercent > 0 ? "+" : ""}
                              {stdResult.factorResult.finalPercent}%
                              {stdResult.synergyResult ? ` · Synergie : ${stdResult.synergyFinalPercent}%` : ""}
                            </Text>

                            <View style={styles.yearGroup}>
                              <Text style={styles.yearGroupTitle}>Visite initiale</Text>
                              <RoundingStepper
                                label="Étape 1"
                                calculatedValue={stdResult.stage1Days}
                                value={getRounded(roundKey(siteResult.siteId, stdResult.standard, "stage1"), stdResult.stage1Days)}
                                onChange={(v) => setRounded(roundKey(siteResult.siteId, stdResult.standard, "stage1"), v)}
                                step={0.01}
                              />
                              <RoundingStepper
                                label="Étape 2"
                                calculatedValue={stdResult.stage2Days}
                                value={getRounded(roundKey(siteResult.siteId, stdResult.standard, "stage2"), stdResult.stage2Days)}
                                onChange={(v) => setRounded(roundKey(siteResult.siteId, stdResult.standard, "stage2"), v)}
                                step={0.01}
                              />
                              <RoundingStepper
                                label="Rédaction du rapport"
                                calculatedValue={stdResult.years[0]?.reportWritingFinal}
                                value={getRounded(roundKey(siteResult.siteId, stdResult.standard, "report1"), stdResult.years[0]?.reportWritingFinal)}
                                onChange={(v) => setRounded(roundKey(siteResult.siteId, stdResult.standard, "report1"), v)}
                                step={0.01}
                              />
                            </View>
                            {stdResult.years.slice(1).map((y: any) => (
                              <View key={y.year} style={styles.yearGroup}>
                                <Text style={styles.yearGroupTitle}>
                                  Année {y.year}
                                  {y.stageCode ? ` (${y.stageCode})` : ""}
                                  {!y.sampledThisYear ? " — non échantillonnée" : ""}
                                </Text>
                                <RoundingStepper
                                  label="Visite sur site"
                                  calculatedValue={y.onSiteDurationFinal}
                                  value={getRounded(roundKey(siteResult.siteId, stdResult.standard, `year${y.year}`), y.onSiteDurationFinal)}
                                  onChange={(v) => setRounded(roundKey(siteResult.siteId, stdResult.standard, `year${y.year}`), v)}
                                  step={0.01}
                                />
                                <RoundingStepper
                                  label="Rédaction du rapport"
                                  calculatedValue={y.reportWritingFinal}
                                  value={getRounded(roundKey(siteResult.siteId, stdResult.standard, `report${y.year}`), y.reportWritingFinal)}
                                  onChange={(v) => setRounded(roundKey(siteResult.siteId, stdResult.standard, `report${y.year}`), v)}
                                  step={0.01}
                                />
                              </View>
                            ))}
                          </View>
                        )}

                        {(() => {
                          // BUG-027 #2: the single global "Durée totale à auditer"
                          // number at the bottom of Synthèse didn't let anyone see
                          // how a site's total broke down by year or by standard.
                          // This derives that breakdown from the same rounded
                          // values (getRounded/roundKey) already driving the
                          // RoundingSteppers above and the grand total below, so
                          // it can never disagree with either — it's presentation
                          // only, no new calculation. Keyed by year number rather
                          // than assuming every standard shares the same `.years`
                          // length, in case cycle length ever differs per standard.
                          const yearMap = new Map<number, { total: number; byStandard: { standard: string; days: number }[] }>();
                          siteResult.standards.forEach((std: any) => {
                            std.years.forEach((y: any) => {
                              const days =
                                y.year === 1
                                  ? getRounded(roundKey(siteResult.siteId, std.standard, "stage1"), std.stage1Days) +
                                    getRounded(roundKey(siteResult.siteId, std.standard, "stage2"), std.stage2Days) +
                                    getRounded(roundKey(siteResult.siteId, std.standard, "report1"), y.reportWritingFinal)
                                  : getRounded(roundKey(siteResult.siteId, std.standard, `year${y.year}`), y.onSiteDurationFinal) +
                                    getRounded(roundKey(siteResult.siteId, std.standard, `report${y.year}`), y.reportWritingFinal);
                              const entry = yearMap.get(y.year) ?? { total: 0, byStandard: [] };
                              entry.total += days;
                              entry.byStandard.push({ standard: std.standard, days });
                              yearMap.set(y.year, entry);
                            });
                          });
                          const years = Array.from(yearMap.keys()).sort((a, b) => a - b);
                          if (years.length === 0) return null;
                          return (
                            <View style={styles.yearlyBreakdownBox}>
                              <Text style={styles.yearlyBreakdownTitle}>Récapitulatif annuel</Text>
                              {years.map((yr) => {
                                const entry = yearMap.get(yr)!;
                                return (
                                  <View key={yr} style={styles.yearlyBreakdownRow}>
                                    <View style={styles.yearlyBreakdownYearRow}>
                                      <Text style={styles.yearlyBreakdownYear}>Année {yr}</Text>
                                      <Text style={styles.yearlyBreakdownTotal}>{entry.total.toFixed(2)} j</Text>
                                    </View>
                                    {entry.byStandard.length > 1 && (
                                      <Text style={styles.yearlyBreakdownDetail}>
                                        {entry.byStandard.map((b) => `${b.standard} : ${b.days.toFixed(2)} j`).join(" · ")}
                                      </Text>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}
                      </View>
                    );
                  })}

                  <View style={styles.finalTotalBox}>
                    <Text style={styles.finalTotalLabel}>Durée totale à auditer</Text>
                    <Text style={styles.finalTotalValue}>{finalTotal.toFixed(2)} jours</Text>
                  </View>

                  <Pressable
                    style={styles.reportButton}
                    onPress={() => navigation.navigate("CalculationReport", { clientId, clientName, dossierRef, sites, result, roundingOverrides })}
                  >
                    <Text style={styles.reportButtonText}>📄 Voir le rapport de calcul complet</Text>
                  </Pressable>
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
  topRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  savedIndicator: { fontSize: typography.caption, color: colors.contentQuaternary, marginLeft: "auto" },
  headerSaveBtn: {
    marginLeft: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  draftErrorBox: { backgroundColor: colors.errorSurface, borderRadius: radius.lg, padding: spacing.sm + 4, marginTop: spacing.sm },
  draftErrorText: { fontSize: typography.small, color: colors.error, fontWeight: "600", marginBottom: spacing.sm },
  retryButton: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  retryButtonText: { color: colors.error, fontWeight: "700", fontSize: typography.small },
  sectionTitle: { fontSize: typography.subtitle, fontWeight: "700", marginTop: spacing.md + 4, marginBottom: spacing.sm, color: colors.contentPrimary },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginTop: 6, marginBottom: 6, fontWeight: "600" },
  siteCard: { backgroundColor: colors.surfaceBase, borderRadius: radius.xxl, padding: spacing.md + 2, marginBottom: spacing.lg, borderWidth: 1.5, borderColor: colors.borderStrong },
  siteKindRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  siteKindLabel: { fontSize: typography.title, fontWeight: "800", color: colors.contentPrimary },
  removeSiteBtn: { marginLeft: "auto" },
  removeSiteText: { color: colors.error, fontSize: typography.small },
  standardRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  stdChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderDefault },
  stdChipActive: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  stdChipText: { fontSize: typography.body, color: colors.contentSecondary },
  stdChipTextActive: { color: colors.contentInverse, fontWeight: "600" },
  addSiteButton: { borderWidth: 1, borderColor: colors.borderStrong, borderStyle: "dashed", borderRadius: radius.lg, paddingVertical: spacing.sm + 4, alignItems: "center", marginBottom: spacing.lg },
  addSiteButtonText: { color: colors.contentPrimary, fontWeight: "600" },
  siteSelectorRow: { flexDirection: "row", gap: 8, marginBottom: spacing.sm, flexWrap: "wrap" },
  siteTab: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken },
  siteTabActive: { backgroundColor: colors.actionPrimary },
  siteTabText: { fontSize: typography.small, color: colors.contentSecondary, fontWeight: "600" },
  siteTabTextActive: { color: colors.contentInverse },
  standardSubTabs: { flexDirection: "row", gap: 6, marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, paddingBottom: 2 },
  subTab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  subTabActive: { backgroundColor: colors.surfaceSunken, borderBottomWidth: 2, borderBottomColor: colors.actionPrimary },
  subTabText: { fontSize: typography.body, color: colors.contentTertiary, fontWeight: "600" },
  subTabTextActive: { color: colors.contentPrimary },
  stepNavRow: { flexDirection: "row", gap: 10, marginTop: spacing.xl },
  nextButton: { flex: 1, backgroundColor: colors.actionPrimary, borderRadius: radius.lg, paddingVertical: spacing.md + 2, alignItems: "center" },
  nextButtonDisabled: { backgroundColor: colors.actionDisabled },
  nextButtonText: { color: colors.contentInverse, fontWeight: "700", fontSize: typography.subtitle, textAlign: "center" },
  backButton: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg - 2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderDefault },
  backButtonText: { color: colors.contentSecondary, fontWeight: "600", fontSize: typography.bodyLarge },
  stepHint: { fontSize: typography.small, color: colors.warning, marginTop: spacing.sm, textAlign: "center" },
  infoBox: { backgroundColor: colors.infoSurface, borderRadius: radius.lg, padding: spacing.sm + 4, marginTop: spacing.md },
  infoBoxText: { fontSize: typography.body, color: colors.info, fontWeight: "600" },
  recapBox: { backgroundColor: colors.successSurface, borderRadius: radius.lg, padding: spacing.sm + 4, marginBottom: spacing.md },
  recapBoxTitle: { fontWeight: "700", fontSize: typography.small, marginBottom: 4, color: colors.contentPrimary },
  recapLine: { fontSize: typography.small, color: colors.contentSecondary },
  recapSite: { marginBottom: spacing.lg },
  recapSiteTitle: { fontWeight: "700", fontSize: typography.bodyLarge, color: colors.contentPrimary, marginBottom: 2 },
  recapSectors: { fontSize: typography.caption, color: colors.contentQuaternary, marginBottom: spacing.sm },
  recapStd: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, padding: spacing.md + 2, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle },
  recapDetail: { fontSize: typography.small, color: colors.contentTertiary, marginBottom: 2 },
  yearGroup: { backgroundColor: colors.surfaceBase, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, borderLeftWidth: 3, borderLeftColor: colors.borderStrong, paddingHorizontal: spacing.sm + 2, paddingTop: spacing.sm, marginTop: spacing.sm },
  yearGroupTitle: { fontSize: typography.small, fontWeight: "800", color: colors.contentPrimary, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  yearlyBreakdownBox: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, padding: spacing.sm + 4, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle },
  yearlyBreakdownTitle: { fontWeight: "700", fontSize: typography.small, color: colors.contentPrimary, marginBottom: spacing.sm - 2 },
  yearlyBreakdownRow: { marginBottom: spacing.sm - 2 },
  yearlyBreakdownYearRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  yearlyBreakdownYear: { fontSize: typography.small, fontWeight: "700", color: colors.contentSecondary },
  yearlyBreakdownTotal: { fontSize: typography.small, fontWeight: "700", color: colors.contentPrimary },
  yearlyBreakdownDetail: { fontSize: typography.caption, color: colors.contentQuaternary, marginTop: 1 },
  finalTotalBox: { backgroundColor: colors.actionPrimary, borderRadius: radius.xl, padding: spacing.lg - 2, alignItems: "center", marginTop: spacing.sm },
  finalTotalLabel: { color: "#aaa", fontSize: typography.small, marginBottom: 4 },
  finalTotalValue: { color: colors.contentInverse, fontSize: typography.hero, fontWeight: "800" },
  reportButton: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  reportButtonText: { color: colors.contentPrimary, fontWeight: "700", fontSize: typography.bodyLarge },
});
