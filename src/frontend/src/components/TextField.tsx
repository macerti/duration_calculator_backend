import React from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Masks input — for passwords. Defaults to false (unchanged prior behavior). */
  secureTextEntry?: boolean;
  /** Defaults to "sentences", matching every pre-existing caller. Auth
   * screens pass "none" for email fields so "Info@Macerti.com" isn't
   * auto-capitalized into something that fails a case-sensitive compare
   * before this component even existed to prevent it. */
  autoCapitalize?: TextInputProps["autoCapitalize"];
  /** Defaults to "default", matching every pre-existing caller. */
  keyboardType?: TextInputProps["keyboardType"];
  /** Browser/OS autofill hint (e.g. "email", "password", "new-password",
   * "name") — optional, no effect on native behavior when omitted. */
  autoComplete?: TextInputProps["autoComplete"];
  /** Inline validation/server error shown under the field in errorSurface
   * red, same visual language as LoginScreen's banner. Optional — omitting
   * it renders exactly as before. */
  error?: string | null;
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
 *
 * Extended for the local-accounts/RBAC frontend (2026-09-05) with optional
 * secureTextEntry/autoCapitalize/keyboardType/autoComplete/error props so
 * Register/Login/Profile/ResetPassword reuse this component instead of a
 * parallel one-off input — every new prop defaults to this file's prior
 * hard-coded behavior, so no existing caller's rendering changes.
 */
export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  autoComplete,
  error,
}: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "sentences"}
          secureTextEntry={secureTextEntry ?? false}
          autoComplete={autoComplete}
          placeholder={placeholder}
          placeholderTextColor={colors.contentQuaternary}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.md },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.xs },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2 },
  inputWrapError: { borderColor: colors.error },
  input: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: typography.subtitle },
  errorText: { color: colors.error, fontSize: typography.small, marginTop: spacing.xs },
});
