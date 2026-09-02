import React, { createContext, useContext, useState } from "react";
import TestRunnerModal from "./TestRunnerModal";
import { useTestRunnerState } from "./useTestRunnerState";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { colors, spacing, radius, typography } from "../../theme/tokens";

interface TestRunnerContextValue {
  isModalOpen: boolean;
  openTestRunner: () => void;
  closeTestRunner: () => void;
  summary: ReturnType<typeof useTestRunnerState>["summary"];
}

const TestRunnerContext = createContext<TestRunnerContextValue | undefined>(undefined);

export function TestRunnerProvider({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { summary } = useTestRunnerState();

  const openTestRunner = () => setIsModalOpen(true);
  const closeTestRunner = () => setIsModalOpen(false);

  return (
    <TestRunnerContext.Provider
      value={{
        isModalOpen,
        openTestRunner,
        closeTestRunner,
        summary,
      }}
    >
      {children}
      {/* Global floating test trigger pill - unobtrusive and always accessible */}
      {!isModalOpen && (
        <View style={styles.floatingTriggerContainer} pointerEvents="box-none">
          <Pressable style={styles.floatingButton} onPress={openTestRunner}>
            <Text style={styles.floatingIcon}>🧪</Text>
            <Text style={styles.floatingText}>
              Tests {summary.passed}/{summary.total}
            </Text>
          </Pressable>
        </View>
      )}

      {/* The guided test modal */}
      <TestRunnerModal
        visible={isModalOpen}
        onClose={closeTestRunner}
      />
    </TestRunnerContext.Provider>
  );
}

export function useTestRunner() {
  const context = useContext(TestRunnerContext);
  if (!context) {
    throw new Error("useTestRunner must be used within a TestRunnerProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  floatingTriggerContainer: {
    position: "absolute",
    bottom: 35,
    right: 18,
    zIndex: 9999,
  },
  floatingButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.contentPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  floatingIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  floatingText: {
    color: colors.contentInverse,
    fontSize: typography.caption,
    fontWeight: "700",
  },
});
