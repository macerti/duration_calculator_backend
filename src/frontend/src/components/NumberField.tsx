import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}

export default function NumberField({ label, value, onChangeText, placeholder, suffix }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={colors.contentQuaternary}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.md },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: spacing.xs },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2 },
  input: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: typography.subtitle },
  suffix: { color: colors.contentQuaternary, fontSize: typography.body },
});
