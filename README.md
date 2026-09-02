# Audit Duration Calculator — Source Repository

> **Repository identity:** this repository was intentionally renamed from `duration_calculator_source` to `duration_calculator_source`. The new name is deliberate: this repository contains the authoritative application source, while `duration_calculator` is the deployable artifact repository.


GS0106 / IAF MD5 / MD1 / MD11 audit duration calculation tool — a rebuild of
`LSP0301_Outil_de_calcul.xlsm`, built to run as a free tool on your website
via DirectAdmin shared hosting: **PHP + MariaDB backend, React (Expo)
frontend built to static files.** No Node.js runtime needed on the server.

**Both pieces are required — this is not one file.** The frontend
(`audit-mobile/`) is only forms and display; every GS0106 formula lives in
the backend (`duration-calculator-php/`).

**Why PHP**: this started as Node/TypeScript (see
`docs/archive/audit-engine-abandoned-node-engine/`). Once it was confirmed
the target DirectAdmin host has no Node.js Selector, the engine was ported
to PHP — same formulas, same worked examples, verified against the same
test cases. PHP + MySQL/MariaDB is close to universally available on shared
hosting.

All source for the project lives here. This is the


**source** repo — for the deployable artifact actually uploaded to hosting,
see [`duration_calculator`](https://github.com/macerti/duration_calculator).



## Mandatory source/deployment separation

**This repository is the SOURCE repository. It is never the deployable artifact.**

- All application source changes MUST be made and reviewed here first.
- After a source change is tested, the developer MUST build/package the deployable artifact and publish the resulting deploy files to the separate repository **macerti/duration_calculator**.
- The duration_calculator repository is the deployment artifact / production mirror. Hosting deployment is driven from that repository, not from this source repository.
- For the PHP backend, build means producing the deploy-ready single-folder PHP tree from duration-calculator-php/; there is no PHP compilation step.
- For audit-mobile/, build means running the configured Expo web export and publishing the resulting static files. A source-only frontend change is NOT deployed until its generated web artifact has been published to duration_calculator.
- Never hand-edit only the deployment repository to fix application behavior. If the source repository is not updated, the deployment change is invalid and will be overwritten by the next build.
- Every development hand-off MUST state both source commit and deployment-artifact commit, or explicitly state that deployment has not yet happened.
- A task is not deployed merely because source code was committed. Deployment is complete only when the corresponding artifact exists in duration_calculator and its deployment workflow has been run/passed where applicable.

## Layout

- **`audit-mobile/`** — the actual frontend source of truth. Expo/React
  Native app (works on iOS, Android, and web from one codebase). This is
  what gets built (`npx expo export --platform web`) to produce the static
  files that ship inside the deploy repo.
- **`duration-calculator-php/`** — the PHP + MariaDB backend source, exactly
  as deployed (single-folder topology: `engine/`, `data/`, `db/`, `api/`).
  This is what the deploy repo's backend portion is built from — for PHP
  there's no separate build step, so this content is closer to
  copy-verbatim than `audit-mobile/` is.
- **`audit-app/`** — an earlier two-folder-topology version of the PHP
  backend (`backend/public/` as its own doc root, `/api/...` as a URL
  namespace rather than a physical folder), plus an earlier version of the
  frontend. Kept for reference/history, not the deployment target — see
  `docs/ORIENTATIONS.md`'s decisions log for why both exist. **Note as of
  2026-09-01 (repository architecture consolidation, step 2)**: this
  folder now contains only that historical code. The project's active
  living docs that used to live here (`BUGLOG.md`, `DEV_STATUS.md`,
  `ROADMAP.md`, `ORIENTATIONS.md`, `TEST_CHECKLIST.md`, `DEPLOY.md`) have
  moved to `docs/`, and `SECURITY.md`/`CHANGELOG.md` have moved to the
  repo root, per `REPOSITORY_ARCHITECTURE.md`.
- Historical/abandoned implementations have been archived under
  `docs/archive/` rather than kept as active-looking top-level folders —
  e.g. the original Node/TypeScript engine implementation (before the
  project moved to PHP) now lives at
  `docs/archive/audit-engine-abandoned-node-engine/`.

## Quick start (local testing before deploying)

**Backend:**
```bash
cd duration-calculator-php
cp config.example.php config.php   # edit config.php with your DB credentials
php -S localhost:8000 -t .
```

**Frontend:**
```bash
cd audit-mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo export --platform web --clear
# static site is now in audit-mobile/dist/
```

⚠️ Always pass `--clear` when rebuilding with a *different*
`EXPO_PUBLIC_API_URL` — Metro's bundler cache will otherwise silently reuse
a stale build with the old URL baked in; see `docs/BUGLOG.md`.

See `docs/DEPLOY.md` for the actual DirectAdmin deployment steps.

## Project documentation

The project's active living docs (`docs/BUGLOG.md`, `docs/DEV_STATUS.md`,
`docs/ROADMAP.md`, `docs/ORIENTATIONS.md`, `docs/TEST_CHECKLIST.md`,
`docs/DEPLOY.md`, plus `SECURITY.md` and `CHANGELOG.md` at the repo root)
live in **this** source repo, since this is where the actual development
work and hand-offs happen. **Open question, not resolved by this move**:
an earlier version of this README claimed these docs lived in the
**deploy** repo (`duration_calculator`) instead — that was not true of the
files actually being maintained (they've always been committed here).
Whether `duration_calculator` should also mirror a copy is a policy
decision for the team, not something this structural move decided.

## Credentials

No real credentials are committed anywhere in this repo — every
`config.php`/`.env` here is a `.example` template. Copy the relevant
template and fill in real values locally; never commit the filled-in file
(already `.gitignore`d).


## Mandatory CI/build ownership

`macerti/duration_calculator_source/.github/workflows/build-test-publish.yml` is the single source-owned pipeline. It is the only workflow that should build and publish the deployment artifact.

The pipeline:
1. creates a disposable MariaDB test service;
2. verifies MariaDB and PHP/PDO connectivity;
3. imports schema and seed data;
4. runs PHP and HTTP API regression tests;
5. installs and typechecks the Expo source;
6. builds the web artifact with the production API URL;
7. assembles the deployment tree;
8. publishes it to `macerti/duration_calculator`.

The deployment repository's existing FTP workflow remains separate and must not be modified as part of source CI changes.

Do not add another build workflow for the same purpose. Do not manually edit generated application files in `duration_calculator`. If CI fails, record the exact failing stage in `docs/BUGLOG.md` and `docs/DEV_STATUS.md` before changing the implementation.


## Repository naming and source/deployment boundary

The rename from `duration_calculator_backend` to `duration_calculator_source` is intentional and must be preserved. The word `backend` was misleading because this repository contains both the frontend source and PHP backend source. `duration_calculator` remains the deployment artifact repository.

## Current architecture phase

The immediate architecture phase is governed by `ARCHITECTURE_CORRECTION.md` and `REPOSITORY_ARCHITECTURE.md`. It requires one canonical source tree, deletion of unnecessary historical application trees, an explicit deployment contract, reproducible developer commands, stronger CI hygiene, and source-to-artifact release traceability. Do not archive obsolete code merely for comfort; recover any required business rules/tests, document necessary decisions, then delete the redundant implementation.

## Repository maintenance

The repository structure is being consolidated to remove duplicated historical application trees and establish one clear source of truth. See **REPOSITORY_ARCHITECTURE.md** for the mandatory organization, cleanup, business-rule preservation, CI/CD safety, and documentation requirements.
