# Roadmap / Planned Features — audit-mobile

> ⚠️ **Stale — not the canonical roadmap.** `docs/ROADMAP.md` is the
> actively-maintained project roadmap and priority order; this file
> predates it and has not been kept in sync (e.g. NACE search and case
> history/detail screens listed below as "not yet built" already exist —
> see `ClientsList`/`ClientDetail` screens and `duration-calculator-php/`'s
> `/nace/search` route). Kept for historical context (early design
> decisions below) rather than deleted. Flagged, not reconciled, in this
> pass — 2026-09-01 (repository architecture consolidation, step 2).

## Requested, not yet built
- [x] ~~Full Case Builder screen~~ — done in 0.2.0 (single site, multi-standard)
- [x] ~~Multi-site support in the Case Builder~~ — done in 0.3.0
- [x] ~~App name~~ — set to "Audit Duration Calculator" in 0.3.0
- [ ] Synergy/integration inputs in the UI (backend ready, not exposed yet)
- [ ] NACE sector picker wired into the Case Builder's site section (currently free-text)
- [ ] Case history screens (list/view saved dossiers via `/api/cases`) — blocked
      on nothing technically, just needs building
- [ ] Real-device/simulator test against a running `audit-engine` instance
      (only web-bundle + curl-integration tested so far, not from the actual
      Expo app UI on a device)
- [ ] App icon / splash screen branding (currently Expo defaults, name changed
      but visuals haven't)
- [ ] Extension-site toggle in the UI (engine supports it, not exposed)

## Ideas / not yet requested (parked)
- Move to an npm-workspaces monorepo with `audit-engine` so `types/engine.ts`
  isn't a manually-kept-in-sync copy (see CHANGELOG 0.1.0 design decision)
- Offline draft mode (save a case locally before submitting, for spotty connectivity
  during on-site visits)
- EAS Build config for actual iOS/Android store builds (only Expo Go / web dev so far)
- NACE sector picker screen (search-as-you-type against `/api/nace/search`)

## Decisions already made
- 2026-08-19: Expo (React Native) chosen to cover mobile + web from one codebase,
  rather than a separate React web app — confirmed working via `expo export --platform web`.
- 2026-08-19: API base URL is env-configurable (`EXPO_PUBLIC_API_URL`), not hardcoded —
  needed regardless since local dev, and later the cPanel-hosted API, are different URLs.
