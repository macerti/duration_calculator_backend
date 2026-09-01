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
