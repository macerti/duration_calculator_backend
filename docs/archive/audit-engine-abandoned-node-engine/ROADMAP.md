# Roadmap / Planned Features

Running backlog. Items move to `CHANGELOG.md` under a `y` bump once shipped,
and get struck through here (kept for history, not deleted).

## Requested, not yet built
- [ ] React Native (Expo) mobile app (chosen mobile stack, per 2026-08-18 decision)
- [ ] React web app (works in browser, shares logic/types with mobile where possible)
- [x] ~~Persistence layer for `ParameterSet`~~ — done in 1.0.0 (MariaDB/MySQL, JSON-blob storage)
- [ ] Auth (not yet specced — who are the roles: auditor / technical back office / accreditation manager?)
- [ ] Per-standard "Tableau synthèse" rollup endpoint (cross-site aggregation view)
- [ ] Quotation/pricing tool rebuild (second half of the original ask — after the duration
      engine is solid)
- [ ] Confirm whether cPanel host has "Setup Node.js App" (Node.js Selector) — Mahdi checking;
      `DEPLOY.md` has a fallback path documented either way

## Ideas / not yet requested (parked)
- Admin UI for editing factor catalogue / synergy grid / IAF tables without touching CSVs
- Versioned parameter sets with changelog per version (structure already supports multiple
  `ParameterSet`s via `id`/`version` — just needs a store + admin surface)
- Export a filled calculation case to PDF/Word (mirrors the original workbook's printable report)
- Audit trail / history of calculations per dossier

## Decisions already made (context for future y-bumps)
- 2026-08-18: Backend engine + API first, before any UI (Mahdi's explicit priority pick)
- 2026-08-18: Mobile = React Native (Expo) from the start, not web-first
- 2026-08-18: Backend stack = Node/TypeScript (chosen for shared types with React frontend)
- 2026-08-18: Deployment target confirmed = cPanel shared hosting + MariaDB. Build locally,
  deploy via cPanel. Node.js Selector availability unconfirmed — designed to work either way.
