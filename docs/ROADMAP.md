# CURRENT DELIVERY PRIORITY — 2026-09-01

## Mandatory pipeline

1. FEAT-003 — Versioning and update timestamp: IMMEDIATE.
2. Repository architecture consolidation: immediately after FEAT-003. Follow REPOSITORY_ARCHITECTURE.md; identify the source of truth before moving/deleting anything and preserve all formulas/business rules.
3. USER FEEDBACK / ACCEPTANCE GATE. After the first two items, pause normal feature development and perform real browser/mobile/user testing. Feed the results back into the logs to definitively close, reopen, or change the relevant bugs/features.
4. Remaining bugs. Resume only after the acceptance gate.
5. Remaining features. Resume after the acceptance gate. Admin/parameter administration UI is prioritized ahead of authentication/SSO.
6. FEAT-002 Microsoft/Google SSO: NOT PRIORITIZED. It remains documented but is explicitly deferred.

### Acceptance terminology
- USER-ACCEPTED — user confirms the behavior is satisfactory.
- REOPENED — user still observes the reported problem.
- NEW BUG — new reproducible defect.
- CHANGE REQUEST — implementation works but the desired UX/behavior changes.
- VERIFIED — technically verified but awaiting user/product acceptance where applicable.

Do not use older roadmap priority wording as the active priority. This dated decision is authoritative until explicitly replaced.

# Roadmap — audit-app

> Concurrent-development rule: read DEV_STATUS.md before starting work. It is the current hand-off ledger for verified work, open work, evidence level, and dependencies. Update it with every behavior change or test investigation.

## Active Priority Queue (P0 / P1 / P2 Framework)

> Historical completed features and closed bug resolutions have been permanently archived in:
> 📁 [docs/archive/COMPLETED_HISTORY.md](archive/COMPLETED_HISTORY.md)
>
> Priority framework defined by Product Owner:
> - **Priority 0 (P0 — Critical / Blocker)**: The app is down, critical errors, severe bugs. Fix immediately.
> - **Priority 1 (P1 — Active Tasks to Build)**: High-value improvements, active features, in-app test tooling, and non-deferred technical debt.
> - **Priority 2 (P2 — For Later)**: Items reserved for when the application matures further.

---

### Priority 0 (P0) — Critical Blockers & Errors
*No active P0 bugs remaining.*
- **BUG-031 (Production API 404)**: **CLOSED & VERIFIED on live production (2026-09-02)** by Mahdi. Live `config.php` has been corrected with `$config['basePath'] = '/duration_calculator/api';`, and endpoints are operational.

---

### Priority 1 (P1) — Active Tasks to Build Now

#### 1. In-App Guided Acceptance Test Runner & Report Exporter (NEW!)
- **Category:** User Acceptance Testing / Embedded Test Tooling
- **Status:** APPROVED / TOP IMMEDIATE TOOLING TASK
- **Objective:** Embed the acceptance test suite directly into the application rather than relying on an external static markdown checklist.
- **Features:**
  - Dedicated menu / modal to launch Guided Test Mode from Home or Settings.
  - Step-by-step interactive prompt boxes / notifications guiding the tester (e.g., "Enter headcount 50", "Add ISO 9001 and ISO 14001", "Verify Suggestion chip appears").
  - Automated state checks where possible + interactive checklist / radio questions ("Did the shake animation trigger?", "Does the annual breakdown table read clearly?").
  - One-click export of a standardized test report (JSON/Markdown) readable by human developers and AI developers to update logs without manual transcript synthesis.

#### 2. Parameter Admin UI & Dossier Reference Codification
- **Category:** Core Administration & PO Top Priority
- **Status:** ELEVATED TO P1 (Top PO Value)
- **Objective:** Web interface for administrators to inspect and edit IAF parameter tables (MD5, MD1, MD11) and factor catalogs from the browser instead of modifying PHP source code and reseeding.
- **Dossier Codification:** Configurable automatic calculation reference numbering generator (`prefix + date components + incremental counter`) auto-populating `dossierRef`.

