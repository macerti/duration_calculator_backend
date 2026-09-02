# Bug Log — src/frontend

> ✅ **Merged into `docs/BUGLOG.md` — 2026-09-02 (eleventh session, technical-debt pass).**
>
> This file used to carry its own independent `BUG-001`–`BUG-004` numbering
> that collided with `docs/BUGLOG.md`'s own (unrelated) `BUG-001`–`BUG-004`
> — most confusingly, this file's own `BUG-004` ("wizard save is broken")
> was also the bug `docs/DEV_STATUS.md`'s "Current status" section
> informally tracked as *the* BUG-004. Flagged as needing a dedicated
> renumbering/merge pass since 2026-09-01 (sixth session); deferred by four
> sessions in a row as too large to attempt without full runway.
>
> All four entries have now been folded into `docs/BUGLOG.md`'s canonical
> sequence, full original detail preserved (not summarized away):
>
> | This file's old ID | Canonical ID | Bug |
> |---|---|---|
> | BUG-001 | [`BUG-032`](../../docs/BUGLOG.md) | `expo-constants` used but not installed (fixed, 0.1.0) |
> | BUG-002 | [`BUG-033`](../../docs/BUGLOG.md) | `HomeScreen` health-state spread overwrote discriminant field (fixed, 0.1.0) |
> | BUG-003 | [`BUG-034`](../../docs/BUGLOG.md) | `expo export --platform web` peer-dependency failure (fixed, 0.1.0) |
> | BUG-004 | [`BUG-035`](../../docs/BUGLOG.md) | Wizard save/autosave reliability — **partially open**, see BUG-035 for current status |
>
> **Cite `BUG-032`–`BUG-035` in `docs/BUGLOG.md` for all new work.** This
> file is kept only so old commit messages/discussions that reference
> "audit-mobile BUG-004" etc. still resolve to something; it is not
> maintained further. Full original investigation detail (file/line
> references, symptom analysis, suggested next steps) is preserved in git
> history for this file and duplicated in full in `docs/BUGLOG.md`'s
> `BUG-035` entry.
