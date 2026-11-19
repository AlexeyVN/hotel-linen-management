# Reliability checklist — local product + personal language + one PMS

Status: **acceptance gate**  
This is the definition of success for Stages 0–5.

## Product invariant

> Reliable local product + personal language + simple integration with one PMS on request.

- Core works without internet, AI, cloud, or external API.
- Each user can choose their own language; installation default remains.
- PMS integration is optional, one provider, request-driven; no marketplace.
- 5–50 rooms comfortable; 100 rooms supported with the performance fixes.
- No data loss on power/network interruption.

## Functional acceptance

### Local product

- [ ] Login, roles, room status, warehouse, operations, inventory, cleaning, QR, Excel, logs work offline.
- [ ] SQLite backup/restore verified with `integrity_check`.
- [ ] No mandatory outbound connection at runtime.
- [ ] Error boundaries show safe localized message + correlation ID.
- [ ] All mutations idempotent where retry is possible.
- [ ] No raw server Russian in a non-Russian UI.

### Personal language

- [ ] Admin `ru` + maid `en` simultaneously on one server.
- [ ] `User.locale` optional; installation default applies only when unset.
- [ ] Mobile `/m/more` has language selector.
- [ ] `<html lang/dir>` matches each request.
- [ ] Excel/report/date formats follow the user locale.
- [ ] PWA offline does not show stale language.
- [ ] Language change does not log out or affect other users.

### PMS integration

- [ ] Exactly three v1 endpoints implemented.
- [ ] API key hashed, revocable, property-bound.
- [ ] 401/403/409/rate-limit tests pass.
- [ ] No OAuth2/marketplace/reservations in v1.
- [ ] One PMS scenario chosen from Stage 0; adapter or mock only.
- [ ] API disabled/offline does not break local UI.

## Performance acceptance (100 rooms)

| Metric | Target | Evidence |
|---|---:|---|
| Normal admin page p95 | < 300 ms | local benchmark |
| Low-stock p95, one user | < 300 ms server | benchmark |
| Low-stock browser DOM | < 700 ms | Playwright |
| 10 concurrent low-stock | < 2 s | load test |
| 50 concurrent normal pages | 50/50 OK, < 1.5 s | load test |
| DB write/busy | no lock errors | WAL + busy_timeout |
| Backup/restore | 100% hashes/integrity | checkpoint/restore |

## Test gates

- [ ] `npm.cmd test` ≥ 103 + new tests.
- [ ] `npm.cmd run build` green.
- [ ] Playwright smoke: login, admin, low report, mobile tasks, locale switch.
- [ ] 6 built-in locales + one custom pack.
- [ ] API contract test.
- [ ] Backup/restore on temporary copy.
- [ ] No secrets/DB/node_modules in archive.

## Operational gates

- [ ] WAL enabled; backup includes checkpoint.
- [ ] `Operation(documentDate)` index present.
- [ ] Low-stock pagination is live.
- [ ] Excel export concurrency guard.
- [ ] Retention/jobs documented.
- [ ] Deploy/rollback steps tested.
- [ ] Version/tag/checksum recorded.

## Release evidence

For every stage:

1. Commit SHA and tag.
2. Test command + actual result.
3. Build result.
4. Performance p50/p95 before/after.
5. Archive path + size + SHA-256.
6. Checkpoint path + integrity.
7. Known limitations.

## Stop rules

- Stop and do not release if any P0 acceptance item fails.
- Stop API work if Stage 0 has no real PMS scenario.
- Stop translation-pack work if Stage 1 per-user locale is not stable.
- Do not start dependency upgrades before Stage 1–3 stability.
- Do not claim “100 rooms supported” until low-stock concurrency target passes.
