# Completed History — Features, Bugs, and Infrastructure Milestones

> This document archives all completed, verified, and closed roadmap items and historical bug resolutions across versions 1.0.0 through 5.1.1.
> Active and upcoming work is tracked in [ROADMAP.md](../ROADMAP.md) and [DEV_STATUS.md](../DEV_STATUS.md).

---

## 1. Completed Features by Release Milestone

### Version 5.1.0 & 5.1.1 (2026-09-01 — 2026-09-02)
- **FEAT-003: Versioning and update timestamp display**:
  - Implemented semantic `X.Y.Z` version footer with automated commit timestamp derivation via `generate-version.js` on build/export.
  - Display format: `Version X.Y.Z · Updated on DD Mon YYYY at HHhMM` (fixed UTC+1 offset per PO requirement, resolved in BUG-028).
  - Authoritative source: `package.json` + git commit metadata.
- **Repository Architecture Consolidation (Work Packages A–F)**:
  - Restructured repo into clean `src/frontend/` (Expo/React Native) and `src/backend/` (PHP 8.3 + MariaDB).
  - Preserved git commit history via `git mv`.
  - Added root `Makefile` (`dev-backend`, `dev-frontend`, `test`, `test-http`, `build-deploy`, `clean`).
  - Added `CONTRIBUTING.md`, `RELEASES.md`, and `docs/CALCULATION_RULES.md`.
  - Rewrote `docs/DEPLOY.md` to reflect the true single-subdomain deployment topology and documented `basePath`.
- **Automated Repository Hygiene & Deploy Checks (Work Package G)**:
  - Added `scripts/check-repo-hygiene.sh` (validates config examples, prevents secret leaks, verifies READMEs, checks for stale paths).
  - Added `scripts/check-deploy-artifact.sh` (validates deployment bundle structure, forbids vendored node_modules or source leaks).
  - Integrated into Makefile (`make check-hygiene`) and `.github/workflows/build-test-publish.yml`.
- **BUG-030 Router Architecture Fix**:
  - Replaced unstable `dirname($_SERVER['SCRIPT_NAME'])` prefix-stripping with explicit `basePath` configuration.
  - Verified 16/16 across divergent `php -S` invocations.
  - Verified 13/13 under real Apache 2.4 prefork + `mod_rewrite` + MariaDB 10.11 deployment topology.
- **Frontend Bug Log Consolidation**:
  - Folded `src/frontend/BUGLOG.md`'s colliding `BUG-001`..`BUG-004` into canonical `docs/BUGLOG.md` as `BUG-032`..`BUG-035`.
  - Re-confirmed `CalculationWizardScreen.tsx` error surfacing and retry implementation intact in source.

### Version 5.0.0 (2026-08-30)
- **Persistent wizard state**: Continuous auto-save and full hydration on reopen via `wizard_state_json`.
- **Synergy matrix**: Auditor × standard matrix with automatic Basique/Élevé classification.
- **Per-line factor percent editing**: Manual percentage overrides with live running totals and cap enforcement warnings.
- **Unlimited justified "Autre" entries**: Dynamic factor addition with mandatory justification note.
- **Per-standard risk override**: Manual override per standard while preserving auto-resolved baseline.
- **Sub-tabs per standard**: Dedicated Facteurs and Synthèse sub-tabs per declared standard.
- **Site/Siège labeling**: Fixed label + editable name + address + auto-renumbering + building icon.
- **NACE search enhancement**: Search by technical code (`Code_QM_Qualite`, `OH`, `EM`) and accent-folding.
- **Browse-all-sectors modal**: Full-catalog picker dialog.
- **Cascade deletion**: Client deletion cascades cleanly to associated calculations (`CASCADE`).
- **Home breadcrumb**: Persistent navigation breadcrumbs on client list and detail views.

### Version 4.1.0 (2026-08-25)
- **Design token system foundation**: Semantic UI tokens created in `src/theme/tokens.ts` and adopted across shared components.
- **Security audit baseline**: Initial security review documented in `SECURITY.md`.
- **Test checklist**: Stable scenario test suite created in `docs/TEST_CHECKLIST.md`.
- **Toast positioning**: Bottom-anchored undo toast with visual progress bar.

### Version 4.0.0 (2026-08-20)
- **Client & calculation deletion**: Optimistic delete with 30-second undo toast.
- **Client rename**: Inline editing with validation (shake animation on empty input).
- **Report & recap enhancements**: Year-grouped visual separators, numeric substitution in formulas, rounding guide suggestions.
- **Global error boundary**: Application-wide crash interceptor with recovery screen.
- **Search improvements**: Accent-insensitive and EAC/NACE code search.

