# Architecture Correction Pipeline — 2026-09-01

> **Status update — 2026-09-02**: the physical migration this document requires (`audit-mobile/` → `src/frontend/`, `duration-calculator-php/` → `src/backend/{api,engine,data,db}`, plus the root `Makefile`/`CONTRIBUTING.md`/`RELEASES.md`/`docs/CALCULATION_RULES.md` this phase calls for) is now done — see `docs/DEV_STATUS.md`'s dated entry for the evidence trail. This document's "Required target" and "Definition of done" sections below are left as-written since they remain the accurate description of what was targeted and now exists; two items are explicitly deferred rather than done (PHP `tests/` kept co-located under `src/backend/` rather than moved to a fully top-level `tests/`, and the automated CI/hygiene checks in work package G) — both reasoned through in `docs/DEV_STATUS.md` rather than silently skipped.

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

- **Frontend:** the active Expo/React Native implementation, formerly `audit-mobile/`, is now `src/frontend/` (moved 2026-09-02, `git mv`, history preserved).
- **PHP backend:** the deployment-source implementation, formerly `duration-calculator-php/`, is now `src/backend/` (moved 2026-09-02, `git mv`, history preserved).
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


# Repository Architecture and Maintenance Rules

## Purpose

This repository must remain easy for a new developer to understand, safe to modify, and scalable as the duration-calculation application grows.

The current repository contains multiple historical/parallel application layouts ('audit-app', 'audit-mobile', and 'duration-calculator-php') with duplicated backend/frontend implementations. This is now a maintenance problem: developers can easily modify the wrong copy, duplicate fixes, or mistake historical artifacts for the active application.

## Required reorganization

Perform a deliberate repository cleanup and consolidation. Do not blindly delete files or folders. First identify which implementation is the current source of truth, which files are required by CI/CD and deployment, and which artifacts are obsolete.

The target should have one clear application structure, not parallel folders named after implementation history such as 'audit-app', 'audit-mobile', 'audit-engine', etc.

Use modern, conventional project organization. The exact folder names may be chosen by the developer based on the actual code, but the resulting structure should make these responsibilities immediately discoverable:

- src/ — active application source code, organized by responsibility/domain rather than historical project names.
- src/components/ — reusable UI components.
- src/screens/ or equivalent — application screens/routes.
- src/features/ or domain modules where feature-level grouping improves scalability.
- src/services/ — API/network and external service access.
- src/engine/ or src/domain/ — calculation/domain logic, isolated from UI.
- src/data/ — authoritative calculation parameters and static datasets where appropriate.
- src/types/ — shared TypeScript/domain types.
- src/utils/ — genuinely shared utilities only.
- backend/ or api/ — only if the active deployment architecture requires a separate PHP API.
- tests/ — automated tests, organized to mirror the source responsibilities.
- docs/ — durable developer documentation and architecture/formula documentation.
- deployment/configuration files at the repository root where conventional.

Do not create folders merely to make the tree look organized. A folder must represent a meaningful responsibility.

## Historical material

Old changelogs, debugging notes, temporary migration artifacts, obsolete implementation copies, screenshots, generated outputs, and abandoned experiments must not remain as large pseudo-project directories.

If historical material is genuinely needed for traceability, keep it as a clearly named file or small set of files, preferably under docs/ or an appropriate archive location. Do not preserve obsolete applications as active-looking folders.

Do not delete historical information that is required to understand calculation rules, regulatory assumptions, deployment behavior, security constraints, or architectural decisions. Consolidate it into durable documentation instead.

## Single source of truth

There must be one authoritative implementation for each responsibility:

- one active frontend;
- one active API/backend implementation;
- one calculation engine/domain implementation;
- one authoritative parameter/data source;
- one test suite for the active implementation;
- one deployment path.

If duplicated implementations currently exist, compare them before consolidation. Preserve the behavior of the current deployed/source-of-truth implementation and migrate missing functionality deliberately. Do not resolve duplication by arbitrarily choosing the newest-looking folder.

## Preserve business rules

Repository reorganization is structural. It must not alter calculation behavior.

The following are protected and must remain explicit and easy to locate:

- audit-duration formulas and calculation sequence;
- NAE/personnel adjustment rules;
- NACE/risk rules;
- standard-specific duration parameters;
- multi-standard synergy rules;
- audit-cycle rules (initial, surveillance, renewal, etc.);
- rounding rules;
- factors and their effects;
- report-writing duration rules;
- site/headquarters treatment;
- all currently documented business constraints and behavioral expectations.

Create or consolidate a dedicated durable document such as docs/CALCULATION_RULES.md containing the authoritative explanation of these rules. Code comments should explain non-obvious implementation decisions, while durable business rules remain independently discoverable.

## Root documentation

The repository root should contain only high-value entry-point documentation/configuration, for example:

- README.md — what the project is, architecture overview, local setup, test/build commands, deployment overview.
- CONTRIBUTING.md — development conventions and safe change process.
- SECURITY.md — security expectations.
- CHANGELOG.md — concise release/change history, not a giant debugging diary.
- REPOSITORY_ARCHITECTURE.md — this structural contract.
- standard package/build/CI configuration files.

Detailed technical documentation belongs in docs/. Do not keep multiple competing status/roadmap/readme files in arbitrary application directories unless there is a concrete reason.

## Logs and issue history

The existing BUGLOG/DEV_STATUS material contains valuable context but should eventually be consolidated into a maintainable documentation model. Keep the information needed by future developers, but remove repetition and stale operational noise. Do not turn the repository into a diary.

Open bugs must contain: identifier, observed behavior, expected behavior, affected area, reproduction context, evidence level, implementation constraints, and verification criteria.

## CI/CD and deployment safety

Before removing or moving anything, inspect .github/workflows, package scripts, deployment scripts, import paths, build configuration, and any external deployment repository references.

After consolidation:

1. verify all imports and path references;
2. run TypeScript/static checks;
3. run backend tests and API smoke tests;
4. run the frontend production build;
5. verify calculation outputs against existing regression cases;
6. verify the deployed artifact is still generated/published correctly;
7. only then remove obsolete duplicate implementations.

Never claim a folder is obsolete solely because it looks old.

## Developer rule

Optimize the repository for the next developer who has never seen this project. A developer should be able to determine within minutes:

1. where the active application starts;
2. where UI code lives;
3. where API code lives;
4. where calculation/domain logic lives;
5. where authoritative parameters/formulas are defined;
6. where tests live;
7. how to build/test/deploy;
8. which files contain current business rules;
9. which historical material can safely be ignored.

The repository structure must support future expansion without recreating parallel audit-* application trees.

## Non-negotiable constraint

Do not combine reorganization with an uncontrolled rewrite. Refactor the filesystem structure first while preserving behavior, then make functional changes as separate, traceable changes. Any behavior change discovered during consolidation must be logged and tested explicitly.
