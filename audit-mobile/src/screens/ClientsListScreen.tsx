import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, ActivityIndicator, RefreshControl, Animated } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RootStackParamList } from "../../App";
import { api, ApiError } from "../api/client";
import { Client } from "../types/engine";
import { useToast } from "../components/Toast";
import ResponsiveContainer from "../components/ResponsiveContainer";
import { useBreakpoint } from "../hooks/useBreakpoint";

type Props = NativeStackScreenProps<RootStackParamList, "ClientsList">;

export default function ClientsListScreen({ navigation }: Props) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const bp = useBreakpoint();
  const shakeX = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const list = await api.listClients();
      setClients(list);
      setError(null);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement");
    }
  }, []);

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

  const createClient = async () => {
    if (newName.trim() === "") {
      setNameError(true);
      shake();
      return;
    }
    setCreating(true);
    try {
      const res = await api.createClient(newName.trim());
      setModalOpen(false);
      setNewName("");
      setNameError(false);
      toast.show(`Client "${res.name}" créé`, "success");
      await load();
      navigation.navigate("ClientDetail", { clientId: res.id, clientName: res.name });
    } catch (e: any) {
      toast.show(e instanceof ApiError ? e.message : "Erreur lors de la création", "error");
    } finally {
      setCreating(false);
    }
  };

  const deleteClient = (client: Client) => {
    // Optimistic: remove from the list immediately, nothing is actually
    // deleted server-side until the undo toast's countdown finishes.
    setClients((prev) => (prev ? prev.filter((c) => c.id !== client.id) : prev));
    toast.showUndo(
      `Client "${client.name}" supprimé`,
      () => {
        setClients((prev) => (prev ? [client, ...prev] : prev));
      },
      () => {
        api.deleteClient(client.id).catch(() => {
          toast.show("Erreur lors de la suppression — le client a été restauré.", "error");
          load();
        });
      }
    );
  };

  return (
    <ResponsiveContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mes clients</Text>
          <Pressable style={styles.newButton} onPress={() => setModalOpen(true)}>
            <Text style={styles.newButtonText}>+ Nouveau client</Text>
          </Pressable>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {clients === null && !error && <ActivityIndicator style={{ marginTop: 40 }} />}

        {clients !== null && clients.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucun client pour le moment</Text>
            <Text style={styles.emptyBody}>
              Créez un client pour commencer un calcul de durée d'audit. Un client peut avoir plusieurs calculs au
              fil du temps.
            </Text>
          </View>
        )}

        {clients !== null && clients.length > 0 && (
          <FlatList
            data={clients}
            keyExtractor={(c) => String(c.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            numColumns={bp === "desktop" ? 2 : 1}
            key={bp}
            columnWrapperStyle={bp === "desktop" ? { gap: 12 } : undefined}
            renderItem={({ item }) => (
              <View style={[styles.clientCardRow, bp === "desktop" && { flex: 1 }]}>
                <Pressable
                  style={styles.clientCard}
                  onPress={() => navigation.navigate("ClientDetail", { clientId: item.id, clientName: item.name })}
                >
                  <Text style={styles.clientName}>{item.name}</Text>
                  <Text style={styles.clientMeta}>
                    {item.calculationCount ?? 0} calcul{(item.calculationCount ?? 0) !== 1 ? "s" : ""}
                  </Text>
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={() => deleteClient(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color="#c53030" />
                </Pressable>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { transform: [{ translateX: shakeX }] }]}>
            <Text style={styles.modalTitle}>Nouveau client</Text>
            <TextInput
              style={[styles.modalInput, nameError && styles.modalInputError]}
              value={newName}
              onChangeText={(t) => {
                setNewName(t);
                if (t.trim() !== "") setNameError(false);
              }}
              placeholder="Nom du client"
              placeholderTextColor="#999"
              autoFocus
            />
            {nameError && <Text style={styles.fieldErrorText}>Le nom du client est obligatoire.</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalCreateBtn} onPress={createClient} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalCreateText}>Créer</Text>}
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#1c1c1e" },
  newButton: { backgroundColor: "#1c1c1e", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  newButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  errorBox: { backgroundColor: "#fdecea", borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: "#c53030", fontSize: 13 },
  emptyState: { marginTop: 40, alignItems: "center", paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 8 },
  emptyBody: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 19 },
  clientCardRow: { flexDirection: "row", alignItems: "stretch", gap: 8, marginBottom: 12 },
  clientCard: { flex: 1, backgroundColor: "#f9f9fb", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#eee" },
  clientName: { fontSize: 16, fontWeight: "700", color: "#1c1c1e" },
  clientMeta: { fontSize: 12, color: "#888", marginTop: 4 },
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
