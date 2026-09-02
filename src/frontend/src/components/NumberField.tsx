import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";

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
          placeholderTextColor="#999"
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 12 },
  label: { fontSize: 13, color: "#444", marginBottom: 4 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
  suffix: { color: "#999", fontSize: 13 },
});
