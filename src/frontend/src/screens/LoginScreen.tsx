import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, radius, typography } from "../theme/tokens";
import TextField from "../components/TextField";
import { AuthResult } from "../hooks/useAuth";

interface Props {
  onMicrosoft: () => void;
  onLogin: (email: string, password: string) => Promise<AuthResult>;
  onNavigateRegister: () => void;
  onNavigateForgotPassword: () => void;
  onResendVerification: (email: string) => Promise<AuthResult>;
  isLoading?: boolean;
  error?: string | null;
  notice?: string | null;
}

/**
 * LoginScreen — local email/password sign-in plus Microsoft SSO.
 *
 * Local accounts were added 2026-09-05 (docs/ROADMAP.md item 9) as the
 * lower-maintenance alternative to SSO Mahdi asked for once Google was
 * deprioritized. Microsoft SSO stays as a one-click alternative below the
 * local form — neither replaces the other, per FEAT-002's account model
 * (a user can have both a local password and a linked SSO identity).
 *
 * The "Continuer avec Google" button was removed 2026-09-03 per explicit
 * instruction (Google SSO deprioritized for now — see docs/ROADMAP.md
 * FEAT-002). Backend Google OAuth code (GoogleOAuth.php, useAuth.ts's
 * loginWithGoogle, the /auth/google route) is intentionally left in place,
 * untouched and unlinked, so it's a one-line re-wire away if this is
 * revisited later — do not delete it as "dead code" without checking
 * ROADMAP.md first.
 */
export default function LoginScreen({
  onMicrosoft,
  onLogin,
  onNavigateRegister,
  onNavigateForgotPassword,
  onResendVerification,
  isLoading,
  error,
  notice,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const submit = async () => {
    setLocalError(null);
    setNeedsVerification(false);
    setResendSent(false);
    if (email.trim() === "" || password === "") {
      setLocalError("Renseignez votre e-mail et votre mot de passe.");
      return;
    }
    setSubmitting(true);
    const result = await onLogin(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setLocalError(result.error ?? "Connexion impossible.");
      if (result.code === "email_not_verified") {
        setNeedsVerification(true);
      }
    }
  };

  const resend = async () => {
    const result = await onResendVerification(email.trim());
    if (result.ok) setResendSent(true);
  };

  const busy = isLoading || submitting;

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

        {/* Success banner (e.g. email just confirmed) */}
        {notice ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeBannerText}>✓ {notice}</Text>
          </View>
        ) : null}

        {/* Error banner */}
        {(localError || error) ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠ {localError ?? error}</Text>
            {needsVerification && !resendSent ? (
              <Pressable onPress={resend} accessibilityRole="button">
                <Text style={styles.errorBannerLink}>Renvoyer l'e-mail de confirmation</Text>
              </Pressable>
            ) : null}
            {resendSent ? (
              <Text style={styles.errorBannerLink}>E-mail de confirmation renvoyé (si le compte existe).</Text>
            ) : null}
          </View>
        ) : null}

        {/* Local email/password form */}
        <TextField
          label="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="prenom.nom@macerti.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextField
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
        />

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Se connecter"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.contentInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Se connecter</Text>
          )}
        </Pressable>

        <View style={styles.linksRow}>
          <Pressable onPress={onNavigateForgotPassword} accessibilityRole="button">
            <Text style={styles.linkText}>Mot de passe oublié ?</Text>
          </Pressable>
          <Pressable onPress={onNavigateRegister} accessibilityRole="button">
            <Text style={styles.linkText}>Créer un compte</Text>
          </Pressable>
        </View>

        {/* Divider between local login and SSO */}
        <View style={styles.orDividerRow}>
          <View style={styles.orDividerLine} />
          <Text style={styles.orDividerText}>ou</Text>
          <View style={styles.orDividerLine} />
        </View>

        {/* Microsoft button */}
        <Pressable
          style={({ pressed }) => [
            styles.ssoButton,
            styles.microsoftButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onMicrosoft}
          disabled={busy}
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
    marginBottom: spacing.md,
  },
  noticeBanner: {
    backgroundColor: colors.successSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  noticeBannerText: {
    color: colors.success,
    fontSize: typography.small,
    fontWeight: "600",
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
  errorBannerLink: {
    color: colors.error,
    fontSize: typography.small,
    fontWeight: "700",
    textDecorationLine: "underline",
    marginTop: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.actionPrimary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    color: colors.actionPrimaryText,
    fontSize: typography.bodyLarge,
    fontWeight: "700",
  },
  linksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  linkText: {
    color: colors.link,
    fontSize: typography.small,
    fontWeight: "600",
  },
  orDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  orDividerText: {
    marginHorizontal: spacing.sm,
    color: colors.contentTertiary,
    fontSize: typography.small,
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