#### 3. FEAT-001 — Synthèse Per-Site Tabs & Consolidated "Programme d'audit Client"
- **Category:** Core Calculation UX
- **Status:** P1 ACTIVE FEATURE
- **Objective:** In **Synthèse**, present dedicated tabs for each individual site's audit programme, plus a dedicated consolidated tab named **Programme d'audit Client** that calculates the global combined duration without double-counting, respecting multi-site synergy and IAF rules.

#### 4. PDF Export of Calculation Report
- **Category:** Export & Client Deliverable
- **Status:** ELEVATED TO P1
- **Objective:** Generate downloadable, print-ready PDF audit duration calculation reports directly from the Calculation Report screen data, complete with formulas, factor justifications, and audit day breakdowns.

#### 5. Authentication & SSO (Microsoft Entra ID / Google Account)
- **Category:** Security & Identity
- **Status:** P1 ARCHITECTURE & SECURITY
- **Objective:** Standard OIDC single sign-on with "Continue with Microsoft" and "Continue with Google" buttons, mapped into a secure PHP session-based user model with HttpOnly cookies.

#### 6. Technical Debt: Frontend Design Token Migration
- **Category:** Technical Debt (Do Not Defer)
- **Status:** P1 IN-PROGRESS
- **Objective:** Replace hardcoded colors, spacing, and typography across the remaining 12 screens and components (`HomeScreen`, `ClientsListScreen`, `ClientDetailScreen`, `CalculationWizardScreen`, `CalculationReportScreen`, pickers, panels) with semantic tokens from [`src/theme/tokens.ts`](../src/frontend/src/theme/tokens.ts).

#### 7. Technical Debt: Top-Level `tests/` Relocation & Frontend Unit Tests
- **Category:** Technical Debt & Quality Assurance
- **Status:** P1 TESTING DEBT
- **Objective:** Move `src/backend/tests/` to top-level `tests/backend/` and introduce automated Jest/Vitest unit tests for frontend wizard calculation state and hooks to eliminate reliance on purely manual validation.

---

### Priority 2 (P2) — For Later (Future Backlog)

