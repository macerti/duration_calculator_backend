import Constants from "expo-constants";

/**
 * Resolves the audit-engine API base URL.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL env var (set in .env / eas.json per environment)
 *  2. app.json "extra.apiUrl"
 *  3. Local dev fallback — NOTE: "localhost" only works in a web browser or
 *     iOS simulator. On a physical device or Android emulator, replace this
 *     with your machine's LAN IP (e.g. http://192.168.1.23:4000) before testing.
 */
const FALLBACK_DEV_URL = "http://localhost:4000";

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  FALLBACK_DEV_URL;
