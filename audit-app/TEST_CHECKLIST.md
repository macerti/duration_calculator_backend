# Test Checklist — Audit Duration Calculator

How to use this file: work through each numbered scenario, mark it ✅ (pass),
❌ (fail — describe what happened), or ⏭️ (skipped, note why). When you're
done with a pass, add an entry to **Test History** at the bottom with the
version tested, the date, and anything that failed. Don't overwrite old
history entries — this file's value grows the longer that log gets, since it
lets us see *when* something broke or got fixed, not just whether it
currently works.

Each scenario has a stable **ID** (e.g. `CLI-01`) — reference these IDs in
bug reports and in the history log so we can track a specific scenario's
pass/fail across versions over time.

---

## 1. Connectivity & Home

- **HOME-01**: Open the app fresh. A small status indicator (dot + text)
  appears near the top, not a large card. It shows "Connecté" (or similar)
  within a couple seconds.
- **HOME-02**: Tap the status indicator. It re-checks and updates.
- **HOME-03**: One primary button, "Mes clients" — no separate "NAE
  Calculator"/"Case Calculator" buttons.

## 2. Client management (CRUD + undo)

- **CLI-01**: Tap "Mes clients". Empty state shows helpful text if you have
  no clients yet.
- **CLI-02**: Tap "+ Nouveau client", leave the name blank, tap "Créer".
  The input field **shakes** and a red label appears: "Le nom du client est
  obligatoire." No client is created.
- **CLI-03**: Type a name, tap "Créer". You land on that client's detail
  page. The client now appears in the clients list.
- **CLI-04**: On a client's detail page, tap the pencil icon next to the
  name, change it, save. The new name shows immediately and persists after
  navigating away and back.
- **CLI-05**: On the clients list, tap the trash icon next to a client. The
  client **disappears immediately** — no confirmation dialog. A toast
  appears at the **bottom** of the screen with "Annuler" and a visibly
  **depleting** progress bar.
- **CLI-06**: Repeat CLI-05, but tap "Annuler" before the bar empties. The
  client **reappears** in the list.
- **CLI-07**: Repeat CLI-05, let the bar run out fully (~30s) without
  tapping Annuler. Refresh the list — the client is genuinely gone.
- **CLI-08**: Delete a client that has existing calculations (CLI-07-style,
  let it expire). Its calculations are **not** deleted — check via the
  database or by noting the total calculation count elsewhere didn't drop.

## 3. Calculations list per client (CRUD + undo)

- **CASE-01**: On a client's detail page, tap "+ Nouveau calcul" — lands in
  the wizard, Step 1.
- **CASE-02**: After saving a calculation (see Section 7), it appears in
  the client's calculation list with a status badge (Brouillon/Calculé/
  Validé) and the total days shown.
- **CASE-03**: Tap the trash icon on a saved calculation. Same
  immediate-removal + undo-toast behavior as CLI-05/06/07.
- **CASE-04**: Tap a saved calculation (not its trash icon). It opens back
  into the wizard, landing on the **Récapitulatif** step with the saved
  results shown.

## 4. Wizard Step 1 — Sites & Secteurs

- **SITE-01**: Type a partial sector name **without** accents, e.g.
  "telecom". Results including "Télécommunication" appear.
- **SITE-02**: Search a number, e.g. "39". Results include sectors whose
  **NACE or EAC code** contains that number, not just description matches.
- **SITE-03**: Select a sector. It appears as a chip with both its NACE and
  EAC code shown.
- **SITE-04**: Select a **second** sector for the same site. Both appear.
  There is **no hard limit of 2** — try adding a third if you have a
  real-world case that needs it.
- **SITE-05**: With 2+ sectors selected and at least one standard active, a
  "risque retenu" summary appears per standard — confirm it shows the more
  severe of the sectors' risk levels for each standard (you may need to
  pick sectors you know have different risk levels per standard to verify
  this meaningfully).
- **SITE-06**: Select multiple standards (ISO9001, ISO45001, ISO14001) as
  chips for one site.
- **SITE-07**: Add a second site ("+ Ajouter un site"). Give it a different
  name, different sector(s), different standards.
- **SITE-08**: Remove a site (when 2+ exist). Confirm the remaining site's
  data is untouched.
- **SITE-09**: Try to continue to the next step with a site missing a
  sector or a standard — the "Continuer" button is disabled with an
  explanatory hint.

