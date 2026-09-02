import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, FlatList, Modal } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api } from "../api/client";
import { NaceRiskEntry, StandardCode } from "../types/engine";
import { resolveMostCriticalRisk } from "../utils/riskResolution";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface Props {
  selectedEntries: NaceRiskEntry[];
  onChange: (entries: NaceRiskEntry[]) => void;
  activeStandards: StandardCode[];
}

const DEBOUNCE_MS = 300;

/**
 * Search-as-you-type sector picker, plus a "browse full list" modal with
 * checkboxes as an alternative to typing. No hard cap on how many sectors
 * can be declared for a site — when more than one is selected, the more
 * critical risk (per standard) is resolved automatically from however many
 * are picked.
 */
export default function DualSectorPicker({ selectedEntries, onChange, activeStandards }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NaceRiskEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [browseOpen, setBrowseOpen] = useState(false);
  const [allEntries, setAllEntries] = useState<NaceRiskEntry[] | null>(null);
  const [browseFilter, setBrowseFilter] = useState("");

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
        .then((r) => setResults(r.filter((e) => !selectedEntries.some((s) => s.codeNace === e.codeNace)).slice(0, 12)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedEntries]);

  const select = (entry: NaceRiskEntry) => {
    onChange([...selectedEntries, entry]);
    setQuery("");
    setResults([]);
  };

  const remove = (code: string) => {
    onChange(selectedEntries.filter((e) => e.codeNace !== code));
  };

  const openBrowse = () => {
    setBrowseOpen(true);
    if (!allEntries) {
      api
        .getParameters()
        .then((p) => setAllEntries(p.naceTable))
        .catch(() => setAllEntries([]));
    }
  };

  const toggleInBrowse = (entry: NaceRiskEntry) => {
    const isSelected = selectedEntries.some((s) => s.codeNace === entry.codeNace);
    onChange(isSelected ? selectedEntries.filter((s) => s.codeNace !== entry.codeNace) : [...selectedEntries, entry]);
  };

  const filteredAll = allEntries?.filter((e) => e.description.toLowerCase().includes(browseFilter.toLowerCase())) ?? [];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Secteur(s) d'activité</Text>
      <Text style={styles.hint}>
        Si plusieurs secteurs sont déclarés, le risque le plus critique est retenu automatiquement pour chaque norme.
      </Text>

      {selectedEntries.map((entry) => (
        <View key={entry.codeNace} style={styles.chip}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chipCode}>
              NACE {entry.codeNace} · EAC {entry.codeEac}
            </Text>
            <Text style={styles.chipDesc} numberOfLines={2}>
              {entry.description}
            </Text>
          </View>
          <Pressable onPress={() => remove(entry.codeNace)}>
            <Text style={styles.removeText}>Retirer</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un secteur (nom, code NACE, EAC, technique...)"
          placeholderTextColor={colors.contentQuaternary}
        />
        <Pressable style={styles.browseBtn} onPress={openBrowse}>
          <Ionicons name="list-outline" size={18} color={colors.contentInverse} />
        </Pressable>
      </View>
      {loading && <ActivityIndicator style={{ marginTop: 6 }} />}
      {results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.codeNace}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.resultRow} onPress={() => select(item)}>
                <Text style={styles.resultCode}>
                  NACE {item.codeNace} · EAC {item.codeEac}
                </Text>
                <Text style={styles.resultDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {selectedEntries.length > 0 && activeStandards.length > 0 && (
        <View style={styles.riskSummary}>
          {activeStandards.map((std) => {
            const risk = resolveMostCriticalRisk(selectedEntries, std);
            return (
              <Text key={std} style={styles.riskLine}>
                {std} : risque retenu = <Text style={styles.riskValue}>{risk ?? "non déterminé"}</Text>
              </Text>
            );
          })}
        </View>
      )}

      <Modal visible={browseOpen} animationType="slide" onRequestClose={() => setBrowseOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tous les secteurs</Text>
            <Pressable onPress={() => setBrowseOpen(false)}>
              <Ionicons name="close" size={24} color={colors.contentPrimary} />
            </Pressable>
          </View>
          <TextInput
            style={styles.modalSearchInput}
            value={browseFilter}
            onChangeText={setBrowseFilter}
            placeholder="Filtrer la liste..."
            placeholderTextColor={colors.contentQuaternary}
          />
          {allEntries === null ? (
            <ActivityIndicator style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredAll}
              keyExtractor={(item) => item.codeNace}
              renderItem={({ item }) => {
                const checked = selectedEntries.some((s) => s.codeNace === item.codeNace);
                return (
                  <Pressable style={styles.browseRow} onPress={() => toggleInBrowse(item)}>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={14} color={colors.contentInverse} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.browseCode}>
                        NACE {item.codeNace} · EAC {item.codeEac}
                      </Text>
                      <Text style={styles.browseDesc}>{item.description}</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
          <Pressable style={styles.modalDoneBtn} onPress={() => setBrowseOpen(false)}>
            <Text style={styles.modalDoneText}>
              Terminé ({selectedEntries.length} secteur{selectedEntries.length !== 1 ? "s" : ""} sélectionné
              {selectedEntries.length !== 1 ? "s" : ""})
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md + 2 },
  label: { fontSize: typography.body, color: colors.contentSecondary, marginBottom: 2, fontWeight: "600" },
  hint: { fontSize: typography.caption, color: colors.contentQuaternary, marginBottom: spacing.sm },
  chip: { flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.sm + 2, marginBottom: 6 },
  chipCode: { fontSize: typography.caption, color: colors.contentTertiary, fontWeight: "700" },
  chipDesc: { fontSize: typography.body, color: colors.contentSecondary, marginTop: 2 },
  removeText: { color: colors.error, fontSize: typography.small, marginLeft: spacing.sm },
  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm + 2, fontSize: typography.subtitle },
  browseBtn: { width: 44, borderRadius: radius.md, backgroundColor: colors.actionPrimary, alignItems: "center", justifyContent: "center" },
  dropdown: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, marginTop: 4, maxHeight: 220, backgroundColor: colors.surfaceBase },
  resultRow: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  resultCode: { fontSize: typography.caption, color: colors.contentTertiary, fontWeight: "700" },
  resultDesc: { fontSize: typography.body, color: colors.contentSecondary, marginTop: 2 },
  riskSummary: { backgroundColor: colors.successSurface, borderRadius: radius.md, padding: spacing.sm + 2, marginTop: 6 },
  riskLine: { fontSize: typography.small, color: colors.contentSecondary, marginBottom: 2 },
  riskValue: { fontWeight: "700", color: colors.success },
  modalContainer: { flex: 1, backgroundColor: colors.surfaceBase, paddingTop: 50 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  modalTitle: { fontSize: typography.heading, fontWeight: "700", color: colors.contentPrimary },
  modalSearchInput: { marginHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm + 2, fontSize: typography.subtitle, marginBottom: spacing.sm },
  browseRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, gap: spacing.sm + 2 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.borderDefault, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  browseCode: { fontSize: typography.caption, color: colors.contentTertiary, fontWeight: "700" },
  browseDesc: { fontSize: typography.body, color: colors.contentSecondary, marginTop: 1 },
  modalDoneBtn: { backgroundColor: colors.actionPrimary, margin: spacing.lg, borderRadius: radius.lg, paddingVertical: spacing.md + 2, alignItems: "center" },
  modalDoneText: { color: colors.contentInverse, fontWeight: "700", fontSize: typography.subtitle },
});
