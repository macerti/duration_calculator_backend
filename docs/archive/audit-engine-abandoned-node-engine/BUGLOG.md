# Bug Log

Every entry here corresponds to a `z` version bump in `CHANGELOG.md`. Format:
**Detected** (how/when found) → **Cause** → **Fix** → **Version fixed in**.

---

### BUG-001 — `tsconfig.json` used a removed `moduleResolution` value
- **Detected**: `npx tsc --noEmit` failed immediately on first typecheck pass, before any
  engine logic ran — `TS5108: Option 'moduleResolution=node10' has been removed`.
- **Cause**: TypeScript 7 (installed by default via `npm install -D typescript`) dropped the
  legacy `node10` resolution mode; a stray duplicate `module` key was also left in the config
  from an intermediate edit.
- **Fix**: Pinned `typescript` to `5.6.3` (stable, matches the Node/CommonJS target of this
  project) and rewrote `tsconfig.json` cleanly with `moduleResolution: "node"`.
- **Fixed in**: 0.1.0 (pre-release, caught before first ship)

### BUG-002 — Relative import paths in `api/server.ts` pointed at nonexistent siblings
- **Detected**: Same typecheck pass, after BUG-001 fix — `TS2307: Cannot find module
  './data/parameters'`.
- **Cause**: `server.ts` lives in `src/api/`, but imports were written as if it were at
  `src/` root (`./data/parameters` instead of `../data/parameters`).
- **Fix**: Corrected the three relative imports (`../data/parameters`, `../engine`, `../types`).
- **Fixed in**: 0.1.0 (pre-release)

### BUG-003 — Express 5 `req.params.code` typed as `string | string[]`
- **Detected**: Same typecheck pass — `TS2345` on `findNaceEntry(req.params.code, params)`.
- **Cause**: Express 5's stricter route-param types allow array params for repeated segments;
  `findNaceEntry` expects a plain `string`.
- **Fix**: Explicit `String(req.params.code)` coercion before use.
- **Fixed in**: 0.1.0 (pre-release)

### BUG-004 — Backgrounded dev server killed the tool call / became unreachable
- **Detected**: `curl localhost:4000/api/calculate` returned `HTTP:000` (connection failed)
  right after starting the server with `(npx tsx ... &)`.
- **Cause**: Backgrounding with a bare `&` inside the sandboxed bash tool ties the process's
  lifetime to the parent shell command, which exits when the tool call returns — the server
  was reaped immediately.
- **Fix**: Used `setsid nohup npx tsx src/api/server.ts > /tmp/server.log 2>&1 < /dev/null &`
  to fully detach the process from the tool-call shell session.
- **Fixed in**: 0.1.0 (pre-release, dev/tooling issue only — not shipped code)

### BUG-005 — `setsid`/backgrounding flakiness when testing DB-fallback boot
- **Detected**: While verifying the graceful-fallback behavior added in 1.0.0, the first
  couple of `curl` calls against a freshly backgrounded server returned connection errors
  (`HTTP:000` / empty response) even though the server logged successfully starting.
- **Cause**: Same class of issue as BUG-004 — timing between the tool call returning and
  the backgrounded process actually being ready to accept connections in this sandboxed
  shell, compounded by `setsid`/`disown` not being consistently available.
- **Fix**: No code fix needed — this is a test-tooling issue, not an engine/API bug. Worked
  around by using plain `nohup ... &` (no `setsid`) and adding a `sleep 3` before the first
  `curl`, then retrying once if empty. Confirmed both the fallback-mode `/health` response
  and the `503` on `/api/cases` once the server was reliably reachable.
- **Fixed in**: 1.0.0 (dev/tooling issue only — not shipped code)

---

## Open / not yet hit
_(none currently — will log here as they're found, including anything reported after
the engine is exercised with real dossier data, or once deployed to the actual cPanel host)_
