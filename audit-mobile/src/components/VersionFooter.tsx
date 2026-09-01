import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import { APP_VERSION, UPDATED_AT_ISO } from "../generated/versionInfo";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// FEAT-003 required format: "Updated on 31 Aug 2026 at 09h48" — no seconds,
// one consistent app timezone. UPDATED_AT_ISO already carries the source
// commit's own timezone offset (git preserves the committer's local zone),
// so formatting the ISO string's own components — rather than converting
// to the *reader's* local timezone — keeps that "one consistent timezone"
// instead of silently varying by who's viewing it.
function formatUpdatedAt(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return iso;
  const [, year, month, day, hour, minute] = match;
  const monthLabel = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthLabel} ${year} at ${hour}h${minute}`;
}

export default function VersionFooter() {
  const updatedLabel = UPDATED_AT_ISO ? formatUpdatedAt(UPDATED_AT_ISO) : null;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Version {APP_VERSION}
        {updatedLabel ? ` · Updated on ${updatedLabel}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.surfaceBase,
  },
  text: {
    fontSize: typography.caption,
    color: colors.contentQuaternary,
  },
});
