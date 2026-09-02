import Constants from "expo-constants";

/**
 * Resolves the backend API base URL (src/backend, served via `make dev-backend`
 * locally or the production API at PRODUCTION_API_URL in CI/deploy).
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL env var (set in .env / eas.json per environment)
 *  2. app.json "extra.apiUrl"
 *  3. Local dev fallback — matches `make dev-backend`'s `php -S localhost:8000`.
 *     NOTE: "localhost" only works in a web browser or iOS simulator. On a
 *     physical device or Android emulator, replace this with your machine's
 *     LAN IP (e.g. http://192.168.1.23:8000) before testing.
 */
const FALLBACK_DEV_URL = "http://localhost:8000";

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  FALLBACK_DEV_URL;
