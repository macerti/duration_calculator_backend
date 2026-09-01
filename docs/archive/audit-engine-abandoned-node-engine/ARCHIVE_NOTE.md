# Archive note — abandoned Node/TypeScript engine

**Archived**: 2026-09-01 (repository architecture consolidation, step 1).

**What this is**: the original Node/TypeScript implementation of the audit
duration calculation engine, before the project moved to PHP. Superseded
entirely by `duration-calculator-php/` once it was confirmed the target
DirectAdmin host has no Node.js Selector — see the root `README.md`'s "Why
PHP" section.

**Why it's kept**: historical/traceability value only (worked examples,
formula reasoning, early decisions in its own `BUGLOG.md`/`ROADMAP.md`).
Not maintained in lockstep with the PHP engine and must not be treated as a
source of truth for current behavior.

**Verified safe to archive at the time**: grepped the whole repo for
"audit-engine" — only hits outside this folder were two source comments
noting historical lineage (`duration-calculator-php/data/parameters.php`,
`audit-mobile/src/config/api.ts`), not live imports/requires.
`.github/workflows/build-test-publish.yml` never references it.

**Note (2026-09-01, step 2 session)**: this note was referenced by
`docs/DEV_STATUS.md`'s step-1 log entry at the time of the archive move but
was never actually created until now — retroactively added while archiving
`audit-app/` (see the sibling
`docs/archive/audit-app-legacy-two-folder-implementation/ARCHIVE_NOTE.md`
for that unrelated, later archive).
