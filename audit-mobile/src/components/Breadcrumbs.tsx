import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";

export interface Crumb {
  label: string;
  onPress?: () => void; // omit for the current/last crumb
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <View style={styles.row}>
      {items.map((item, i) => (
        <View key={i} style={styles.item}>
          {item.onPress ? (
            <Pressable onPress={item.onPress}>
              <Text style={styles.link}>{item.label}</Text>
            </Pressable>
          ) : (
            <Text style={styles.current}>{item.label}</Text>
          )}
          {i < items.length - 1 && <Text style={styles.sep}>›</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", paddingVertical: spacing.sm },
  item: { flexDirection: "row", alignItems: "center" },
  link: { color: colors.link, fontSize: typography.body },
  current: { color: colors.contentTertiary, fontSize: typography.body, fontWeight: "600" },
  sep: { color: colors.borderDefault, fontSize: typography.body, marginHorizontal: 6 },
});
