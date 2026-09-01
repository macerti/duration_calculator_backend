# Architecture Correction Pipeline — 2026-09-01

## Purpose

This is an active implementation brief for the **repository architecture phase**. It incorporates the external expert review into this repository's actual constraints.

This phase occurs immediately after application versioning and **before the next user-feedback acceptance gate**.

The goal is not to preserve the current repository history. The goal is to leave one clean, understandable, scalable source tree. Unnecessary historical code must be deleted, not archived.

## Required target

The exact final structure must be chosen from the actual dependency graph, but it must converge toward:

```
src/
  frontend/
  backend/
    api/
    engine/
    data/
    db/
tests/
docs/
infra/ or build/
.github/
README.md
CONTRIBUTING.md
CHANGELOG.md
RELEASES.md
Makefile (or justfile)
```

Do not create empty organizational folders. Keep names responsibility-based.

### Canonical source decisions

- **Frontend:** current active Expo/React Native implementation in `audit-mobile/` is the current functional source and should become `src/frontend/` (or an equivalent responsibility-based location).
- **PHP backend:** current deployment-source implementation in `duration-calculator-php/` is the current backend source candidate and should become `src/backend/` (or equivalent).
- **audit-app/:** obsolete parallel implementation. It must be compared against the canonical implementations for any missing behavior/business rule, then deleted if nothing unique is required.
- **audit-engine/:** obsolete Node implementation. Because the target hosting architecture is PHP/MariaDB and Node is not the deployment runtime, it must not remain as an active project tree. Delete it unless a specific unique, still-required test/rule cannot be recovered elsewhere; preserve such necessary information as a concise documentation file, not as a second application.
- Any other duplicate generated, experimental, abandoned or historical application tree follows the same rule: recover required information, then delete it.

**Do not use `legacy/` or `archive/` as a dumping ground.** A historical implementation that has no current engineering value goes to the trash. Only genuinely necessary traceability belongs in a small durable document.

## Architecture correction work packages

### A. Canonical tree and migration

1. Inspect every application tree and all CI/build/deployment references.
2. Diff the candidate frontend/backend implementations.
3. Identify the current production behavior and authoritative calculation rules.
4. Move the canonical frontend to `src/frontend/`.
5. Move the canonical PHP backend to `src/backend/`.
6. Move automated tests to a coherent `tests/` structure where practical.
7. Move durable technical/business-rule documentation to `docs/`.
8. Remove obsolete duplicate application trees after proving no required behavior remains only there.
9. Update every import, path, package script, CI reference and deployment assembly path.
10. Do not mix this with unrelated UX or calculation changes.

### B. Deployment contract

The source repository is authoritative; `macerti/duration_calculator` remains the generated deployment artifact.

The build contract must explicitly document:

- source checkout;
- frontend package/config inputs;
- PHP backend source path;
- database schema and seed inputs;
- production API URL configuration;
- exact deployment artifact topology;
- required generated files;
- forbidden files such as real `config.php` credentials;
- publication destination.

The existing `.github/workflows/build-test-publish.yml` remains the single source-owned build/publish workflow unless a later explicit decision changes this.

Add a verification step so each published artifact can be traced to the exact source commit and release/version. Use a Git tag and/or `RELEASES.md`; the traceability record must include source commit and deployment-artifact commit.

Do not hand-edit the deployment repository.

### C. Developer commands

During this architecture phase, add a single root `Makefile` or `justfile` exposing at minimum:

- `dev-backend`
- `dev-frontend`
- `test`
- `build-deploy`

The commands must call the actual project tooling. Do not create fake wrappers or duplicate build logic.

### D. CI and tests

Retain the existing MariaDB + PHP regression coverage.

After moving files:

- run PHP/backend tests;
- run HTTP API regression tests;
- run frontend TypeScript typechecking;
- add linting if the frontend has a suitable configured linter, without introducing an unnecessary tool solely for the checklist;
- fail early when required build inputs are missing or mismatched, including `config.example.php`;
- validate the generated deployment artifact topology;
- ensure the artifact is traceable to the source commit/version.

A PHP-version matrix is **conditional**: add it only if the supported PHP range is explicitly defined and the matrix provides real compatibility value. Do not create CI complexity without a defined support policy.

### E. Documentation

The architecture document must become the single structural authority.

Move detailed durable documentation under `docs/` where appropriate. Do not keep multiple competing architecture/status/readme documents.

Create/maintain:

- root `README.md` as the entry point;
- `CONTRIBUTING.md` for developer workflow;
- `REPOSITORY_ARCHITECTURE.md` as the structural contract;
- `docs/CALCULATION_RULES.md` as the authoritative calculation/business-rule reference;
- root `CHANGELOG.md` as concise release history;
- `RELEASES.md` as source-commit ↔ deployment-artifact traceability.

Large debugging diaries must not be copied into the new structure.

### F. Secrets and deployment safety

- Real credentials remain outside Git.
- GitHub Actions secrets are the only CI secret source.
- Deployment credentials/tokens must have the minimum permissions needed to publish the deployment repository.
- Feature branches must not accidentally publish production artifacts.
- The architecture work must review the workflow trigger and release/publish gate and make publication intentional.
- CI hygiene must detect committed credentials or obvious secret material.
- Required `*.example` configuration files must exist and remain credential-free.

### G. Repository hygiene

Add lightweight automated checks for:

- required `config.example.php` presence;
- absence of real credentials/secrets in tracked files;
- required README/license/documentation presence for new top-level modules;
- stale references to deleted paths such as `audit-app/` and `audit-mobile/` after migration;
- deployment package contains only intended files.

Do not add heavyweight tooling merely to satisfy a generic best-practice checklist.

## Protected business behavior

Architecture correction must preserve, byte-for-byte where applicable and behaviorally where code moves:

- audit-duration formulas;
- NAE/personnel adjustment;
- NACE/risk;
- standard parameters;
- multi-standard synergy;
- audit cycles;
- rounding;
- factors;
- report-writing duration;
- site/headquarters treatment;
- current wizard behavior;
- all established calculation constraints.

Before deleting a duplicate implementation, extract any unique business rule or test case that is not already represented in the canonical implementation.

## Definition of done

Architecture correction is complete only when a new developer can identify the active source, backend, engine, data, tests, documentation and deployment commands without interpreting historical project names.

Required evidence:

1. final tree documented;
2. duplicate trees removed where unnecessary;
3. all path/import references updated;
4. backend regression tests pass;
5. frontend typecheck/lint status recorded;
6. production build passes;
7. deployment artifact assembly passes;
8. source commit ↔ release/version ↔ artifact commit traceability exists;
9. secret/hygiene checks pass;
10. calculation regression results remain unchanged;
11. no obsolete application tree is left merely because it might be useful someday.

## Handoff to next pipeline phase

Only after this architecture phase is complete does the project enter the previously defined **user-feedback/acceptance gate**. The next developer must not start unrelated feature work before that gate unless explicitly reprioritized.
