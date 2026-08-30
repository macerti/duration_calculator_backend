import Constants from "expo-constants";

/**
 * Resolves the audit-engine (PHP) API base URL.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL env var — set this when building for production,
 *     e.g. EXPO_PUBLIC_API_URL=https://macerti.com/audit-api/public npx expo export --platform web
 *     (point it at wherever backend/public/ ends up living on your host)
 *  2. app.json "extra.apiUrl"
 *  3. Local dev fallback — NOTE: "localhost" only works in a web browser or
 *     iOS simulator on the same machine as the API. On a physical device or
 *     Android emulator, replace this with your machine's LAN IP.
 */
const FALLBACK_DEV_URL = "http://localhost:8000";

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  FALLBACK_DEV_URL;
