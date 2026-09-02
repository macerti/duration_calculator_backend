# src/backend

PHP + MariaDB backend for the GS0106/IAF audit duration calculator. Single-folder
topology, deployed as-is (no build/compile step) to the `duration_calculator`
artifact repository — see the root `README.md`'s "Mandatory source/deployment
separation" section before assuming a change here is live anywhere.

## Layout

- `api/` — HTTP entry point and router (`index.php`). Reads the `basePath`
  config key to strip a deployment-subdirectory prefix — see
  `config.example.php` and BUG-030/BUG-031 in `docs/BUGLOG.md` for why this
  is explicit rather than derived from `SCRIPT_NAME`.
- `engine/` — the calculation engine. Every GS0106 formula (audit-duration,
  NAE/personnel adjustment, NACE/risk, multi-standard synergy, audit cycles,
  rounding, factors, report-writing duration, site/HQ treatment) lives here.
  See `docs/CALCULATION_RULES.md` for which file implements which rule.
- `data/` — static reference data (NACE codes, factor tables) backing the
  engine.
- `db/` — `schema.sql` plus PDO repositories (`clientRepo.php`,
  `calculationCaseRepo.php`, `parameterSetRepo.php`) for the persisted
  clients/cases/parameter-sets.
- `tests/` — `smoke_test.php` (pure engine logic, no DB/server needed) and
  `http_api_test.php` (full HTTP regression against a running server + DB).
  Kept co-located here rather than a top-level `tests/` — see
  `docs/DEV_STATUS.md`'s ninth-session entry for why.

## Running locally

```bash
cp config.example.php config.php   # fill in a local/test DB; leave basePath ''
make dev-backend                    # from repo root — php -S localhost:8000
```

Or the same thing manually from this directory: `php -S localhost:8000 -t .`.

## Testing

```bash
make test        # smoke tests + frontend typecheck, no DB required
make test-http    # full HTTP regression — needs config.php pointed at a
                   # schema-loaded, seeded DB first; see docs/DEPLOY.md
```

## Status

See `docs/DEV_STATUS.md` (current state, what's open, hand-off notes),
`docs/BUGLOG.md`, and `docs/ROADMAP.md` — this backend doesn't keep its own
copies of those logs; `src/frontend/` still does for historical reasons (see
that folder's own `BUGLOG.md`/`ROADMAP.md` headers).
