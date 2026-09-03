import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, radius, typography } from "../theme/tokens";

interface Props {
  onMicrosoft: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * LoginScreen — clean, premium SSO sign-in page.
 *
 * One primary action:
 *   - "Continuer avec Microsoft" → kicks off the Entra ID OIDC flow
 *
 * The "Continuer avec Google" button was removed 2026-09-03 per explicit
 * instruction (Google SSO deprioritized for now — see docs/ROADMAP.md
 * FEAT-002). Backend Google OAuth code (GoogleOAuth.php, useAuth.ts's
 * loginWithGoogle, /auth/google route) is intentionally left in place,
 * untouched and unlinked, so it's a one-line re-wire away if this is
 * revisited later — do not delete it as "dead code" without checking
 * ROADMAP.md first.
 *
 * No username/password form. No client-side token logic.
 * Clicking the button does a full-page redirect to the PHP backend,
 * which handles the OAuth dance and redirects back on success.
 */
export default function LoginScreen({ onMicrosoft, isLoading, error }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        {/* Brand header */}
        <View style={styles.brandSection}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>A</Text>
          </View>
          <Text style={styles.appTitle}>Audit Duration Calculator</Text>
          <Text style={styles.appSubtitle}>GS0106 · IAF MD5 · MD1 · MD11</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.signInHeading}>Connectez-vous pour continuer</Text>
        <Text style={styles.signInBody}>
          Votre compte Microsoft vous donne accès à l'outil.{"\n"}
          Aucun mot de passe supplémentaire n'est requis.
        </Text>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠ {error}</Text>
          </View>
        ) : null}

        {/* Microsoft button */}
        <Pressable
          style={({ pressed }) => [
            styles.ssoButton,
            styles.microsoftButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onMicrosoft}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Continuer avec Microsoft"
        >
          {/* Microsoft logo mark (SVG-like, drawn with text/styled views) */}
          <View style={styles.msLogoGrid}>
            <View style={[styles.msSquare, { backgroundColor: "#f25022" }]} />
            <View style={[styles.msSquare, { backgroundColor: "#7fba00" }]} />
            <View style={[styles.msSquare, { backgroundColor: "#00a4ef" }]} />
            <View style={[styles.msSquare, { backgroundColor: "#ffb900" }]} />
          </View>
          <Text style={styles.microsoftButtonText}>Continuer avec Microsoft</Text>
        </Pressable>

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.contentTertiary} />
            <Text style={styles.loadingText}>Vérification en cours…</Text>
          </View>
        )}

        <Text style={styles.footerNote}>
          En vous connectant, vous acceptez que votre identité (nom et adresse e-mail)
          soit utilisée uniquement pour l'accès à cet outil.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceBase,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    width: "100%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  brandSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.contentPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  logoMarkText: {
    color: colors.contentInverse,
    fontSize: typography.heading,
    fontWeight: "800",
  },
  appTitle: {
    fontSize: typography.heading,
    fontWeight: "700",
    color: colors.contentPrimary,
    textAlign: "center",
  },
  appSubtitle: {
    fontSize: typography.small,
    color: colors.contentTertiary,
    marginTop: 4,
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginBottom: spacing.xl,
  },
  signInHeading: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.contentPrimary,
    marginBottom: spacing.xs,
  },
  signInBody: {
    fontSize: typography.body,
    color: colors.contentSecondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  errorBanner: {
    backgroundColor: colors.errorSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: typography.small,
    fontWeight: "600",
  },
  ssoButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  microsoftButton: {
    backgroundColor: "#0078d4",
    borderColor: "#0078d4",
  },
  microsoftButtonText: {
    color: "#ffffff",
    fontSize: typography.bodyLarge,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  // Microsoft 4-square logo
  msLogoGrid: {
    width: 20,
    height: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    marginRight: spacing.sm,
    gap: 2,
  },
  msSquare: {
    width: 9,
    height: 9,
    borderRadius: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: typography.small,
    color: colors.contentTertiary,
  },
  footerNote: {
    marginTop: spacing.md,
    fontSize: typography.caption,
    color: colors.contentQuaternary,
    textAlign: "center",
    lineHeight: 16,
  },
});
