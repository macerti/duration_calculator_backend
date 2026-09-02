# Releases — source ↔ deployment-artifact traceability

Every deploy-affecting change should have an entry here linking:
**source commit** (this repo) → **deployment-artifact commit**
(`macerti/duration_calculator`) → **whether it's confirmed live**.

`docs/DEPLOY.md`'s "How this normally gets deployed" section explains the
mechanism: a push to `main` here triggers `.github/workflows/build-test-publish.yml`,
which builds+tests+publishes to `macerti/duration_calculator` as a commit
message shaped `build: publish artifact from duration_calculator_source`.
That repository's own separate FTP workflow then ships it to
`tools.macerti.com`. "Confirmed live" below means confirmed against the real
production host, not just "the artifact repo has the commit" — those are not
the same thing, see BUG-031.

This file starts now (2026-09-02, ninth session); it isn't a complete
backfill of every past release, only what could be verified by actually
reading both repos' commit logs side by side.

## Entries (newest first)

### 2026-09-02 — repository architecture consolidation (this session)
- Source commit: `c261b88` (refactor: repository architecture consolidation).
  See `docs/DEV_STATUS.md`'s ninth-session entry for full scope: `src/frontend`/`src/backend`
  restructure, Makefile, CONTRIBUTING.md, this file, `docs/CALCULATION_RULES.md`, BUG-031.
- Deployment-artifact commit: not yet published — no application behavior
  changed (pure reorganization + docs), so this does not need to be
  urgently deployed, but it should still be pushed through CI once merged
  so the artifact repo's tree matches source layout expectations for the
  *next* real deploy.
- Live status: N/A (no behavior change).

### 2026-09-02 — BUG-030 fix verified (eighth session, docs-only)
- Source commit: `15a914c` (docs: verify BUG-030 fix against real
  Apache/.htaccess topology).
- Deployment-artifact commit: `946950b` (`macerti/duration_calculator`,
  2026-09-02 03:05:37 UTC) — confirmed by directly diffing the two repos'
  logs; this publish is a docs-only re-publish of the same application code
  as the entry below (no functional change between the two).
- Live status: **not confirmed**. This is the build that was live when the
  screenshot in BUG-031 was taken (~04:11 local / Algeria time, ~6 minutes
  after this publish, timezone-adjusted). The frontend's own "Updated on"
  footer timestamp on the live page matches this publish almost exactly —
  so the *code* is confirmed deployed, but the API was still 404ing on
  every route. See BUG-031: the leading hypothesis is that this is a
  server-side `config.php` value that was never updated to match, not a
  code or deployment-pipeline problem.

### 2026-09-02 — BUG-030 fix: router basePath bug (seventh session)
- Source commit: `a380780` (fix: BUG-030 router SCRIPT_NAME bug; reconcile
  PUT/NACE test contradiction; version 5.1.1).
- Deployment-artifact commit: `d82da0c` (`macerti/duration_calculator`,
  2026-09-02 02:52:43 UTC).
- Live status: not independently confirmed at the time; see the entry above
  for what's known now.
- Note for whoever deploys this for real: `config.example.php`'s
  documentation of `basePath` is not enough — the live server's actual
  `config.php` (gitignored, never touched by the deploy pipeline) must be
  manually edited to set `'basePath' => '/duration_calculator/api'` (or
  whatever the real deployed path is). This is exactly the gap BUG-031
  documents.
