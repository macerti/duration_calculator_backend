import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import { APP_VERSION, UPDATED_AT_ISO } from "../generated/versionInfo";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// FEAT-003 required format: "Updated on 31 Aug 2026 at 09h48" — no seconds,
// one consistent app timezone. Previously this formatted the ISO string's
// own embedded offset, i.e. whatever the committing machine's local
// timezone happened to be — that drifts (and is invisible to the reader,
// since nothing on screen said which zone it was in). Fixed: always
// convert to a fixed UTC+1 offset, regardless of source/reader timezone.
// Fixed offset (not e.g. "Europe/Paris") is deliberate — the requirement
// is "UTC+1 always", not a DST-aware zone that would show UTC+2 in summer.
function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const utcPlus1 = new Date(date.getTime() + 60 * 60 * 1000);
  const day = utcPlus1.getUTCDate();
  const monthLabel = MONTHS[utcPlus1.getUTCMonth()];
  const year = utcPlus1.getUTCFullYear();
  const hour = String(utcPlus1.getUTCHours()).padStart(2, "0");
  const minute = String(utcPlus1.getUTCMinutes()).padStart(2, "0");
  return `${day} ${monthLabel} ${year} at ${hour}h${minute}`;
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
