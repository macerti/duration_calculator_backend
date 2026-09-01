# Roadmap — audit-app

> Concurrent-development rule: read DEV_STATUS.md before starting work. It is the current hand-off ledger for verified work, open work, evidence level, and dependencies. Update it with every behavior change or test investigation.

## Active investigations — 2026-08-31
- [ ] BUG-004 initial draft-save failure: exact minimal mount payload was tested directly against POST /cases and returned HTTP 201 with the expected calculation. Payload shape is therefore not a proven cause. The missing retry and swallowed .catch() remain a real robustness defect. Production-triggering condition is not identified.
- [ ] BUG-004 Enregistrer PUT: not yet tested. Do not assume the PUT failure shares the POST failure's cause.
- [ ] NACE 404 under PHP built-in server: GET /nace/search?q=... and GET /nace/:code returned 404. Path-stripping is suspected, but dev-server-only vs real regression is not classified. Capture SCRIPT_NAME and REQUEST_URI before changing routing.
- [ ] Concurrent status ledger adoption: all future work streams should record exact tests, environment, evidence level, and dependencies in DEV_STATUS.md.


## Requested, not yet built
- [x] ~~Persistent wizard state (auto-save on create + continuous save +
      full hydration on reopen)~~ — done in 5.0.0, verified live
- [x] ~~Synergy: checkbox-derived Basique/Élevé + auditor×standard
      matrix~~ — done in 5.0.0, built after re-verifying against the spec
- [x] ~~Per-line factor percent editing~~ — done in 5.0.0
- [x] ~~Live running factor totals with cap-exceeded display~~ — done in
      5.0.0
- [x] ~~Unlimited justified "Autre" entries~~ — done in 5.0.0
- [x] ~~Per-standard risk override~~ — done in 5.0.0
- [x] ~~Sub-tabs per standard (Facteurs, Synthèse)~~ — done in 5.0.0
- [x] ~~Rename Récap → Synthèse~~ — done in 5.0.0
- [x] ~~Site/Siège labeling (fixed label + editable name + address +
      auto-renumbering + building icon)~~ — done in 5.0.0
- [x] ~~NACE search by technical code (Code_QM_Qualite/OH/EM)~~ — done in
      5.0.0
- [x] ~~Browse-all-sectors checkbox modal~~ — done in 5.0.0
- [x] ~~Client delete cascades to its calculations~~ — done in 5.0.0
      (explicit reversal of the 4.0.0 SET-NULL decision, see decisions log)
- [x] ~~Home breadcrumb missing on clients list / client detail~~ — done
      in 5.0.0
- [x] ~~Sampling toggle rule re-verification~~ — done in 5.0.0, confirmed
      correct as already built, no change needed

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
  instead of editing PHP source + reseeding). Should also include: **dossier
  reference codification** — let the admin configure a numbering scheme
  (prefix and/or suffix, an incremental counter, and date-based components)
  so a new calculation's reference is generated automatically from that
  scheme rather than typed freehand each time. The generated value is what
  shows as "the calculation's number" throughout the app (client detail
  list, breadcrumbs, the report) — same role `dossierRef` already plays,
  just auto-populated from a configurable pattern instead of manual entry.
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
- 2026-08-30: **Reversed** the 2026-08-20/4.0.0 decision that client delete
  orphans calculations (`SET NULL`) — now cascades (`CASCADE`), deleting a
  client deletes its calculations too, per explicit instruction. Risk level
  auto-resolution (previous line) is unaffected — this is purely about
  what happens on client deletion.
- 2026-08-30: Risk level auto-resolution now has an explicit per-calculation
  override — the auto-resolved value is still the default and still shown,
  but can be changed for one specific calculation without touching the
  underlying sector data.
