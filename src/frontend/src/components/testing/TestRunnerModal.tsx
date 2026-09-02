import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { colors, spacing, radius, typography } from "../../theme/tokens";
import { TEST_CATEGORIES, TEST_SCENARIOS, TestCategory } from "./testScenarios";
import { useTestRunnerState, TestStatus } from "./useTestRunnerState";

interface Props {
  visible: boolean;
  onClose: () => void;
  onNavigateToRoute?: (routeName: string) => void;
}

export default function TestRunnerModal({ visible, onClose, onNavigateToRoute }: Props) {
  const {
    results,
    activeScenario,
    activeIndex,
    summary,
    exportFeedback,
    setActiveScenarioId,
    recordResult,
    goToNext,
    goToPrevious,
    exportReport,
    resetAllResults,
  } = useTestRunnerState();

  const [selectedCategory, setSelectedCategory] = useState<TestCategory | "ALL">("ALL");
  const [currentNote, setCurrentNote] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Sync current note with active scenario
  React.useEffect(() => {
    setCurrentNote(results[activeScenario.id]?.notes || "");
  }, [activeScenario.id, results]);

  const filteredScenarios = React.useMemo(() => {
    if (selectedCategory === "ALL") return TEST_SCENARIOS;
    return TEST_SCENARIOS.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  const handleStatusClick = (status: TestStatus) => {
    recordResult(activeScenario.id, status, currentNote);
    goToNext();
  };

  const handleSaveNote = () => {
    const existing = results[activeScenario.id]?.status || "PASS";
    recordResult(activeScenario.id, existing, currentNote);
  };

  if (!visible) return null;

  // Floating Minimized Mode
  if (isMinimized) {
    return (
      <View style={styles.minimizedContainer}>
        <Pressable
          style={styles.minimizedPill}
          onPress={() => setIsMinimized(false)}
        >
          <Text style={styles.minimizedPillIcon}>🧪</Text>
          <View>
            <Text style={styles.minimizedPillText}>
              Guide Test : {activeScenario.id}
            </Text>
            <Text style={styles.minimizedPillSub}>
              {summary.passed}/{summary.total} validés ({summary.progressPercent}%) · Agrandir
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  const currentResult = results[activeScenario.id];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.badgeGroup}>
                <Text style={styles.titleIcon}>🧪</Text>
                <Text style={styles.titleText}>Guide de Test & Acceptance</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.headerButton}
                  onPress={() => setIsMinimized(true)}
                >
                  <Text style={styles.headerButtonText}>_ Réduire</Text>
                </Pressable>
                <Pressable style={styles.headerButtonClose} onPress={onClose}>
                  <Text style={styles.headerButtonCloseText}>✕</Text>
                </Pressable>
              </View>
            </View>

            {/* Metrics progress bar */}
            <View style={styles.progressRow}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.max(summary.progressPercent, 4)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPercentText}>
                {summary.progressPercent}%
              </Text>
            </View>

            {/* Stats chips */}
            <View style={styles.statsRow}>
              <View style={[styles.statChip, { backgroundColor: colors.successSurface }]}>
                <Text style={[styles.statChipText, { color: colors.success }]}>
                  ✅ {summary.passed} Conformes
                </Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: colors.errorSurface }]}>
                <Text style={[styles.statChipText, { color: colors.error }]}>
                  ❌ {summary.failed} Échecs
                </Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: colors.warningSurface }]}>
                <Text style={[styles.statChipText, { color: colors.warning }]}>
                  ⏭️ {summary.skipped} Ignorés
                </Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: colors.surfaceSunken }]}>
                <Text style={[styles.statChipText, { color: colors.contentSecondary }]}>
                  ⏳ {summary.pending} En attente
                </Text>
              </View>
            </View>
          </View>

          {/* Feedback banner */}
          {exportFeedback && (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackBannerText}>{exportFeedback}</Text>
            </View>
          )}

          {/* Category Filter Chips */}
          <View style={styles.categoryScrollContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Pressable
                style={[
                  styles.categoryChip,
                  selectedCategory === "ALL" && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory("ALL")}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === "ALL" && styles.categoryChipTextActive,
                  ]}
                >
                  Tous ({TEST_SCENARIOS.length})
                </Text>
              </Pressable>
              {TEST_CATEGORIES.map((cat) => {
                const count = TEST_SCENARIOS.filter((s) => s.category === cat.id).length;
                const isSelected = selectedCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.icon} {cat.label} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Body Content: Active Scenario */}
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {/* Scenario Header */}
            <View style={styles.scenarioCard}>
              <View style={styles.scenarioIdRow}>
                <View style={styles.scenarioBadge}>
                  <Text style={styles.scenarioBadgeText}>{activeScenario.id}</Text>
                </View>
                <Text style={styles.scenarioCategoryText}>
                  {activeScenario.categoryLabel}
                </Text>
                {currentResult && (
                  <View
                    style={[
                      styles.statusBadge,
                      currentResult.status === "PASS"
                        ? styles.statusBadgePass
                        : currentResult.status === "FAIL"
                        ? styles.statusBadgeFail
                        : styles.statusBadgeSkip,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {currentResult.status === "PASS"
                        ? "✅ CONFORME"
                        : currentResult.status === "FAIL"
                        ? "❌ ÉCHEC"
                        : "⏭️ IGNORÉ"}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.scenarioTitle}>{activeScenario.title}</Text>

              {/* Instructions List */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeader}>📋 Instructions à exécuter :</Text>
                {activeScenario.instructions.map((inst, idx) => (
                  <View key={idx} style={styles.instructionStep}>
                    <Text style={styles.stepNumber}>{idx + 1}.</Text>
                    <Text style={styles.stepText}>{inst}</Text>
                  </View>
                ))}
              </View>

              {/* Expected Result */}
              <View style={styles.expectedBlock}>
                <Text style={styles.expectedHeader}>🎯 Résultat attendu :</Text>
                <Text style={styles.expectedText}>{activeScenario.expected}</Text>
              </View>

              {/* Verification Question & Decision Buttons */}
              <View style={styles.decisionBlock}>
                <Text style={styles.decisionQuestion}>
                  {activeScenario.verificationQuestion}
                </Text>

                <View style={styles.actionButtonsRow}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.passButton,
                      currentResult?.status === "PASS" && styles.buttonSelected,
                    ]}
                    onPress={() => handleStatusClick("PASS")}
                  >
                    <Text style={styles.passButtonText}>✅ Conforme (PASS)</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.failButton,
                      currentResult?.status === "FAIL" && styles.buttonSelected,
                    ]}
                    onPress={() => handleStatusClick("FAIL")}
                  >
                    <Text style={styles.failButtonText}>❌ Non conforme (FAIL)</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.skipButton,
                      currentResult?.status === "SKIPPED" && styles.buttonSelected,
                    ]}
                    onPress={() => handleStatusClick("SKIPPED")}
                  >
                    <Text style={styles.skipButtonText}>⏭️ Ignorer</Text>
                  </Pressable>
                </View>
              </View>

              {/* Notes / Observation */}
              <View style={styles.notesBlock}>
                <Text style={styles.notesLabel}>Remarques ou observations :</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Ex: Fonctionne bien, animation fluide, bug constaté..."
                  value={currentNote}
                  onChangeText={setCurrentNote}
                  onBlur={handleSaveNote}
                  multiline
                />
              </View>

              {/* Quick Navigation Action if defined */}
              {activeScenario.suggestedRoute && onNavigateToRoute && (
                <Pressable
                  style={styles.routeShortcutButton}
                  onPress={() => {
                    setIsMinimized(true);
                    onNavigateToRoute(activeScenario.suggestedRoute!);
                  }}
                >
                  <Text style={styles.routeShortcutText}>
                    🚀 Aller sur l'écran '{activeScenario.suggestedRoute}' & réduire le guide
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Scenarios Quick Grid */}
            <View style={styles.gridCard}>
              <Text style={styles.gridTitle}>Tous les scénarios filtrés :</Text>
              <View style={styles.gridList}>
                {filteredScenarios.map((sc) => {
                  const res = results[sc.id];
                  const isCurrent = sc.id === activeScenario.id;
                  return (
                    <Pressable
                      key={sc.id}
                      style={[
                        styles.gridChip,
                        isCurrent && styles.gridChipCurrent,
                        res?.status === "PASS" && styles.gridChipPass,
                        res?.status === "FAIL" && styles.gridChipFail,
                        res?.status === "SKIPPED" && styles.gridChipSkip,
                      ]}
                      onPress={() => setActiveScenarioId(sc.id)}
                    >
                      <Text
                        style={[
                          styles.gridChipText,
                          isCurrent && styles.gridChipTextCurrent,
                        ]}
                      >
                        {sc.id}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Controls & Export */}
          <View style={styles.footer}>
            <View style={styles.navigationRow}>
              <Pressable style={styles.navButton} onPress={goToPrevious}>
                <Text style={styles.navButtonText}>← Précédent</Text>
              </Pressable>
              <Text style={styles.navCounterText}>
                {activeIndex + 1} / {TEST_SCENARIOS.length}
              </Text>
              <Pressable style={styles.navButton} onPress={goToNext}>
                <Text style={styles.navButtonText}>Suivant →</Text>
              </Pressable>
            </View>

            <View style={styles.exportRow}>
              <Pressable
                style={styles.exportButton}
                onPress={() => exportReport("markdown")}
              >
                <Text style={styles.exportButtonText}>📥 Exporter Rapport .MD</Text>
              </Pressable>
              <Pressable
                style={[styles.exportButton, styles.exportButtonSecondary]}
                onPress={() => exportReport("json")}
              >
                <Text style={styles.exportButtonTextSecondary}>
                  📥 Exporter Données .JSON
                </Text>
              </Pressable>
              <Pressable
                style={styles.resetButton}
                onPress={resetAllResults}
              >
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.surfaceOverlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surfaceBase,
    width: "100%",
    maxWidth: 780,
    maxHeight: "92%",
    borderRadius: radius.xxl,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  titleText: {
    fontSize: typography.heading,
    fontWeight: "700",
    color: colors.contentPrimary,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    marginRight: spacing.sm,
  },
  headerButtonText: {
    fontSize: typography.small,
    fontWeight: "600",
    color: colors.contentSecondary,
  },
  headerButtonClose: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerButtonCloseText: {
    fontSize: 18,
    color: colors.contentTertiary,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: colors.borderSubtle,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginRight: spacing.sm,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.success,
    borderRadius: radius.pill,
  },
  progressPercentText: {
    fontSize: typography.small,
    fontWeight: "700",
    color: colors.contentPrimary,
    minWidth: 38,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  statChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statChipText: {
    fontSize: typography.caption,
    fontWeight: "600",
  },
  feedbackBanner: {
    backgroundColor: colors.infoSurface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.info,
  },
  feedbackBannerText: {
    fontSize: typography.small,
    fontWeight: "600",
    color: colors.info,
  },
  categoryScrollContainer: {
    backgroundColor: colors.surfaceSunken,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceBase,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  categoryChipActive: {
    backgroundColor: colors.contentPrimary,
    borderColor: colors.contentPrimary,
  },
  categoryChipText: {
    fontSize: typography.caption,
    color: colors.contentSecondary,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: colors.contentInverse,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
  },
  scenarioCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginBottom: spacing.lg,
  },
  scenarioIdRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  scenarioBadge: {
    backgroundColor: colors.contentPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  scenarioBadgeText: {
    color: colors.contentInverse,
    fontWeight: "700",
    fontSize: typography.caption,
  },
  scenarioCategoryText: {
    fontSize: typography.caption,
    color: colors.contentTertiary,
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgePass: {
    backgroundColor: colors.successSurface,
  },
  statusBadgeFail: {
    backgroundColor: colors.errorSurface,
  },
  statusBadgeSkip: {
    backgroundColor: colors.warningSurface,
  },
  statusBadgeText: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.contentPrimary,
  },
  scenarioTitle: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.contentPrimary,
    marginBottom: spacing.md,
  },
  sectionBlock: {
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceBase,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionHeader: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.contentPrimary,
    marginBottom: spacing.xs,
  },
  instructionStep: {
    flexDirection: "row",
    marginTop: spacing.xs,
  },
  stepNumber: {
    fontWeight: "700",
    color: colors.link,
    marginRight: spacing.xs,
    fontSize: typography.body,
  },
  stepText: {
    fontSize: typography.body,
    color: colors.contentSecondary,
    flex: 1,
    lineHeight: 18,
  },
  expectedBlock: {
    backgroundColor: colors.infoSurface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  expectedHeader: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.info,
    marginBottom: 2,
  },
  expectedText: {
    fontSize: typography.body,
    color: colors.contentSecondary,
    lineHeight: 18,
  },
  decisionBlock: {
    backgroundColor: colors.surfaceBase,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginBottom: spacing.md,
  },
  decisionQuestion: {
    fontSize: typography.bodyLarge,
    fontWeight: "700",
    color: colors.contentPrimary,
    marginBottom: spacing.md,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  actionButton: {
    flex: 1,
    minWidth: 140,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  passButton: {
    backgroundColor: colors.successSurface,
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  passButtonText: {
    color: colors.success,
    fontWeight: "700",
    fontSize: typography.body,
  },
  failButton: {
    backgroundColor: colors.errorSurface,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  failButtonText: {
    color: colors.error,
    fontWeight: "700",
    fontSize: typography.body,
  },
  skipButton: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
  },
  skipButtonText: {
    color: colors.contentSecondary,
    fontWeight: "600",
    fontSize: typography.body,
  },
  buttonSelected: {
    backgroundColor: colors.contentPrimary,
    borderColor: colors.contentPrimary,
  },
  notesBlock: {
    marginBottom: spacing.md,
  },
  notesLabel: {
    fontSize: typography.small,
    fontWeight: "600",
    color: colors.contentSecondary,
    marginBottom: spacing.xs,
  },
  notesInput: {
    backgroundColor: colors.surfaceBase,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: typography.body,
    color: colors.contentPrimary,
    minHeight: 50,
  },
  routeShortcutButton: {
    backgroundColor: colors.surfaceSunken,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.link,
  },
  routeShortcutText: {
    fontSize: typography.small,
    fontWeight: "700",
    color: colors.link,
  },
  gridCard: {
    backgroundColor: colors.surfaceSunken,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  gridTitle: {
    fontSize: typography.small,
    fontWeight: "700",
    color: colors.contentSecondary,
    marginBottom: spacing.sm,
  },
  gridList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  gridChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceBase,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  gridChipCurrent: {
    borderColor: colors.contentPrimary,
    backgroundColor: colors.surfaceRaised,
    transform: [{ scale: 1.05 }],
  },
  gridChipPass: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  gridChipFail: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.error,
  },
  gridChipSkip: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
  },
  gridChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.contentSecondary,
  },
  gridChipTextCurrent: {
    color: colors.contentPrimary,
    fontWeight: "800",
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  navigationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  navButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  navButtonText: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.contentPrimary,
  },
  navCounterText: {
    fontSize: typography.small,
    fontWeight: "600",
    color: colors.contentTertiary,
  },
  exportRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  exportButton: {
    flex: 1,
    backgroundColor: colors.actionPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  exportButtonText: {
    color: colors.contentInverse,
    fontWeight: "700",
    fontSize: typography.small,
  },
  exportButtonSecondary: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  exportButtonTextSecondary: {
    color: colors.contentPrimary,
    fontWeight: "700",
    fontSize: typography.small,
  },
  resetButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    color: colors.contentTertiary,
    fontSize: typography.caption,
  },
  // Minimized Floating Bar
  minimizedContainer: {
    position: "absolute",
    bottom: 45,
    right: 20,
    zIndex: 9999,
  },
  minimizedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.contentPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  minimizedPillIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  minimizedPillText: {
    color: colors.contentInverse,
    fontWeight: "700",
    fontSize: typography.small,
  },
  minimizedPillSub: {
    color: colors.contentQuaternary,
    fontSize: typography.caption,
  },
});
