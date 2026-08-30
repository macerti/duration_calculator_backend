# Roadmap — audit-app

## Requested, not yet built
- [x] ~~Design token system (semantic UI tokens)~~ — done in 4.1.0
      (`src/theme/tokens.ts`), adopted in shared components only — see
      "Design token migration" below for the rest
- [x] ~~Security audit~~ — done in 4.1.0, see `SECURITY.md` for full
      findings; quick/safe fixes applied immediately, bigger items
      (auth, rate limiting) tracked there as prioritized Todo
- [x] ~~Test checklist with version history~~ — done in 4.1.0
      (`TEST_CHECKLIST.md`)
- [x] ~~Toast position (undo toast should be at the bottom)~~ — done in 4.1.0
- [ ] **Authentication** — see `SECURITY.md` §Todo #1. Currently zero access
      control on any endpoint. Top priority before real client data goes in.
- [ ] **Rate limiting** — see `SECURITY.md` §Todo #2.
- [ ] Full input-bounds validation using `validationBounds` (exists in the
      parameter set, never wired into actual enforcement) — see
      `SECURITY.md` §Todo #3
- [ ] Confirm/set up database backups on the real DirectAdmin host — see
      `SECURITY.md` §Todo #4
- [ ] **Design token migration, remaining scope**: `HomeScreen`,
      `ClientsListScreen`, `ClientDetailScreen`, `CalculationWizardScreen`,
      `CalculationReportScreen`, `NumberField`, `SegmentedPicker`,
      `DualSectorPicker`, `FactorPicker`, `StandardConfigPanel`,
      `SynergyPanel`, `PersonnelForm`, `ErrorBoundary` — migrate
      opportunistically when each is next touched for an unrelated change,
      per `ORIENTATIONS.md`, rather than as one dedicated pass
- [x] ~~First real DB integration test~~ — done in 2.0.0
- [x] ~~NACE sector search wired into the site form~~ — done in 2.0.0
- [x] ~~Client → Calculation model~~ — done in 2.0.0
- [x] ~~Report-writing time per visit (not lump-summed)~~ — done in 3.0.0,
      verified against spec line 889
- [x] ~~Remove 2-sector cap~~ — done in 3.0.0
- [x] ~~Fix contradictory personnel-validation messaging + smart Next~~ —
      done in 3.0.0
- [x] ~~Progressive shift-team questions~~ — done in 3.0.0
- [x] ~~Separate Retour vs Accueil navigation~~ — done in 3.0.0
- [x] ~~EAC code alongside NACE~~ — done in 3.0.0
- [x] ~~Dedicated traceability report screen (Option 2)~~ — done in 3.0.0,
      **not yet visually verified in a real browser** — please confirm
      layout/readability on next test pass
- [ ] **PDF export of the calculation report** — explicitly requested to be
      parked here rather than built now. Report screen's data structure is
      already report-shaped, so this is mostly a rendering-target problem
      (server-side PDF generation, likely via the existing `pdf` skill
      pattern used elsewhere) once picked up.
- [ ] First real deploy to the actual DirectAdmin host (still only tested via
      a local MariaDB standing in for the real `macerti_audit_calc`)
- [ ] Visual confirmation of `CalculationWizardScreen`'s stale-closure fix
      and the personnel-step smart-routing fix, in an actual browser/device —
      both were fixed via architectural review (a well-understood React bug
      class matching the reported symptoms) rather than a directly
      reproduced-then-confirmed repro, since no headless browser is available
      in the build sandbox. Should be correct; please stress-test the exact
      original repro steps (siège+site1, deliberately mismatch one, correct
      it, switch tabs rapidly) on next pass.