## 5. Wizard Step 2 — Effectif (NAE)

- **NAE-01**: Enter a total headcount. The next question (indirect) appears
  immediately below — no need to scroll to a separate section.
- **NAE-02**: Enter indirect headcount. The next question names the exact
  remaining count: "Parmi les X personnes restantes (fonction directe),
  combien..."
- **NAE-03**: Enter non-posté headcount. If people remain, the shift-team
  section appears, again naming the exact remaining count.
- **NAE-04**: Fill the first shift team's headcount. If people still
  remain unattributed, a **second shift row appears automatically** — you
  should never need to tap an "add shift" button mid-flow.
- **NAE-05**: Keep filling shifts until the remaining count hits zero — no
  further rows should appear once fully attributed.
- **NAE-06 (the contradiction bug)**: With 2+ sites, deliberately leave one
  site's headcount mismatched (e.g. 5 people unaccounted for) while the
  *other* site's is correct. Switch to the correctly-filled site's tab —
  it should **not** show a red "incomplete" message contradicting a green
  "correct" one. Instead, expect a clear blue message like: 'L'effectif de
  "X" est complet. L'effectif de "Y" doit encore être renseigné.' and the
  primary button should read "Aller à l'effectif de Y" — tapping it should
  jump you straight to that site's personnel tab.
- **NAE-07**: Fix the mismatched site so all sites validate. The button
  reverts to "Continuer vers les facteurs" and becomes enabled.
- **NAE-08 (data-loss regression check)**: Fill in Step 2 partially, switch
  to Step 1 via the step tabs (not the Retour button), then switch back to
  Step 2. Your entered data must still be there. Repeat switching rapidly
  (tap Step 1, immediately tap Step 2, immediately type something) a few
  times — data should never silently vanish or get overwritten.

## 6. Wizard Step 3 — Facteurs

- **FAC-01**: With only 1 active standard on a site, no "Synergie" panel
  appears.
- **FAC-02**: With 2+ active standards on the same site, a "Synergie /
  Intégration" panel appears. Toggle it on, pick an integration level, add
  at least one auditor with a qualification count.
