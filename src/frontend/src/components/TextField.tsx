import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}

/**
 * Plain-text input for genuinely textual business-information fields
 * (names, addresses, references) — as opposed to `NumberField`, which
 * forces `keyboardType="numeric"` and is meant for calculation inputs.
 *
 * BUG-026: the Siège name/address fields were previously built with
 * `NumberField`, which put mobile devices into a numeric-only keyboard and
 * prevented normal text entry (letters, spaces, punctuation, accents) for
 * fields that must accept ordinary company names and postal addresses.
 */
export default function TextField({ label, value, onChangeText, placeholder }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="default"
          autoCapitalize="sentences"
          placeholder={placeholder}
          placeholderTextColor={colors.contentQuaternary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.md },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.xs },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2 },
  input: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: typography.subtitle },
});