### Version 3.0.0 (2026-08-19)
- **Report-writing time**: Calculated per visit instead of lump-summed.
- **Sector cap removed**: Support for >2 sectors per site.
- **Personnel validation UX**: Progressive shift questions and cross-site validation hints.
- **Dedicated traceability report**: Option 2 post-calculation report screen.

### Version 1.0.0 – 2.0.0 (Baseline Port)
- Ported core calculation engine from Node.js to PHP 8.3 with MariaDB 10.11 storage.
- Implemented full calculation lifecycle: Clients, Cases, IAF table parameters.
- Verified engine calculation formulas (24/24 smoke test baseline).

---

## 2. Closed Bug Log (Summary Archive)

| Bug ID | Title / Summary | Resolution | Version Closed |
|---|---|---|---|
| **BUG-001** | Accidental deletion of PHP backend with stale folder | Restored and verified | 1.0.1 |
| **BUG-002** | Metro bundler cache holding stale API URL | Cache clearing script added | 1.0.2 |
| **BUG-003** | Double `/api` path collision in single-folder deploy | Router basePath normalization | 1.0.3 |
| **BUG-004** | `mb_strtolower` undefined on minimal PHP installs | Added mbstring requirement & checks | 1.0.4 |
| **BUG-005** | Root-relative asset paths breaking subfolder deployment | Expo export publicPath configured | 1.0.5 |
| **BUG-006** | `StandardConfigPanel` TypeScript error on risk picker | Types aligned with auto-risk model | 1.0.6 |
| **BUG-007** | MariaDB background process exiting in sandbox commands | Documented single-script execution pattern | 2.0.0 |
| **BUG-008** | `totalDaysFinal` missing report-writing duration | Formula updated per IAF rule | 3.0.0 |
| **BUG-009** | Report-writing duration calculated on sum rather than per visit | Rewritten to compute per visit | 3.0.0 |
| **BUG-010** | Stale closure state updates in calculation wizard | Replaced with functional updater state hooks | 3.0.0 |
| **BUG-011** | Breadcrumb navigation leaving stale screens in stack | Reset navigation stack on home action | 3.0.0 |
| **BUG-012** | Blank white page on reopening pre-3.0 saved cases | Schema migration and safe fallbacks added | 4.0.0 |
| **BUG-013** | Foreign key lacking `ON DELETE` rule | Updated to `ON DELETE CASCADE` | 4.0.0 |
| **BUG-014** | Router accidentally overwritten with wrong topology | Reverted and protected | 4.0.0 |
| **BUG-015** | Misleading test result from restarted dev server | Test runner port verification added | 4.0.1 |
| **BUG-016** | Draft save failure not reproduced by minimal payload | Minimal payload verified valid (201) | 4.1.0 |
| **BUG-017** | NACE routes returning 404 under `php -S` | Root-caused to `SCRIPT_NAME` (see BUG-030) | Superseded |
| **BUG-018** | Initial draft save error silently swallowed | Added `draftSaveError` and retry button | 4.1.0 |
| **BUG-019** | CI test database config non-deterministic | Fixed config generation step | 4.1.1 |
| **BUG-020** | CI PHP parse error in config generation script | Syntax error corrected | 4.1.1 |
| **BUG-021** | Literal `\n` in TypeScript source failing tsc | Corrected line break | 4.1.1 |
| **BUG-022** | MariaDB CLI missing on GitHub runner | Switched to PHP PDO connectivity test | 4.1.1 |
| **BUG-023** | InnoDB errno 121 collision on calculation_cases FK | Separated constraint addition | 4.1.2 |
| **BUG-024** | UX decision: small persistent save button in header | Documented UX change | 4.1.2 |
| **BUG-028** | Footer showed committer's local timezone instead of fixed UTC+1 | Formatted to fixed UTC+1 | 5.1.0 |
| **BUG-030** | Router `SCRIPT_NAME` bug misrouting multi-segment paths | Replaced with explicit `basePath` config | 5.1.1 |
| **BUG-032** | `expo-constants` missing from package dependencies | Added to `package.json` | 0.1.0 (pre) |
| **BUG-033** | Discriminant field overwritten in `HomeScreen` health state | Destructured explicitly | 0.1.0 (pre) |
| **BUG-034** | `expo export` failed on peer dependency mismatch | Pinned `react-dom@19.2.3` | 0.1.0 (pre) |
