import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { API_BASE_URL } from "../config/api";

/**
 * Matches db/userRepo.php's getUserProfile() exactly (see api/index.php's
 * GET /auth/me, POST /auth/login, POST /auth/reset-password responses —
 * all three return this same shape). Replaces a stale pre-local-accounts
 * type that had a single hard-coded `provider: "microsoft" | "google"`
 * field left over from when SSO callbacks dumped raw provider claims
 * straight into the session (see docs/DEV_STATUS.md's twenty-fifth-session
 * entry on resolveSsoUser() — that stopped being true two sessions before
 * this type was ever corrected to match it).
 */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  pendingEmail: string | null;
  emailVerified: boolean;
  status: string;
  hasPassword: boolean;
  linkedProviders: string[];
  role: { id: number; name: string };
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  /** Green-banner equivalent of `error` — currently only set from the
   * backend's `?verified=1` email-confirmation redirect. */
  notice: string | null;
  /** Session CSRF token from /auth/me, /auth/login, or /auth/reset-password.
   * Required as the X-CSRF-Token header on change-password, profile PUT,
   * and every /admin/* mutating call — see auth/Guard.php's requireCsrf(). */
  csrfToken: string | null;
  /** Extracted once from `?reset_token=...` on the password-reset email
   * link and stripped from the URL immediately, same pattern as
   * auth_error/auth=ok below. Null once there is no reset in progress. */
  resetToken: string | null;
  clearResetToken: () => void;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  code?: string;
  message?: string;
}

function hasPermission(user: AuthUser | null, key: string): boolean {
  return user?.permissions.includes(key) ?? false;
}

/**
 * Auth state hook — local email/password accounts, Microsoft/Google SSO,
 * and role-based permissions, all backed by real server-side sessions.
 *
 * Calls GET /api/auth/me on mount to check the PHP session cookie.
 * The session is managed entirely server-side (HttpOnly cookie) — the
 * hook only knows the user's public profile fields.
 *
 * SSO sign-in: loginWithMicrosoft() / loginWithGoogle() do a full-page
 * redirect to the PHP OAuth initiation endpoint; the PHP backend handles
 * the OAuth dance and redirects back.
 *
 * Local sign-in/account management: login(), register(), forgotPassword(),
 * resetPassword(), resendVerification(), changePassword(), updateProfile()
 * all call the matching /auth/* JSON endpoint directly and return an
 * AuthResult rather than throwing, so a screen can show the exact server
 * message (these endpoints deliberately return specific, safe-to-display
 * text — see api/index.php's own comments on why each message is worded
 * the way it is, e.g. the generic forgot-password response).
 */
