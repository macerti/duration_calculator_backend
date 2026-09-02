import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import StatusPill from "../components/StatusPill";
import ResponsiveContainer from "../components/ResponsiveContainer";
import { useTestRunner } from "../components/testing/TestRunnerContext";
import { colors, spacing, radius, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { openTestRunner, summary } = useTestRunner();

  return (
    <ResponsiveContainer maxWidth={600}>
      <View style={styles.container}>
        <StatusPill />

        <Text style={styles.title}>Audit Duration Calculator</Text>
        <Text style={styles.subtitle}>GS0106 / IAF MD5 / MD1 / MD11</Text>

        <Pressable style={styles.ctaButton} onPress={() => navigation.navigate("ClientsList")}>
          <Text style={styles.ctaButtonText}>Mes clients</Text>
          <Text style={styles.ctaButtonSubtext}>Créer ou reprendre un calcul de durée d'audit</Text>
        </Pressable>

        {/* Guided Test Mode Card */}
        <View style={styles.testSection}>
          <Pressable style={styles.testCard} onPress={openTestRunner}>
            <View style={styles.testCardHeader}>
              <View style={styles.testIconBadge}>
                <Text style={styles.testIcon}>🧪</Text>
              </View>
              <View style={styles.testTitleGroup}>
                <Text style={styles.testTitle}>Mode Test & Acceptance</Text>
                <Text style={styles.testSubtitle}>
                  Guide interactif pas-à-pas & export des résultats
                </Text>
              </View>
            </View>

            <View style={styles.testStatsRow}>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.max(summary.progressPercent, 5)}%` },
                  ]}
                />
              </View>
              <Text style={styles.testStatsText}>
                {summary.passed + summary.failed + summary.skipped}/{summary.total} ({summary.progressPercent}%)
              </Text>
            </View>

            <View style={styles.testActionRow}>
              <Text style={styles.testActionLabel}>
                Lancer les scénarios de test →
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  title: { fontSize: 24, fontWeight: "700", marginTop: 16 },
  subtitle: { fontSize: 13, color: colors.contentTertiary, marginBottom: 32 },
  ctaButton: { backgroundColor: colors.actionPrimary, borderRadius: radius.xxl, padding: 22 },
  ctaButtonText: { color: colors.contentInverse, fontSize: 17, fontWeight: "700" },
  ctaButtonSubtext: { color: colors.contentDisabled, fontSize: 12, marginTop: 6 },

  testSection: {
    marginTop: spacing.xl,
  },
  testCard: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  testCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  testIconBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  testIcon: {
    fontSize: 22,
  },
  testTitleGroup: {
    flex: 1,
  },
  testTitle: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.contentPrimary,
  },
  testSubtitle: {
    fontSize: typography.small,
    color: colors.contentSecondary,
    marginTop: 2,
  },
  testStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
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
  testStatsText: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.contentSecondary,
  },
  testActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  testActionLabel: {
    fontSize: typography.small,
    fontWeight: "700",
    color: colors.link,
  },
});

