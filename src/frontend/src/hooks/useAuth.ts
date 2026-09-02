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

  const fetchMe = useCallback(async () => {
    setIsLoading(true);
    setError(null);
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
        return;
      }

      if (!res.ok) {
        throw new Error(`/auth/me returned ${res.status}`);
      }

      const data = await res.json();
      setUser(data as AuthUser);
    } catch (e: any) {
      // Network error — treat as unauthenticated but surface the error
      // so the UI can show a "Cannot reach server" message.
      setUser(null);
      setError(e.message ?? "Cannot reach the authentication service.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // On the web, also check for auth_error in the URL query string —
    // this is appended by the PHP callback if the OAuth flow fails.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      if (authError) {
        setError(decodeURIComponent(authError));
        // Remove the query param so it doesn't persist on reload.
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    fetchMe();
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