- [ ] Custom pull-to-refresh with stretch/bounce visual feedback (the actual
      *data-loss* risk from the browser's native gesture is fixed —
      `overscroll-behavior-y: contain` — but the nice-to-have interactive
      feedback animation described isn't built)
- [x] ~~Full re-edit of an existing calculation's Sites/Effectif/Facteurs steps
      when reopening a saved case~~ — **still not built**, but the crash this
      caused is fixed (see 4.0.0 CHANGELOG); reopening still lands on Récap
      only, sectors still aren't reverse-mapped
- [x] ~~Synergy/integration inputs in the UI~~ — done in 4.0.0
- [x] ~~Delete for clients and calculations~~ — done in 4.0.0, optimistic
      with 30s undo, no confirmation dialogs
- [x] ~~Client rename UI~~ — done in 4.0.0 (endpoint existed since 2.0.0)
- [x] ~~Shake + label validation on empty client name~~ — done in 4.0.0
- [x] ~~Home icon instead of emoji, repositioned~~ — done in 4.0.0
- [x] ~~Accent-insensitive NACE search~~ — done in 4.0.0
- [x] ~~Search by NACE/EAC code, not just description~~ — done in 4.0.0
- [x] ~~Year-grouped visual separators in recap/report~~ — done in 4.0.0
- [x] ~~Numeric substitution in report formulas (not just formula shape)~~ —
      done in 4.0.0
- [x] ~~Rounding-guide column (suggested nearest-quarter, manual stays the
      real value)~~ — done in 4.0.0
- [x] ~~Global error boundary~~ — done in 4.0.0 (found necessary while
      fixing the blank-page crash; kept as permanent infrastructure)
- [ ] Global case list across all clients (currently per-client only)
- [ ] Extension-site toggle in the UI
- [ ] Visual confirmation, in a real browser, of everything shipped in 4.0.0
      that could only be typecheck/bundle-verified here: the shake animation,
      the undo toast's depleting progress bar, and the year-group visual
      styling. See CHANGELOG 4.0.0 for the full list.
- [ ] Synergy UI currently applies the same integration-level + auditor
      inputs identically across all of a site's active standards (correct
      per the engine's own formula) — if a real scenario ever needs
      *different* synergy inputs per standard at the same site, the data
      model (`SiteStandardInput.synergy` is already per-standard) supports
      it; the UI just doesn't expose that granularity yet since nothing
      indicated it was needed
- [ ] Tighten `allowedOrigins` in `config.php` once the frontend has a real URL
- [ ] Delete any one-off seed-trigger script from `api/` if the no-SSH seeding
      workaround from `DEPLOY.md` gets used
- [ ] Continue business-logic test coverage across more scenarios (sièges,
      sites, effectifs, facteurs, différents cas métier) — explicitly called
      out as an ongoing priority, not a one-time task; verify against the
      Excel/Markdown reference files specifically when in doubt, not general
      reasoning about what "should" be right

## Ideas / not yet requested (parked)
- Parameter admin UI (edit factor catalogue / IAF tables from a browser
  instead of editing PHP source + reseeding)
- Client-level notes/history beyond calculations (still not a CRM)
- Build the same `frontend/` as an actual installable iOS/Android app via EAS
  Build
- Quotation/pricing tool (deferred until the duration engine + UX is solid —
  arguably closer now)

## Decisions already made
- 2026-08-19: DirectAdmin confirmed as the actual host (not cPanel).
- 2026-08-19: No Node.js Selector → full PHP port. PHP + MariaDB.
- 2026-08-19: `audit-engine` (Node) and `audit-mobile` (Expo) kept as separate
  projects for reference/history — `duration_calculator/` (built from
  `audit-app/`) is the actual deployment target. **Note as of 3.0.0**: the
  Node/TS reference project's engine (`audit-engine/src/engine/`) and its
  vitest suite were NOT updated with the report-writing-per-visit fix — that
  project's tests would now report a stale/incorrect expected total if run.
  Not fixed due to time; flagged here rather than left silently inconsistent.
- 2026-08-20: Clients are explicitly NOT a CRM — name only.
- 2026-08-20: Automated day-rounding to the nearest 0.25 is deliberately
  deferred — manual adjustment only for now.
- 2026-08-20: Risk level is auto-resolved from declared sector(s) (most
  severe of however many are declared, per standard), not manually chosen.
- 2026-08-21: Traceability lives in a dedicated post-calculation report
  (Option 2), not inline next to every wizard field (Option 1) — explicit
  preference, to keep the wizard simple and dynamic during data entry.
- 2026-08-21: PDF export and a separate archival-view system are explicitly
  parked on the roadmap, not built now, per direct instruction — the
  underlying data (full input/result JSON, rounding overrides) is already
  persisted, so reconstruction is possible even without a dedicated view.
