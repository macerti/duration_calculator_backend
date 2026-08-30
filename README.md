# Audit Duration Calculator — Source

All source for the GS0106/IAF audit duration calculator project. This is the
**source** repo — for the deployable artifact actually uploaded to hosting,
see [`duration_calculator`](https://github.com/macerti/duration_calculator).

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
