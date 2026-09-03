import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { API_BASE_URL } from "../config/api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  provider: "microsoft" | "google";
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

/**
 * Auth state hook.
 *
 * Calls GET /api/auth/me on mount to check the PHP session cookie.
 * The session is managed entirely server-side (HttpOnly cookie) —
 * the hook only knows the user's public profile fields.
 *
 * For sign-in: use loginWithMicrosoft() / loginWithGoogle().
 * Both do a full-page redirect to the PHP OAuth initiation endpoint.
 * The PHP backend handles the OAuth dance and redirects back to the app.
 */
export function useAuth(): AuthState & {
  loginWithMicrosoft: () => void;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  refetch: () => void;
} {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setUser(data as AuthUser);
        setError(null); // a genuinely successful check always clears any prior error
      } catch (e: any) {
        // Network error — treat as unauthenticated but surface the error
        // so the UI can show a "Cannot reach server" message.
        setUser(null);
        setError(e.message ?? "Cannot reach the authentication service.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // On the web, also check for auth_error / auth=ok in the URL query
    // string — both are appended by the PHP OAuth callback (see BUG-037 in
    // docs/BUGLOG.md for the full reasoning behind both branches below).
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
        setError(authErrorDescription ? `${authError}: ${authErrorDescription}` : authError);
      }
      if (params.get("auth") === "ok") {
        sawAuthOk = true;
      }
      if (authError || sawAuthOk) {
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
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    error,
    loginWithMicrosoft,
    loginWithGoogle,
    logout,
    refetch: fetchMe,
  };
}
