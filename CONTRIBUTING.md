# Contributing

This is a small, single-maintainer-plus-AI-sessions project, so this file
stays short and points to the real standing documents rather than
duplicating them — duplicated status docs are exactly what
`REPOSITORY_ARCHITECTURE.md` warns against.

## Before you touch anything

Read **`docs/DEV_STATUS.md`** first, in full, especially its most recent
dated entry. It is the mandatory hand-off log between sessions/developers:
what's done, what's half-done, what was tried and rejected and why. Skipping
it is how duplicate work and re-litigated decisions happen.

Then, in priority order, check whether your task is already covered by:
`docs/BUGLOG.md` (known bugs, their status, and evidence already gathered),
`docs/ROADMAP.md` (planned features, explicitly ranked), `docs/ORIENTATIONS.md`
(the standing rules — priority order, versioning, testing standard, the
source/deployment separation rule, security principles). All four are kept
current, not archived; if something you're about to write already lives in
one of them, update it there instead of creating a new file.

## Environment setup

See the root `README.md`'s "Quick start" section, or just:
```
make dev-backend     # needs src/backend/config.php first, see docs/DEPLOY.md
make dev-frontend
```

## Making a change

1. Change source in `src/backend/` or `src/frontend/` — never in the
   deployment repo (`macerti/duration_calculator`). See the "Mandatory
   source/deployment separation" section at the top of `docs/DEPLOY.md`.
2. Test it. `make test` runs what needs no DB (PHP engine smoke tests +
   frontend typecheck); `make test-http` runs the full HTTP API regression
   against a local DB. This project's testing standard (see
   `docs/ORIENTATIONS.md`) is to verify against the actual artifact about
   to ship, not just reason about the diff — `make build-deploy` assembles
   that artifact locally so you can inspect it before anything is published.
3. If you touched a protected business rule (NAE/duration/pricing formulas —
   see `docs/CALCULATION_RULES.md` for the list and where each one lives),
   verify your change against the worked examples in `src/backend/tests/`,
   not just against your own reasoning about the formula.
4. Update the relevant standing doc(s) as part of the same change — a bug
   you found or fixed goes in `docs/BUGLOG.md`, a structural decision goes
   in `docs/DEV_STATUS.md`'s dated log, a version-worthy change goes in
   `CHANGELOG.md` (see `docs/ORIENTATIONS.md` for what counts as
   version-worthy — plenty of doc-only/reorg work correctly logs "no
   version change").
5. Commit with a message that states what changed and why, not just what
   file moved. Push to `main` — this repository has no PR gate; the CI
   workflow (build, test, publish to `duration_calculator`) runs directly
   on push.

## What not to do

- Don't fix application behavior by hand-editing the deployment repository.
- Don't invent a new status/log file for something one of the four standing
  docs above already covers.
- Don't defer the same known-large task indefinitely by re-describing it as
  "too big for one session" without doing the next concrete chunk of it —
  see `docs/DEV_STATUS.md`'s ninth-session entry for why this matters in
  practice, not just in principle.
