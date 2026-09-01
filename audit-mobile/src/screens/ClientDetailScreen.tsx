import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, Modal, TextInput, Animated } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RootStackParamList } from "../../App";
import { api, ApiError } from "../api/client";
import { CaseSummary } from "../types/engine";
import Breadcrumbs from "../components/Breadcrumbs";
import ResponsiveContainer from "../components/ResponsiveContainer";
import { useToast } from "../components/Toast";

type Props = NativeStackScreenProps<RootStackParamList, "ClientDetail">;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "#b7791f" },
  calculated: { label: "Calculé", color: "#1a7f37" },
  validated: { label: "Validé", color: "#0066cc" },
};

export default function ClientDetailScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [clientName, setClientName] = useState(route.params.clientName);
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(clientName);
  const [editNameError, setEditNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const shakeX = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      setCases(await api.listClientCases(clientId));
    } catch (e: any) {
      toast.show(e instanceof ApiError ? e.message : "Erreur de chargement", "error");
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shake = () => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const saveClientName = async () => {
    if (editName.trim() === "") {
      setEditNameError(true);
      shake();
      return;
    }
    setSaving(true);
    try {
      await api.updateClientName(clientId, editName.trim());
      setClientName(editName.trim());
      setEditModalOpen(false);
      toast.show("Nom du client mis à jour", "success");
    } catch (e: any) {
      toast.show(e instanceof ApiError ? e.message : "Erreur lors de la mise à jour", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteCase = (item: CaseSummary) => {
    setCases((prev) => (prev ? prev.filter((c) => c.id !== item.id) : prev));
    toast.showUndo(
      `Calcul "${item.dossierRef}" supprimé`,
      () => {
        setCases((prev) => (prev ? [item, ...prev] : prev));
      },
      () => {
        api.deleteCase(item.id).catch(() => {
          toast.show("Erreur lors de la suppression — le calcul a été restauré.", "error");
          load();
        });
      }
    );
  };

  return (
    <ResponsiveContainer>
      <View style={styles.container}>
        <Breadcrumbs
          items={[
            { icon: "home-outline", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })) },
            {
              label: "Clients",
              onPress: () => navigation.dispatch(CommonActions.reset({ index: 1, routes: [{ name: "Home" }, { name: "ClientsList" }] })),
            },
            { label: clientName },
          ]}
        />

        <View style={styles.header}>
          <Pressable
            style={styles.titleRow}
            onPress={() => {
              setEditName(clientName);
              setEditNameError(false);
              setEditModalOpen(true);
            }}
          >
            <Text style={styles.title}>{clientName}</Text>
            <Ionicons name="pencil-outline" size={16} color="#999" style={{ marginLeft: 8 }} />
          </Pressable>
          <Pressable
            style={styles.newButton}
            onPress={() => navigation.navigate("CalculationWizard", { clientId, clientName, caseId: undefined })}
          >
            <Text style={styles.newButtonText}>+ Nouveau calcul</Text>
          </Pressable>
        </View>

        {cases === null && <ActivityIndicator style={{ marginTop: 40 }} />}

        {cases !== null && cases.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucun calcul pour ce client</Text>
            <Text style={styles.emptyBody}>Créez un premier calcul de durée d'audit.</Text>
          </View>
        )}

        {cases !== null && cases.length > 0 && (
          <FlatList
            data={cases}
            keyExtractor={(c) => String(c.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => {
              const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, color: "#888" };
              return (
                <View style={styles.caseCardRow}>
                  <Pressable
                    style={styles.caseCard}
                    onPress={() => navigation.navigate("CalculationWizard", { clientId, clientName, caseId: item.id })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.caseDossier}>{item.dossierRef}</Text>
                      <Text style={styles.caseDate}>Modifié le {new Date(item.updatedAt).toLocaleDateString("fr-FR")}</Text>
                    </View>
                    <View style={styles.caseRight}>
                      {item.totalDays != null && <Text style={styles.caseDays}>{item.totalDays} j</Text>}
                      <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                        <Text style={styles.statusText}>{statusInfo.label}</Text>
                      </View>
                    </View>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => deleteCase(item)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color="#c53030" />
                  </Pressable>
                </View>
              );
            }}
          />
        )}
      </View>

      <Modal visible={editModalOpen} transparent animationType="fade" onRequestClose={() => setEditModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { transform: [{ translateX: shakeX }] }]}>
            <Text style={styles.modalTitle}>Renommer le client</Text>
            <TextInput
              style={[styles.modalInput, editNameError && styles.modalInputError]}
              value={editName}
              onChangeText={(t) => {
                setEditName(t);
                if (t.trim() !== "") setEditNameError(false);
              }}
              placeholder="Nom du client"
              placeholderTextColor="#999"
              autoFocus
            />
            {editNameError && <Text style={styles.fieldErrorText}>Le nom du client est obligatoire.</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setEditModalOpen(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalCreateBtn} onPress={saveClientName} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalCreateText}>Enregistrer</Text>}
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, marginTop: 4 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#1c1c1e" },
  newButton: { backgroundColor: "#1c1c1e", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  newButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  emptyState: { marginTop: 40, alignItems: "center", paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 8 },
  emptyBody: { fontSize: 13, color: "#888", textAlign: "center" },
  caseCardRow: { flexDirection: "row", alignItems: "stretch", gap: 8, marginBottom: 10 },
  caseCard: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f9f9fb", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#eee" },
  caseDossier: { fontSize: 15, fontWeight: "700", color: "#1c1c1e" },
  caseDate: { fontSize: 12, color: "#888", marginTop: 3 },
  caseRight: { alignItems: "flex-end" },
  caseDays: { fontSize: 15, fontWeight: "700", color: "#1a7f37", marginBottom: 4 },
  statusBadge: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
  statusText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  deleteBtn: { width: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#fdecea", borderRadius: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  modalInputError: { borderColor: "#c53030" },
  fieldErrorText: { color: "#c53030", fontSize: 12, marginTop: 6, fontWeight: "600" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16, gap: 10 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  modalCancelText: { color: "#666", fontSize: 14 },
  modalCreateBtn: { backgroundColor: "#1c1c1e", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, minWidth: 80, alignItems: "center" },
  modalCreateText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
