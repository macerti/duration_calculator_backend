# Audit Duration Calculator — Source

All source for the GS0106/IAF audit duration calculator project. This is the
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
  namespace rather than a physical folder). Kept for reference/history, not
  the deployment target — see `ORIENTATIONS.md`'s decisions log for why
  both exist.
- **`audit-engine/`** — the original Node/TypeScript engine implementation,
  before the project moved to PHP (no Node.js available on the target
  DirectAdmin host). Kept for reference/history; not maintained in lockstep
  with the PHP engine going forward — see its own `BUGLOG.md`/`ROADMAP.md`
  for where it was left off.

## Project documentation

The project's own standing docs (`CHANGELOG.md`, `ROADMAP.md`, `BUGLOG.md`,
`SECURITY.md`, `TEST_CHECKLIST.md`, `ORIENTATIONS.md`, `DEPLOY.md`) live at
the root of the **deploy** repo (`duration_calculator`), since that's the
project's actual living history — this source repo doesn't duplicate them.

## Credentials

No real credentials are committed anywhere in this repo — every
`config.php`/`.env` here is a `.example` template. Copy the relevant
template and fill in real values locally; never commit the filled-in file
(already `.gitignore`d).


## Mandatory CI/build ownership

`macerti/duration_calculator_backend/.github/workflows/build-test-publish.yml` is the single source-owned pipeline. It is the only workflow that should build and publish the deployment artifact.

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

Do not add another build workflow for the same purpose. Do not manually edit generated application files in `duration_calculator`. If CI fails, record the exact failing stage in `audit-app/BUGLOG.md` and `audit-app/DEV_STATUS.md` before changing the implementation.
