import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { spacing } from "../theme/tokens";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  maxWidth?: number;
}

/** Centers and caps content width on tablet/desktop so text and cards don't
 * stretch edge-to-edge on a wide screen; full-width on mobile. */
export default function ResponsiveContainer({ children, style, maxWidth = 900 }: Props) {
  const bp = useBreakpoint();
  return (
    <View style={[styles.outer, bp !== "mobile" && { alignItems: "center" }]}>
      <View style={[styles.inner, bp !== "mobile" && { maxWidth, width: "100%" }, style]}>{children}</View>
    </View>
  );
}

/** Row that wraps to columns on desktop/tablet, stacks on mobile. */
export function ResponsiveGrid({ children, minColWidth = 320 }: { children: React.ReactNode; minColWidth?: number }) {
  const bp = useBreakpoint();
  if (bp === "mobile") return <View>{children}</View>;
  return <View style={[styles.grid, { gap: spacing.lg }]}>{React.Children.map(children, (c) => <View style={{ flexBasis: minColWidth, flexGrow: 1 }}>{c}</View>)}</View>;
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  inner: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
});
