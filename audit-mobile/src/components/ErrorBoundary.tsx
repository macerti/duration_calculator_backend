import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props {
  children: React.ReactNode;
  onGoHome?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * A render crash anywhere below this boundary used to mean a totally blank
 * white page with zero indication anything had gone wrong — that's what
 * happened reopening a calculation saved before the report-writing-per-visit
 * engine change, since old saved JSON lacks fields the UI now reads
 * unconditionally (see BUGLOG). Defensive fallbacks fix that specific case,
 * but this boundary is the general safety net: whatever crashes next, the
 * person sees an actual message and a way back, not a dead screen.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Render error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Un problème est survenu</Text>
          <Text style={styles.body}>
            Cet écran n'a pas pu s'afficher correctement. Si cela concerne un calcul enregistré avant une mise à
            jour récente, les anciennes données ne correspondent peut-être plus exactement au nouveau format
            d'affichage.
          </Text>
          <Text style={styles.detail}>{this.state.error.message}</Text>
          {this.props.onGoHome && (
            <Pressable style={styles.button} onPress={() => { this.setState({ error: null }); this.props.onGoHome?.(); }}>
              <Text style={styles.buttonText}>Retour à l'accueil</Text>
            </Pressable>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "700", color: "#c53030", marginBottom: 10, textAlign: "center" },
  body: { fontSize: 14, color: "#444", textAlign: "center", lineHeight: 20, marginBottom: 12 },
  detail: { fontSize: 11, color: "#999", textAlign: "center", marginBottom: 20, fontFamily: "monospace" },
  button: { backgroundColor: "#1c1c1e", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
