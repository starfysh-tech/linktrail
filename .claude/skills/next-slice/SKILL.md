---
name: next-slice
description: Implement the next Linktrail v1 slice from docs/issues/ test-first. Use when the user wants to build/continue implementation, or runs /next-slice (optionally with a slice number).
disable-model-invocation: true
---

# Next Slice

Implement one Linktrail v1 implementation slice, test-first, end to end.

`$ARGUMENTS` may contain a specific slice number (e.g. `2`). If empty, pick the
next slice to work on automatically.

## Process

1. **Read the spec.** Read `docs/prd-v1.md` (decisions + testing seams) and the
   slice files in `docs/issues/`. Respect the locked technical decisions and the
   shared-normalization gotcha in `CLAUDE.md`.

2. **Pick the slice.**
   - If `$ARGUMENTS` names a slice, use it.
   - Otherwise choose the lowest-numbered slice whose "Blocked by" dependencies
     are all complete and that isn't done yet. Dependency shape: `1 → {2,3,4} → 5`.
   - Confirm the chosen slice with the user before writing code.

3. **Build test-first**, against the slice's seam (see PRD "Testing Decisions"):
   - Seam 1 (backend HTTP) for save/feed/verify behavior.
   - Seam 2 (`lib/normalize`) for normalization cases.
   - Seam 3 (extension capture decisions) for is-capturable / payload / state map.
   Write a failing test, make it pass, then refactor. Test external behavior only.

4. **Honor the acceptance criteria** listed in the slice file — each checkbox is a
   requirement. Don't expand scope beyond the slice; out-of-scope items belong to
   later slices or the PRD backlog.

5. **Verify** the slice is demoable/verifiable as described, then **commit and push
   directly to `main`** (per CLAUDE.md), referencing the slice in the message.

## Notes

- Keep normalization in shared `lib/` — never reimplement per side.
- Don't introduce frameworks excluded by CLAUDE.md (no Next.js, no React).
- Secrets come from `.env.local` (`vercel env pull`); never commit them.
