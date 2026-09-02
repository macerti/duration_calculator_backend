import { useState, useEffect, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { TEST_SCENARIOS, TestScenario } from "./testScenarios";

export type TestStatus = "PASS" | "FAIL" | "SKIPPED";

export interface TestResultEntry {
  status: TestStatus;
  notes?: string;
  verifiedAt: string;
}

export type ResultsMap = Record<string, TestResultEntry>;

const STORAGE_KEY = "duration_calc_guided_tests_v1";

export function useTestRunnerState() {
  const [results, setResults] = useState<ResultsMap>({});
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    TEST_SCENARIOS[0]?.id || "HOME-01"
  );
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Hydrate from localStorage on web mount
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === "object") {
            setResults(parsed);
          }
        }
      } catch (e) {
        console.warn("[TestRunner] Unable to load saved test results from storage", e);
      }
    }
  }, []);

  // Save to localStorage
  const saveResults = useCallback((newResults: ResultsMap) => {
    setResults(newResults);
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newResults));
      } catch (e) {
        console.warn("[TestRunner] Unable to persist test results to storage", e);
      }
    }
  }, []);

  const recordResult = useCallback(
    (scenarioId: string, status: TestStatus, notes?: string) => {
      saveResults({
        ...results,
        [scenarioId]: {
          status,
          notes: notes || results[scenarioId]?.notes || "",
          verifiedAt: new Date().toISOString(),
        },
      });
    },
    [results, saveResults]
  );

  const resetAllResults = useCallback(() => {
    saveResults({});
  }, [saveResults]);

  // Summary counts
  const summary = useMemo(() => {
    const total = TEST_SCENARIOS.length;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const scenario of TEST_SCENARIOS) {
      const res = results[scenario.id];
      if (res) {
        if (res.status === "PASS") passed++;
        else if (res.status === "FAIL") failed++;
        else if (res.status === "SKIPPED") skipped++;
      }
    }

    const pending = total - (passed + failed + skipped);
    const progressPercent = total > 0 ? Math.round(((passed + failed + skipped) / total) * 100) : 0;

    return { total, passed, failed, skipped, pending, progressPercent };
  }, [results]);

  const activeScenario = useMemo(() => {
    return TEST_SCENARIOS.find((s) => s.id === activeScenarioId) || TEST_SCENARIOS[0];
  }, [activeScenarioId]);

  const activeIndex = useMemo(() => {
    return TEST_SCENARIOS.findIndex((s) => s.id === activeScenarioId);
  }, [activeScenarioId]);

  const goToNext = useCallback(() => {
    const nextIdx = (activeIndex + 1) % TEST_SCENARIOS.length;
    setActiveScenarioId(TEST_SCENARIOS[nextIdx].id);
  }, [activeIndex]);

  const goToPrevious = useCallback(() => {
    const prevIdx = (activeIndex - 1 + TEST_SCENARIOS.length) % TEST_SCENARIOS.length;
    setActiveScenarioId(TEST_SCENARIOS[prevIdx].id);
  }, [activeIndex]);

  // Export functions
  const generateMarkdownReport = useCallback((): string => {
    const dateStr = new Date().toISOString().slice(0, 19).replace("T", " ");
    const lines: string[] = [];

    lines.push("# Rapport d'Exécution des Tests d'Acceptance Utilisateur");
    lines.push("");
    lines.push(`- **Date d'exécution**: ${dateStr} (UTC)`);
    lines.push(`- **Progression globale**: ${summary.passed + summary.failed + summary.skipped}/${summary.total} (${summary.progressPercent}%)`);
    lines.push(`- **Résultats**: ✅ ${summary.passed} Conformes | ❌ ${summary.failed} Échecs | ⏭️ ${summary.skipped} Ignorés | ⏳ ${summary.pending} En attente`);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Résumé par Scénario");
    lines.push("");
    lines.push("| ID | Scénario | Statut | Observations / Notes | Date de validation |");
    lines.push("|---|---|---|---|---|");

    for (const sc of TEST_SCENARIOS) {
      const res = results[sc.id];
      const statusIcon =
        res?.status === "PASS"
          ? "✅ PASS"
          : res?.status === "FAIL"
          ? "❌ FAIL"
          : res?.status === "SKIPPED"
          ? "⏭️ SKIP"
          : "⏳ PENDING";
      const notes = (res?.notes || "—").replace(/\|/g, "\\|");
      const time = res?.verifiedAt ? res.verifiedAt.slice(11, 19) : "—";
      lines.push(`| **${sc.id}** | ${sc.title} | ${statusIcon} | ${notes} | ${time} |`);
    }

    lines.push("");
    lines.push("---");
    lines.push("*Généré automatiquement par le Runner de Tests Intégré de l'Audit Duration Calculator.*");

    return lines.join("\n");
  }, [results, summary]);

  const generateJsonReport = useCallback((): string => {
    const payload = {
      reportType: "USER_ACCEPTANCE_TEST_REPORT",
      schemaVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      summary,
      results: TEST_SCENARIOS.map((sc) => ({
        id: sc.id,
        category: sc.category,
        title: sc.title,
        expected: sc.expected,
        status: results[sc.id]?.status || "PENDING",
        notes: results[sc.id]?.notes || "",
        verifiedAt: results[sc.id]?.verifiedAt || null,
      })),
    };
    return JSON.stringify(payload, null, 2);
  }, [results, summary]);

  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, []);

  const exportReport = useCallback(
    (format: "markdown" | "json") => {
      const datePart = new Date().toISOString().slice(0, 10);
      if (format === "markdown") {
        const md = generateMarkdownReport();
        downloadFile(md, `RAPPORT_TEST_ACCEPTANCE_${datePart}.md`, "text/markdown;charset=utf-8");
        setExportFeedback("Rapport Markdown téléchargé avec succès !");
      } else {
        const json = generateJsonReport();
        downloadFile(json, `acceptance_tests_report_${datePart}.json`, "application/json;charset=utf-8");
        setExportFeedback("Rapport JSON téléchargé avec succès !");
      }
      setTimeout(() => setExportFeedback(null), 4000);
    },
    [downloadFile, generateJsonReport, generateMarkdownReport]
  );

  return {
    results,
    activeScenario,
    activeScenarioId,
    activeIndex,
    summary,
    exportFeedback,
    setActiveScenarioId,
    recordResult,
    resetAllResults,
    goToNext,
    goToPrevious,
    generateMarkdownReport,
    generateJsonReport,
    exportReport,
  };
}