- **FAC-03**: Tick a few augmentation and reduction factors for one
  standard. Switch to a different standard (same site) via its panel —
  confirm the factors you just ticked did **not** carry over to the other
  standard (each standard's factors are independent).
- **FAC-04**: With 2+ sites, tick factors for the Siège specifically (not a
  regular site) — confirm at the Récap/Report stage that the siège's
  factor percentage is reflected in its own total, distinctly from any
  other site's.
- **FAC-05**: Leave justification text blank for a standard with factors
  ticked — proceed anyway (this only warns, doesn't block) and confirm the
  report later shows "— non renseignée —" for that standard.
- **FAC-06**: Fill in justification text — confirm it appears verbatim in
  the report later.

## 7. Wizard Step 4 — Récapitulatif

- **REC-01**: Tap "Calculer" from Step 3. Results appear grouped visually
  by year — "Visite initiale" as one bordered block (Étape 1, Étape 2,
  Rédaction du rapport), then a separate bordered block per surveillance
  year. The grouping should be immediately obvious at a glance, not just a
  small text label.
- **REC-02**: Each duration line shows a small gray "suggestion : X j" hint
  when the calculated value isn't already a clean quarter-day. Tapping the
  suggestion applies it as the new value.
- **REC-03**: Manually adjust a value with the +/− stepper. The line shows
  "(ajusté manuellement)" and a reset icon (↺) appears — tapping it
  restores the original calculated value.
- **REC-04**: The final total at the bottom updates live as you adjust
  individual values.
- **REC-05**: Tap "📄 Voir le rapport de calcul complet" — opens the full
  report (see Section 8).
- **REC-06**: Tap "Enregistrer". A success toast appears. Go back to the
  client's calculation list — the calculation is there with the correct
  status and total.

## 8. Calculation Report

- **RPT-01**: NAE section shows the actual numeric substitution for the
  shift-team aggregation, e.g. "50 (équipe clé) + √50 (somme des autres
  équipes) = 50 + 7.071 = 57.071 → 58 NAE" — not just a formula shape with
  no numbers.
- **RPT-02**: Risk/base-duration section shows the actual resolved risk
  level by name, and the real numeric substitution for the stage
  coefficient (e.g. "10 j (base) × 1.000 (coefficient d'étape 'Initial') =
  10.000 j").
- **RPT-03**: Factors section lists each ticked factor by its **real
  label** (not "Facteur #3"), with its percentage and the justification
  text.
- **RPT-04**: If synergy was configured, its section shows the capacity
  percentage and the resulting reduction.
- **RPT-05**: Programme d'audit section is grouped by year with the same
  visual separation as the Récap step.
- **RPT-06**: Sector section shows both NACE and EAC codes.

## 9. Navigation

- **NAV-01**: In the wizard, the home affordance is a small **icon**, not
  an emoji, and sits at the **start** of the breadcrumb row (before
  "Clients"), not isolated on the opposite side.
- **NAV-02**: From deep in the wizard, tap the home icon — lands cleanly on
  Home.
- **NAV-03**: From the wizard, tap "Clients" in the breadcrumb — lands on
  the clients list. Now check the **browser/native back button** — it
  should go to Home, not back into the wizard screen you just left (this
  was a real bug — confirm it stays fixed).
- **NAV-04**: Same check one level deeper: from the wizard, tap the client
  name in the breadcrumb — lands on that client's detail page. Back button
  from there should go to the clients list, not back into the wizard.
- **NAV-05**: Every wizard step is directly clickable in the step tabs once
  unlocked (not just reachable via Next/Retour) — clicking a step tab
  never loses previously entered data (see NAE-08 above, same principle
  applies to Step 3/4 too).

## 10. Responsive layout

- **RESP-01**: On a narrow/mobile-width window, the wizard's step
  navigation is a **bottom-fixed** tab bar.
- **RESP-02**: On a wide/desktop-width window, the step navigation moves
  to a **top row** instead, and content doesn't stretch edge-to-edge —
  text and cards stay a reasonable reading width, centered.
- **RESP-03**: The clients list shows **2 columns** at desktop width, 1
  column on mobile.
- **RESP-04**: Resize the browser window across the mobile/tablet/desktop
  breakpoints while on any screen — layout should adapt without anything
  visually breaking (overlapping text, cut-off buttons).

## 11. Data persistence & backward compatibility

- **DATA-01 (the blank-page bug)**: Open a calculation that was saved
  before this version, if you have one from before this fix. It should
  open normally — showing the Récap with whatever data it has — **not** a
  blank white page.
- **DATA-02**: If anything ever *does* crash while you're using the app,
  confirm you see an actual error screen ("Un problème est survenu...")
  with a "Retour à l'accueil" button — never a silent blank page. If you
  ever see a truly blank page again, that's a real bug — please report
  exactly what you did right before it happened.

## 12. Toast system

- **TOAST-01**: Simple toasts (save confirmations, error messages) appear
  and auto-dismiss after a few seconds, positioned near the **bottom** of
  the screen.
- **TOAST-02**: Undo toasts (delete actions) show the depleting progress
  bar clearly, and don't visually overlap with the wizard's bottom step
  tabs when both could theoretically be on screen.
- **TOAST-03**: Trigger multiple toasts in quick succession (e.g. delete
  two clients back to back) — they should stack sensibly, not overlap
  illegibly.

## 13. Security spot-checks (things you can verify yourself, no dev tools needed)

- **SEC-01**: Visit `https://tools.macerti.com/duration_calculator/db/schema.sql`
  directly in a browser. Expect a **403 Forbidden**, never the raw file.
- **SEC-02**: Visit `.../data/raw/nace_risque_table.csv` directly. Same —
  expect 403.
- **SEC-03**: Visit `.../config.php` directly. Since PHP executes rather
  than serves this file's text, you should see a blank page or a redirect
  — never the file's actual PHP source or your DB password in plain text.
- **SEC-04**: If you ever get an unexpected error from the app, check that
  the on-screen message is generic (not a raw PHP error mentioning file
  paths or database details) — if you ever see a raw technical error
  message on screen, that's a regression worth reporting immediately.

---

## Test History

Append a new entry each time you work through a pass. Don't edit or delete
old entries — this is the whole point of the log.

### Template for new entries

```
### vX.Y.Z — YYYY-MM-DD
Tested by:
Sections covered:
Failures: <list scenario IDs and what happened, or "none">
Notes:
```

### v4.0.0 — not yet tested by Mahdi as of this checklist's creation

This checklist was created alongside v4.0.0. No test pass has been logged
against it yet — the first real entry above should be the first time this
checklist gets used.
