# Workflow plans — reliable local product

Status: **planning / pending approval**  
Baseline: `v2.3.6`, `main` at planning time  
Performance baseline: synthetic 10/50/100-room tests, 2026-11-19.

## Product direction

> **Reliable local product + personal language + simple integration with one PMS on request.**

This is the acceptance frame for all plans below. No cloud dependency, no mandatory AI, no marketplace, no multi-tenant SaaS in the first iteration.

## Plans

| Stage | Plan | Purpose |
|---|---|---|
| 0–1 | [stage-0-1.md](stage-0-1.md) | Demand validation and per-user/per-device locale |
| 0–2 | [stage-0-mews-next.md](stage-0-mews-next.md) | Mews feasibility, device baseline, Mews housekeeping MVP |
| 2 | [minimal-refactor.md](minimal-refactor.md) | Minimal refactor, performance fixes, no full application layer |
| 3 | [api-pilot.md](api-pilot.md) | 2–3 endpoints + API key, no OAuth2/marketplace |
| 4 | [translation-packs.md](translation-packs.md) | Admin-uploaded translation files, phase 1 |
| 5 | [dependency-evaluation.md](dependency-evaluation.md) | Dependency upgrades after stabilization |
| Gate | [reliability-checklist.md](reliability-checklist.md) | What “done” must prove |

## Performance findings that shape the plan

Measured on a local production build (`next start`), synthetic 100-room DB:

- 100 rooms / 50 items / 10k operations / 5k logs = **6.5 MB**; SQLite is not the bottleneck.
- Normal admin pages: **p50 30–40 ms** server; 50 concurrent normal requests all succeeded in **659 ms** total.
- **Low-stock report**: 94 ms at 10 rooms, 362 ms at 50, **640 ms** at 100; browser wall **1.46 s** at 100.
- 10 concurrent low-stock requests: **5.6 s**; 20: **10.35 s**.
- Current SQLite: `journal_mode=delete`, `synchronous=FULL`; 1,000 inserts in one transaction ~12 ms. WAL is still recommended for read/write concurrency.
- Missing index: `Operation(documentDate)`.

Decision: **5–50 rooms are comfortable; 100 rooms is supported only after low-stock pagination + WAL + index.** No microservices.

## Approval gates

1. Stage 0 evidence: at least one real hotel/PMS scenario.
2. Stage 1: per-user locale, admin ru + maid en simultaneously.
3. Stage 2: p95 budgets and low-stock concurrency target.
4. Stage 3: API key auth, three endpoints, no OAuth2/marketplace.
5. Stage 4: full-catalog JSON packs only; no RTL/partial in phase 1.
6. Stage 5: one major dependency at a time, after stabilization.

No implementation starts until the relevant gate is approved.
