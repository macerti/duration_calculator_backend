# History note — abandoned Node/TypeScript engine (code deleted, this note kept)

**Originally archived (folder move)**: 2026-09-01 (repository architecture
consolidation, step 1). **Code deleted, this note kept**: 2026-09-01
(repository architecture consolidation, step 2 continuation — see
`REPOSITORY_ARCHITECTURE.md`'s "do not use archive/ as a dumping ground;
delete and keep only a concise document" policy, added by an external
architecture review between steps).

**What this was**: the original Node/TypeScript implementation of the audit
duration calculation engine, before the project moved to PHP. Superseded
entirely by `duration-calculator-php/` once it was confirmed the target
DirectAdmin host has no Node.js Selector — see the root `README.md`'s "Why
PHP" section.

**Why the code was safe to delete**: historical/traceability value only
(worked examples, formula reasoning, early decisions in its own
`BUGLOG.md`/`ROADMAP.md`) — none of it was maintained in lockstep with the
PHP engine or treated as a source of truth for current behavior. The root
README's "Why PHP" section already states the formulas and worked examples
were verified against the same test cases during the port; the full commit
history (this file's own git log) still contains the deleted tree if a
question ever comes up about exactly what it looked like.

**Verified safe to delete**: grepped the whole repo for "audit-engine" —
only hits were two source comments noting historical lineage
(`duration-calculator-php/data/parameters.php`,
`audit-mobile/src/config/api.ts`), not live imports/requires.
`.github/workflows/build-test-publish.yml` never references it.

**Note (2026-09-01, step 2 session)**: this note was referenced by
`docs/DEV_STATUS.md`'s step-1 log entry at the time of the archive move but
was never actually created until now — retroactively added while archiving
`audit-app/` (see the sibling `docs/archive/AUDIT_APP_LEGACY.md` for that
unrelated, later archive/deletion).