export function useAuth(): AuthState & {
  loginWithMicrosoft: () => void;
  loginWithGoogle: () => void;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  forgotPassword: (email: string) => Promise<AuthResult>;
  resetPassword: (token: string, newPassword: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  updateProfile: (fields: { name?: string; email?: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refetch: () => void;
  hasPermission: (key: string) => boolean;
} {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  /** Shared JSON fetch for every /auth/* and /admin/* call: always sends
   * the session cookie (credentials: include — required cross-origin, see
   * BUG-046 in docs/BUGLOG.md for the same fix on the other API client)
   * and attaches X-CSRF-Token automatically whenever one is known, since
   * the handful of routes that don't require it (register/login/forgot/
   * reset-password, all pre-session) simply ignore an extra header. */
  const authFetch = useCallback(
    async (path: string, init?: RequestInit): Promise<{ status: number; body: any }> => {
      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}${path}`, {
          ...init,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            ...(init?.headers ?? {}),
          },
        });
      } catch (e: any) {
        return { status: 0, body: { error: e?.message ?? "Impossible de joindre le serveur." } };
      }
      const text = await res.text();
      const body = text ? JSON.parse(text) : {};
      return { status: res.status, body };
    },
    [csrfToken]
  );

  const fetchMe = useCallback(
    async (opts?: { preserveError?: boolean; sawAuthOk?: boolean }) => {
      setIsLoading(true);
      if (!opts?.preserveError) {
        // Only clear a stale error when this call isn't specifically trying
        // to preserve one just set from the OAuth callback's ?auth_error=
        // query param (see the mount effect below) — otherwise this line
        // clobbers it in the same render batch, before it's ever shown.
        setError(null);
      }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          // credentials: 'include' is critical — it tells the browser to send
          // the session cookie cross-origin (e.g. from the Expo dev server
          // to the PHP backend). Without it, the cookie is never sent and
          // the server always sees an unauthenticated request.
          credentials: "include",
        });

        if (res.status === 401) {
          setUser(null);
          setCsrfToken(null);
          if (opts?.sawAuthOk) {
            // The PHP callback redirected here with ?auth=ok — meaning the
            // token exchange and sessionSetUser() succeeded server-side —
            // yet this immediate follow-up check says unauthenticated. That
            // combination almost always means the session cookie/data isn't
            // surviving between the two requests (e.g. a shared-hosting
            // open_basedir restriction blocking PHP's session save path),
            // not a normal "never logged in" visit — so say so explicitly
            // instead of silently looking identical to a fresh visit.
            setError(
              "Sign-in appeared to succeed, but the session wasn't recognized right after. " +
                "This usually means the server couldn't persist the session — check the PHP " +
                "session save path / open_basedir setting on the host, or the PHP error log " +
                "around this time (see docs/BUGLOG.md BUG-037)."
            );
          }
          return;
        }

        if (!res.ok) {
          throw new Error(`/auth/me returned ${res.status}`);
        }

        const data = await res.json();
        const { csrfToken: token, ...profile } = data;
        setUser(profile as AuthUser);
        setCsrfToken(typeof token === "string" ? token : null);
        setError(null); // a genuinely successful check always clears any prior error
      } catch (e: any) {
        // Network error — treat as unauthenticated but surface the error
        // so the UI can show a "Cannot reach server" message.
        setUser(null);
        setCsrfToken(null);
        setError(e.message ?? "Cannot reach the authentication service.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // On the web, also check for auth_error / auth=ok / verified=1 /
    // verify_error / reset_token in the URL query string — all appended
    // by PHP redirects (OAuth callbacks, the email-verification link, and
    // the password-reset email's direct-to-frontend link respectively).
    let sawAuthError = false;
    let sawAuthOk = false;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      const authErrorDescription = params.get("auth_error_description");
      if (authError) {
        sawAuthError = true;
        // authError itself is the raw OAuth error code (e.g. "invalid_request")
        // — often meaningless on its own. When the provider also sent
        // error_description (see BUG-038 in docs/BUGLOG.md — this used to be
        // silently discarded server-side), show both so the banner is
        // actually actionable instead of a bare code.
        //
        // No decodeURIComponent() here: URLSearchParams.get() already fully
        // decodes the value (that's its job). Calling decodeURIComponent()
        // again on an already-decoded string was a latent bug in the
        // pre-existing state_mismatch/callback_failed handling — harmless
        // there only because those two fixed strings never contain a literal
        // "%". error_description is free-form provider text; double-decoding
        // it would throw an uncaught URIError on any "%" not followed by two
        // valid hex digits, crashing this effect instead of showing the
        // banner. Fixed here rather than reproduced for the new field.
        //
        // AADSTS9002325 has a known, fully-diagnosed cause in this app (see
        // BUG-038 in docs/BUGLOG.md): the redirect URI is registered under
        // Azure Portal's "Single-page application" platform type instead of
        // "Web", which makes Entra ID require PKCE even though this backend
        // does a confidential/server-side exchange. If this fires again
        // (e.g. someone edits the app registration back, or Google gets the
        // same platform-type mistake), point straight at the fix instead of
        // making the next session re-derive it from a bare AADSTS code.
        //
        // Authorization_RequestDenied also has a known, fully-diagnosed
        // cause (see BUG-039 in docs/BUGLOG.md): the token exchange itself
        // succeeds, but the resulting access token wasn't authorized to call
        // Microsoft Graph's /me endpoint because the /authorize request's
        // scope was missing Graph's own "User.Read" permission (the OIDC
        // "openid profile email" scopes only control ID-token claims, not
        // Graph API access — a genuinely easy trap). Fixed at the source in
        // MicrosoftOAuth.php; this hint is defense-in-depth in case the
        // scope regresses, or the tenant additionally requires admin
        // consent for User.Read (rare, but shows as this same Graph error).
        const knownCauseHint = authErrorDescription?.includes("AADSTS9002325")
          ? " — known cause: redirect URI is registered as \"Single-page application\" in Azure Portal instead of \"Web\" (see docs/BUGLOG.md BUG-038)."
          : authErrorDescription?.includes("Authorization_RequestDenied")
          ? " — known cause: the Microsoft sign-in request wasn't scoped for Graph API access (see docs/BUGLOG.md BUG-039). If this persists after the fix, the Azure tenant may require admin consent for the User.Read permission — check Azure Portal → App registrations → API permissions."
          : "";
        setError(
          authErrorDescription
            ? `${authError}: ${authErrorDescription}${knownCauseHint}`
            : authError
        );
      }
      if (params.get("auth") === "ok") {
        sawAuthOk = true;
      }
      if (params.get("verified") === "1") {
        setNotice("Adresse e-mail confirmée. Vous pouvez maintenant vous connecter.");
      }
      const verifyError = params.get("verify_error");
      if (verifyError) {
        setError(
          "Ce lien de confirmation est invalide ou a expiré. Demandez un nouveau lien depuis l'écran de connexion."
        );
      }
      const rt = params.get("reset_token");
      if (rt) {
        setResetToken(rt);
      }
      if (authError || sawAuthOk || params.get("verified") || verifyError || rt) {
        // Remove the query param(s) so they don't persist on reload.
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    fetchMe(
      sawAuthError || sawAuthOk
        ? { preserveError: sawAuthError, sawAuthOk }
        : undefined
    );
  }, [fetchMe]);

  /** Redirect to the PHP Microsoft OIDC initiation endpoint. */
  const loginWithMicrosoft = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = `${API_BASE_URL}/auth/microsoft`;
    }
  }, []);

  /** Redirect to the PHP Google OAuth initiation endpoint. */
  const loginWithGoogle = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = `${API_BASE_URL}/auth/google`;
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { status, body } = await authFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (status !== 200) {
        return { ok: false, error: body?.error ?? "Connexion impossible.", code: body?.code };
      }
      const { csrfToken: token, ...profile } = body;
      setUser(profile as AuthUser);
      setCsrfToken(typeof token === "string" ? token : null);
      setError(null);
      return { ok: true };
    },
    [authFetch]
  );

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      const { status, body } = await authFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (status !== 201) {
        return { ok: false, error: body?.error ?? "Inscription impossible." };
      }
      return { ok: true, message: body?.message };
    },
    [authFetch]
  );

  const forgotPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      const { status, body } = await authFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (status !== 200) {
        return { ok: false, error: body?.error ?? "Une erreur est survenue." };
      }
      return { ok: true, message: body?.message };
    },
    [authFetch]
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string): Promise<AuthResult> => {
      const { status, body } = await authFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      if (status !== 200) {
        return { ok: false, error: body?.error ?? "Réinitialisation impossible." };
      }
      const { csrfToken: t, ...profile } = body;
      setUser(profile as AuthUser);
      setCsrfToken(typeof t === "string" ? t : null);
      setResetToken(null);
      return { ok: true };
    },
    [authFetch]
  );

  const resendVerification = useCallback(
    async (email: string): Promise<AuthResult> => {
      const { status, body } = await authFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      return status === 200
        ? { ok: true, message: body?.message }
        : { ok: false, error: body?.error ?? "Une erreur est survenue." };
    },
    [authFetch]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      const { status, body } = await authFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return status === 200
        ? { ok: true }
        : { ok: false, error: body?.error ?? "Changement de mot de passe impossible." };
    },
    [authFetch]
  );

  const updateProfile = useCallback(
    async (fields: { name?: string; email?: string }): Promise<AuthResult> => {
      const { status, body } = await authFetch("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(fields),
      });
      if (status !== 200) {
        return { ok: false, error: body?.error ?? "Mise à jour impossible." };
      }
      const { csrfToken: t, ...profile } = body;
      setUser(profile as AuthUser);
      if (typeof t === "string") setCsrfToken(t);
      return { ok: true };
    },
    [authFetch]
  );

  /** Destroy the server-side session and clear local auth state. */
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort — even if the server is unreachable, clear local state.
    }
    setUser(null);
    setCsrfToken(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    error,
    notice,
    csrfToken,
    resetToken,
    clearResetToken: () => setResetToken(null),
    loginWithMicrosoft,
    loginWithGoogle,
    login,
    register,
    forgotPassword,
    resetPassword,
    resendVerification,
    changePassword,
    updateProfile,
    logout,
    refetch: fetchMe,
    hasPermission: (key: string) => hasPermission(user, key),
  };
}
