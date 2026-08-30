import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { api } from "../api/client";
import { NaceRiskEntry } from "../types/engine";

interface Props {
  value: string; // selected NACE code
  onChange: (code: string, entry?: NaceRiskEntry) => void;
}

const DEBOUNCE_MS = 300;

export default function NaceSearchField({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NaceRiskEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If a code is already set (e.g. loaded from a saved case), resolve its label once.
  useEffect(() => {
    if (value && !selectedLabel) {
      api
        .getNaceEntry(value)
        .then((entry) => setSelectedLabel(`${entry.codeNace} — ${entry.description}`))
        .catch(() => {
          /* code not found or API unreachable — leave unresolved, field still shows the raw code */
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api
        .searchNace(query.trim())
        .then((r) => setResults(r.slice(0, 15)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const select = (entry: NaceRiskEntry) => {
    onChange(entry.codeNace, entry);
    setSelectedLabel(`${entry.codeNace} — ${entry.description}`);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setSelectedLabel(null);
    setQuery("");
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Secteur (code NACE)</Text>

      {selectedLabel ? (
        <View style={styles.selectedRow}>
          <Text style={styles.selectedText} numberOfLines={2}>
            {selectedLabel}
          </Text>
          <Pressable onPress={clear}>
            <Text style={styles.changeText}>Changer</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setOpen(true);
            }}
            placeholder="Rechercher un secteur d'activité..."
            placeholderTextColor="#999"
            onFocus={() => setOpen(true)}
          />
          {loading && <ActivityIndicator style={{ marginTop: 6 }} />}
          {open && results.length > 0 && (
            <View style={styles.dropdown}>
              <FlatList
                data={results}
                keyExtractor={(item) => item.codeNace}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable style={styles.resultRow} onPress={() => select(item)}>
                    <Text style={styles.resultCode}>{item.codeNace}</Text>
                    <Text style={styles.resultDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )}
          {open && !loading && query.trim().length >= 2 && results.length === 0 && (
            <Text style={styles.noResults}>Aucun secteur trouvé pour "{query}"</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, color: "#444", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 },
  dropdown: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginTop: 4, maxHeight: 220, backgroundColor: "#fff" },
  resultRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  resultCode: { fontSize: 11, color: "#888", fontWeight: "700" },
  resultDesc: { fontSize: 13, color: "#333", marginTop: 2 },
  noResults: { fontSize: 12, color: "#999", marginTop: 6, fontStyle: "italic" },
  selectedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: "#f5f5f7" },
  selectedText: { fontSize: 13, color: "#333", flex: 1, marginRight: 8 },
  changeText: { color: "#0066cc", fontSize: 12, fontWeight: "600" },
});
