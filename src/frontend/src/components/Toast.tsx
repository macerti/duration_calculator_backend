import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

type ToastKind = "info" | "success" | "error";

interface SimpleToastItem {
  id: number;
  variant: "simple";
  message: string;
  kind: ToastKind;
}

interface UndoToastItem {
  id: number;
  variant: "undo";
  message: string;
  durationMs: number;
  onUndo: () => void;
  onExpire: () => void;
}

type ToastItem = SimpleToastItem | UndoToastItem;

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
  /** Shows an undoable action toast with a depleting countdown bar. If the
   * person taps "Annuler" before it runs out, onUndo() fires and onExpire()
   * never does. If it runs out untouched, onExpire() fires — this is where
   * the actual delete should happen, not before, so an accidental delete is
   * always reversible for the full duration. */
  showUndo: (message: string, onUndo: () => void, onExpire: () => void, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, variant: "simple", message, kind }]);
      timers.current[id] = setTimeout(() => dismiss(id), 3200);
    },
    [dismiss]
  );

  const showUndo = useCallback(
    (message: string, onUndo: () => void, onExpire: () => void, durationMs: number = 30000) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, variant: "undo", message, durationMs, onUndo, onExpire }]);
      timers.current[id] = setTimeout(() => {
        onExpire();
        dismiss(id);
      }, durationMs);
    },
    [dismiss]
  );

  const handleUndoPress = (item: UndoToastItem) => {
    item.onUndo();
    dismiss(item.id);
  };

  return (
    <ToastContext.Provider value={{ show, showUndo }}>
      {children}
      <View style={styles.overlay} pointerEvents="box-none">
        {toasts.map((t) =>
          t.variant === "simple" ? (
            <SimpleBubble key={t.id} toast={t} />
          ) : (
            <UndoBubble key={t.id} toast={t} onUndoPress={() => handleUndoPress(t)} />
          )
        )}
      </View>
    </ToastContext.Provider>
  );
}

function SimpleBubble({ toast }: { toast: SimpleToastItem }) {
  const opacity = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);
  const bg = toast.kind === "error" ? colors.error : toast.kind === "success" ? colors.success : colors.actionPrimary;
  return (
    <Animated.View style={[styles.bubble, { backgroundColor: bg, opacity }]}>
      <Text style={styles.bubbleText}>{toast.message}</Text>
    </Animated.View>
  );
}

function UndoBubble({ toast, onUndoPress }: { toast: UndoToastItem; onUndoPress: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(1)).current; // 1 -> 0 over durationMs, the "unloading" depletion

  React.useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(barWidth, {
      toValue: 0,
      duration: toast.durationMs,
      easing: Easing.linear,
      useNativeDriver: false, // width isn't supported by the native driver
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.undoBubble, { opacity }]}>
      <View style={styles.undoTopRow}>
        <Text style={styles.undoText}>{toast.message}</Text>
        <Pressable onPress={onUndoPress} style={styles.undoButton}>
          <Text style={styles.undoButtonText}>Annuler</Text>
        </Pressable>
      </View>
      <View style={styles.undoTrack}>
        <Animated.View
          style={[
            styles.undoFill,
            { width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", bottom: 80, left: 0, right: 0, alignItems: "center", zIndex: 999 },
  bubble: {
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    maxWidth: 420,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bubbleText: { color: colors.contentInverse, fontSize: typography.body, fontWeight: "600" },
  undoBubble: {
    backgroundColor: colors.actionPrimary,
    borderRadius: radius.lg,
    paddingTop: spacing.sm + 2,
    paddingHorizontal: spacing.md + 2,
    paddingBottom: 0,
    marginBottom: spacing.sm,
    width: 340,
    maxWidth: "92%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  undoTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: spacing.sm + 2 },
  undoText: { color: colors.contentInverse, fontSize: typography.body, fontWeight: "600", flex: 1, marginRight: spacing.sm + 2 },
  undoButton: { paddingVertical: 4, paddingHorizontal: spacing.sm + 2, borderRadius: radius.sm, backgroundColor: "rgba(255,255,255,0.15)" },
  undoButtonText: { color: colors.contentInverse, fontSize: typography.small, fontWeight: "700" },
  undoTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.15)", width: "100%" },
  undoFill: { height: 3, backgroundColor: colors.warning },
});
