import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";

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
          placeholderTextColor="#999"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 12 },
  label: { fontSize: 13, color: "#444", marginBottom: 4 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
});
