# Bug Log — audit-mobile

### BUG-001 — `expo-constants` used but not installed
- **Detected**: `npx tsc --noEmit` — `TS2307: Cannot find module 'expo-constants'`.
- **Cause**: `src/config/api.ts` imports `expo-constants` for reading `app.json`
  extras, but it wasn't an explicit dependency (only pulled in transitively by `expo`).
- **Fix**: `npm install expo-constants` explicitly.
- **Fixed in**: 0.1.0 (pre-release)

### BUG-002 — `HomeScreen` health-state spread overwrote the discriminant field
- **Detected**: Same typecheck pass — `TS2322`/`TS2783` on `setHealth({ status: "ok", ...h })`.
- **Cause**: The API's `/health` response also has a field called `status` (its own
  `"ok"` string from the server), and spreading `...h` after `status: "ok"` let the
  server's `status` field silently overwrite the discriminant the UI state union
  relies on — TypeScript caught it, but this would have been a real runtime bug
  (health card permanently stuck showing nothing, or worse, silently wrong branch)
  had it shipped.
- **Fix**: Destructured explicitly instead of spreading: `{ status: "ok", parameterSetId: h.parameterSetId, version: h.version, dbConnected: h.dbConnected, dbBackedParameters: h.dbBackedParameters }`.
- **Fixed in**: 0.1.0 (pre-release)

### BUG-003 — `expo export --platform web` failed on peer dependency mismatch
- **Detected**: `react-dom` installed at a version whose peer `react` requirement
  (`^19.2.8`) didn't match the project's actual `react` version (`19.2.3`), causing
  `npm install --legacy-peer-deps` to be silently needed / plain install to fail.
- **Cause**: `npm install react-dom` without a version pin grabbed latest, which had
  drifted ahead of the Expo-managed `react` version in this project.
- **Fix**: Pinned `react-dom@19.2.3` to match the project's `react` version exactly.
- **Fixed in**: 0.1.0 (pre-release)

---

## Open / not yet hit
_(none currently — will log here once tested against a live backend from a real
device/simulator, which may surface CORS, network-permission, or env-var issues
not visible from the web bundle check alone)_
