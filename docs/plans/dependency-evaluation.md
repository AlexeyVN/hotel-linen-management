# Stage 5 — dependency evaluation after stabilization

Status: **pending approval / deferred**  
Start only after Stage 1–3 are stable and performance acceptance is met.  
Goal: decide upgrades with evidence, not merge Dependabot blindly.

## Current baseline

- Next.js 15.1, React 19, tRPC 11, Prisma 6, next-auth 4, Zod 3, Tailwind 3.4, pino 9, next-intl 4.
- 103 tests; build green; offline SQLite deployment.
- Remote Dependabot branches exist (Prisma 7 etc.); do not auto-merge.

## Evaluation steps

1. **Freeze baseline**
   - Record `main` commit/tag, `npm ls --depth=0`, lockfile hash.
   - Run `npm test`, `npm run build`, Playwright smoke, 5-locale audit.
2. **Inventory**
   - Direct/transitive dependencies, peer ranges, native modules.
   - `npm outdated`, `npm audit`, license check.
3. **Scope candidates**
   - Next 15→16, Prisma 6→7, next-auth 4→5, Zod 3→4, Tailwind 3.4→4, tRPC 11 latest.
   - Do not upgrade all at once.
4. **Official evidence**
   - Read upgrade guides, release notes, breaking changes, codemods.
   - Record version/date/URL.
5. **Compatibility matrix**
   - Node 24, Windows 11, SQLite, Prisma engine, Next build, next-auth JWT/session, pino, ExcelJS, PWA.
6. **Risk classification**
   - Auth/session; data migration; build/deploy; offline queue; PWA cache.
   - Any irreversible migration gets backup + rollback plan.
7. **Pilot one major**
   - Branch `chore/dep-<name>`; copy SQLite; no production migration.
   - Apply codemod; fix types; run tests/build/e2e.
8. **Validation**
   - 103+ tests; build; 6 locales; API contract (if implemented); mobile offline; backup/restore.
   - Compare performance baseline.
9. **Decision**
   - Adopt / defer / reject with evidence.
   - Update `docs/DEPENDENCY-MATRIX.md`.
10. **Rollback**
    - Tag previous release; documented `npm ci` + DB restore; no destructive migration without backup.

## Per-dependency notes

| Candidate | Main risk | Gate |
|---|---|---|
| Next 15→16 | async APIs, caching, build output | pilot only after API stable |
| Prisma 6→7 | generator/config, engine, SQLite migration | backup + migration test |
| next-auth 4→5 | session/JWT API, middleware | auth e2e required |
| Zod 3→4 | schema/error shape | contract tests |
| Tailwind 3.4→4 | CSS config, visual regressions | screenshot audit |
| tRPC 11 latest | minor; low risk | normal tests |

## Acceptance

- Each candidate has a decision and evidence.
- No major upgrade merged without tests/build/e2e and rollback.
- Performance not worse than baseline.
- Offline install still works.
- Dependabot PRs reviewed individually.

## Explicit non-goals

- Upgrading during API/translation implementation.
- Combining multiple majors in one PR.
- Upgrading for “latest” without a product reason.