- [ ] **Rate Limiting & Input Validation Bounds**: Enforce `validationBounds` (defined in IAF parameter sets) on the backend API and add IP rate limiting (`SECURITY.md` §Todo #2 & #3).
- [ ] **FEAT-004 / BUG-029: Production Web Presence & SEO**: Branded 404 page, removal of framework defaults, canonical URLs, `robots.txt`, and `sitemap.xml`.
- [ ] **Global Case List**: Browse all calculation cases across all clients in one unified list view.
- [ ] **Extension-Site Toggle in UI**: Expose the backend-supported `isExtension` toggle in the wizard site form.
- [ ] **Custom Pull-to-Refresh Animation**: Interactive stretch/bounce feedback for mobile browsers.
- [ ] **Database Backup Automation**: Automated cron backups on the DirectAdmin host.

- [ ] **Tighten allowedOrigins**: Restrict CORS origins in `config.php` to production domain once DNS/URLs are fixed.


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


## FEAT-003: Application version and last-update display

**Status: COMPLETED & ARCHIVED (5.1.0 / 5.1.1)** — Built 2026-09-01, verified live. See [COMPLETED_HISTORY.md](archive/COMPLETED_HISTORY.md) for full archive.
**Requested**: 2026-09-01


### Objective

Introduce a clear, user-visible application versioning system and display the current version and source update timestamp at the bottom of the application.

### Version format

Use semantic-style three-part versioning:

**X.Y.Z**

- **X — Major version**: significant, perceptible UI/UX overhaul or major application redesign that materially changes the user experience.
- **Y — Feature version**: addition of user-visible functionality/features.
- **Z — Bug-fix version**: fixes to existing behavior, defects, regressions, or small corrective changes that do not constitute a feature or major UI overhaul.

Examples: `1.0.0` baseline, `1.0.1` bug fix, `1.1.0` feature, `1.1.1` subsequent bug fix, `2.0.0` significant UI/UX overhaul.

### Required display

At the **bottom/footer of the application**, visibly display the current application version and latest update date/time.

Example:

**Version 1.2.3 · Updated on 31 Aug 2026 at 09h48**

The visual treatment should match the existing design system and remain unobtrusive but readable.

### Update timestamp source — IMPORTANT

The displayed **Updated on** timestamp must represent the datetime of the **last edit/change to `duration_calculator_backend`**, not the user's browser/device time and not an arbitrary manually entered date.

Establish a reliable source of truth for this value. Prefer deriving it automatically from repository/build/deployment metadata rather than hard-coding it into UI source code.

Display format: `Updated on DD Mon YYYY at HHhMM` — no seconds. Use one consistent application/deployment timezone.

### Version governance

- Maintain the version in **one authoritative location**.
- Do not hard-code different versions across multiple screens/files.
- The footer consumes the authoritative version metadata.
- Every release/change increments the appropriate component according to the X/Y/Z rules.
- Classification is based on the resulting user-visible change, not internal effort.
- A feature increments Y and resets Z.
- A bug fix increments Z.
- A significant perceptible UI overhaul increments X and resets Y/Z according to normal versioning practice.
- Preserve version history in the existing changelog/release documentation.

### Acceptance criteria

- Every application screen/page displays the same current `X.Y.Z` version in the footer.
- The footer displays the automatically maintained last-update timestamp.
- The timestamp corresponds to the latest relevant `duration_calculator_backend` edit/build/deployment metadata and is not generated from the end user's local clock.
- The displayed format matches `Updated on 31 Aug 2026 at 09h48`.
- Version and timestamp remain correct after deployment without manually editing individual screens.
- Responsive/mobile layouts remain usable.
- Build/automated verification confirms the metadata is present and consistent.
- Calculation formulas and calculation behavior are unchanged.

### Priority

This is an **immediate infrastructure/UI requirement**. Implement it before treating the current lower-priority feature backlog as complete. Establish the mechanism before subsequent releases so bug fixes, features, and major UI changes can be tracked consistently.


## FEAT-004 — Production-quality web presence, metadata, routing and SEO review

**Status: REQUESTED / DISCOVERY + IMPLEMENTATION PLAN REQUIRED — 2026-09-01**
**Priority:** After the current mandatory sequence (versioning → repository architecture → user acceptance gate).

### Objective
The application currently risks presenting itself like a development/Vite/React application rather than a deliberate production product. Review the supplied production-quality requirements against the actual architecture and implement only what is technically appropriate and useful. Do not apply a generic SEO checklist blindly.

### Required review matrix

Classify every item as APPLICABLE / NOT APPLICABLE / CONDITIONAL before implementation:

- **Custom domain:** deployment concern. Confirm the intended production hostname; use it consistently for canonical URLs, metadata, redirects and deployment documentation. Do not invent a second domain.
- **Proper page source / crawlable HTML:** inspect generated HTML/source. Public content may need crawlable HTML; the private/stateful wizard does not automatically justify SSR solely for SEO.
- **Custom 404:** applicable. Invalid public routes must produce a branded 404 rather than a misleading successful application page.
- **Unique page titles:** applicable to meaningful public routes/screens. Wizard states should have sensible document titles without becoming artificial SEO pages.
- **Meta descriptions:** applicable to public/indexable pages; conditional for private wizard states.
- **Canonical tags:** applicable to public/indexable URLs. Establish one deliberate canonical production URL per public page.
- **One clear H1:** applicable to meaningful pages. Do not mechanically add duplicate H1s to wizard subviews.
- **sitemap.xml:** conditional. Include only intentionally public/indexable URLs; never client records, saved calculations, drafts or ephemeral wizard states.
- **robots.txt:** applicable. Define an intentional crawl policy and reference the sitemap if one exists.
- **llms.txt:** optional/conditional. It is a community proposal/convention, not a Google Search requirement. Implement only if useful for public agent-readable information, otherwise document why it is not needed.
- **Favicon:** applicable. Remove framework/default identity.
- **Internal links:** applicable to public navigation/content; do not create artificial SEO links inside the calculation workflow.
- **Breadcrumbs:** already partly implemented. Preserve the established wizard breadcrumb and icon-based Accueil convention; extend only where meaningful.
- **Structured data:** conditional. Use only schema types accurately describing real visible content.
- **LocalBusiness schema:** conditional. Use only if the public application/site represents the actual Macerti business and the address/contact identity is verified and visible.
- **Social share images:** applicable to public/shareable pages; conditional for private wizard states.
- **Image alt text:** applicable. Audit meaningful images for accurate accessible alternatives and mark decorative images appropriately.
- **Console errors:** applicable. Audit the real production browser and fix actual application errors/warnings; never solve this by suppressing logging.
- **Production source maps:** review/security concern. Determine whether public source maps are exposed and remove them unless there is an explicit operational reason.
- **Large JavaScript bundles:** applicable as a measured performance audit. Measure first; split/lazy-load only where justified.
- **Vite/React/default branding:** applicable. Remove framework/development identity from titles, favicon, metadata, visible content and generated HTML where unintended.
- **Placeholder content:** applicable. Audit production-visible text/assets for demo or developer placeholders.

### Critical routing question — wizard URL strategy
The application currently behaves as a stateful wizard where phases do not necessarily change URL/slug. **Do not automatically convert every wizard phase into a URL.**

The developer must determine:

1. Private/stateful calculation workflow screens can appropriately remain within one application route; exposing ephemeral state in indexable URLs is not inherently beneficial.
2. Public, meaningful, shareable pages should have stable URLs and may use browser History API/router navigation.
3. If routes are introduced, direct loading, refresh, browser back/forward, persistence, authorization and server fallback must all work.
4. Never put client IDs, calculation data, draft state or sensitive parameters into URLs.
5. Do not make ephemeral wizard states indexable merely because they have URLs.
6. If the SPA uses History API navigation, use it deliberately for meaningful navigation, deep links, back/forward behavior and analytics rather than adding routes solely for SEO. Google documents History API navigation for SPA screen changes. citeturn0search8

### Public vs private indexing boundary
Define explicitly:

**Public/indexable surface:** brand, product/service information, help/documentation and other content intentionally intended for discovery.

**Application/private surface:** client list, client details, calculation wizard, saved calculations and sensitive/ephemeral data. These must not be placed in the public sitemap or exposed to crawlers merely to satisfy an SEO checklist.

Canonical URLs are a preference signal, not a substitute for coherent URL architecture. citeturn0search0

### Acceptance criteria
- No unintended Vite/React/framework-default identity remains in production UI, HTML title, favicon or metadata.
- Branded 404 exists and invalid public URLs behave correctly.
- Public pages have deliberate titles, descriptions, canonical URLs and appropriate headings.
- robots.txt has an intentional policy; private application routes are not accidentally advertised as indexable content.
- sitemap.xml contains only intentionally public/indexable URLs.
- llms.txt is either implemented accurately or explicitly rejected with a documented rationale.
- Breadcrumbs remain consistent with the existing wizard navigation design.
- Structured data is accurate and validated where used.
- Public social metadata/images and image accessibility are correct.
- Production browser console is clean of application errors.
- Public production source maps are not exposed without a documented reason.
- Production JavaScript bundle size is measured and optimization is evidence-based.
- No placeholder/development content remains.
- Routing strategy is documented and tested for direct load, refresh, back/forward and invalid routes where applicable.
- No calculation formulas, business rules or sensitive application data change as a side effect.

### References
Google documents canonical URLs as a preference signal and robots.txt sitemap declarations. citeturn0search0turn0search13 The llms.txt specification is a community proposal; Google states it is not required for Search. citeturn0search1turn0search2