- 2026-08-30: Two GitHub repos track this project: `duration_calculator`
  (deploy artifact — what's actually uploaded to hosting) and
  `duration_calculator_backend` (all source — every project this effort has
  produced). An existing CI/CD workflow in the deploy repo (FTP deploy on
  push, PHP tests gating it, GitHub Secrets for credentials) was found
  already in place, inspected for safety, and preserved rather than
  overwritten.


## Mandatory source/deployment separation

**SOURCE REPOSITORY RULE:** this repository is the source of truth and is never the deployable artifact. Every application change must be made here first, tested here, then built/packaged and published to **macerti/duration_calculator**. For PHP, the deployable tree is produced from duration-calculator-php/ (no compilation). For audit-mobile, the deployable frontend is the generated Expo web export; source-only frontend changes are not deployed until the generated artifact is published to duration_calculator. Never fix application behavior only in the deployment repository. Every hand-off must record the source commit and deployment-artifact commit, or explicitly state that deployment is pending. A task is not deployed until the corresponding artifact exists in duration_calculator and its deployment workflow has been run/passed where applicable.


## Requested feature — FEAT-001: Synthèse tabs for per-site programmes and Programme d'audit Client

**Status: NOT BUILT / REQUESTED — 2026-09-01**

- In **Synthèse**, use tabs to display the audit programme for each individual site.
- Include a dedicated tab named exactly **Programme d'audit Client** for the final consolidated client audit programme, combining the applicable sites.
- The consolidated client view and the individual site views must both remain accessible; the global tab must not replace the per-site programmes.
- Each site tab must show its complete programme and relevant duration details for that site.
- The **Programme d'audit Client** tab must show the final client-level programme with the applicable site durations combined, without double-counting.
- Multi-standard sites must retain their standard-specific duration/programme breakdown in the appropriate context.
- The consolidated view must reconcile with the underlying per-site calculation results and existing synergy/calculation rules.
- This feature must integrate with BUG-025/BUG-027: standard selection and site selection must remain correctly scoped, with no state leakage between sites or standards.
- This is a Synthèse/presentation feature. Existing calculation formulas must not be changed unless a separate calculation defect is identified and logged.

## Requested feature — FEAT-002: Sign in with Microsoft or Google (SSO)

**Status: NOT BUILT / REQUESTED — 2026-09-01**

### Objective
Allow users to authenticate without creating or remembering a separate application password by offering two standard identity-provider options on the login screen:

- **Continue with Microsoft** — Microsoft account / Microsoft Entra ID SSO, using the identity platform appropriate to the application's target users.
- **Continue with Google** — Google account sign-in.

The user chooses whichever identity provider is most convenient for them.

### Required behavior
- Present both providers clearly on the login screen using their official provider identity/branding conventions.
- Use standard OpenID Connect (OIDC) authentication and the provider-supported secure authorization flow; do not implement password/token handling manually in the frontend.
- After successful provider authentication, the backend creates or resumes the application's own authenticated session.
- The application must maintain its own user record and authorization model. A provider identity is an authentication mechanism, not the application's authorization model.
- Store the minimum identity information required, such as provider, provider subject/unique identifier, verified email where available, display name, and timestamps.
- Do not store Microsoft or Google passwords, provider access tokens, or unnecessary provider data in the application's database.
- If the same verified email already has an application account, the implementation must have an explicit and secure account-linking policy rather than silently creating a duplicate user.
- Logout must terminate the application's session and handle provider logout/session behavior appropriately without assuming that logging out of this application should log the user out of their entire Microsoft/Google account.
- Protected API endpoints must continue to enforce the application's authenticated session/authorization checks regardless of which provider was used.
- The authentication flow must work on mobile and desktop browsers.
- Redirect URIs, client IDs/secrets, provider configuration, and other credentials must be environment/server configuration, never hard-coded or committed to Git.

### Security requirements
- Prefer provider-supported authentication libraries/SDKs rather than hand-rolling OAuth/OIDC requests and token validation. Microsoft recommends authentication libraries for Microsoft identity flows. citeturn0search1turn0search4
- Use authorization code flow with appropriate PKCE/OIDC protections for the application type. citeturn0search3
- Validate issuer, audience/client ID, signature, nonce/state, expiration, and relevant provider identity claims before establishing the local session.
- Apply CSRF/state protection to the login initiation/callback flow and preserve the existing session security requirements.
- Use secure, HttpOnly, SameSite-appropriate session cookies and regenerate the session ID after successful authentication.
- Rate-limit authentication endpoints and log security-relevant authentication events without logging tokens or sensitive credentials.
- Request only the minimum scopes needed for authentication/profile identification. Microsoft explicitly recommends least-privilege permissions. citeturn0search2

### Account model / migration constraint
The current security roadmap already identifies authentication as the highest-priority security gap and proposes a PHP session-based local authentication model. This SSO feature must be designed as part of that authentication architecture, not as a separate parallel authentication system. The final implementation should support provider identities through the same user/authorization model and should not create duplicate session or authorization mechanisms.

### Acceptance criteria
- Login screen offers **Continue with Microsoft** and **Continue with Google**.
- A user can authenticate successfully with either provider and reaches the same authenticated application experience.
- Existing/new users are mapped to one application account according to an explicit account-linking rule.
- No provider password is ever received or stored by the application.
- Protected API routes reject unauthenticated requests regardless of provider.
- Mobile and desktop sign-in flows work with correct registered redirect URIs.
- Invalid, expired, replayed, or mismatched authentication responses do not create a session.
- Provider secrets are supplied through secure environment/server configuration.
- Automated tests cover successful sign-in, callback validation failure, duplicate-account/linking behavior, logout, and protected API access.

### Provider references
- Microsoft identity platform supports OAuth 2.0/OIDC and SSO scenarios. citeturn0search0turn0search5
- Google Sign-In uses Google Identity Services and OpenID Connect. citeturn0search6
