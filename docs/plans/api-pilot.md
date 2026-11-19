# Stage 3 — API pilot: 3 endpoints + API key

Status: **pending approval**  
Goal: one simple, secure integration surface for one PMS on request. No OAuth2, no marketplace, no multi-tenant platform.

## Scope (v1 pilot)

Exactly three endpoints:

```text
GET  /api/v1/rooms
PUT  /api/v1/rooms/{roomId}/housekeeping-status
POST /api/v1/housekeeping-tasks
```

No reservations, rates, folios, stock operations, audit writes, or public webhooks in v1.

## Authentication

- Header: `X-API-Key`.
- Key format: random 32+ bytes, prefix for identification, store only SHA-256 hash.
- Key is bound to one property/installation and one scope set.
- Admin can create/revoke/rotate keys in `/admin/settings/integrations`.
- `Authorization: Bearer` is not used in v1; no OAuth2.
- Request ID and rate limit per key.
- Constant-time comparison; no key in logs.

## Endpoints

### `GET /api/v1/rooms`

Query:

- `active=true|false` optional;
- `updatedSince=ISO8601` optional.

Response:

```json
{
  "data": [
    {
      "id": "room_id",
      "number": "101",
      "floor": "1",
      "roomTypeId": "type_id",
      "housekeepingStatus": "CLEAN",
      "updatedAt": "2026-11-19T12:00:00.000Z"
    }
  ]
}
```

### `PUT /api/v1/rooms/{roomId}/housekeeping-status`

Body:

```json
{
  "status": "DIRTY",
  "externalUpdatedAt": "2026-11-19T12:00:00Z",
  "source": "PMS_NAME"
}
```

Rules:

- status values: `CLEAN | DIRTY | INSPECTED | OUT_OF_ORDER`;
- validate transition;
- reject stale updates using `externalUpdatedAt`/`updatedAt`;
- idempotency key header optional but recommended;
- returns current status and version.

### `POST /api/v1/housekeeping-tasks`

Body:

```json
{
  "roomId": "room_id",
  "type": "DAILY",
  "priority": "MEDIUM",
  "comment": "optional",
  "externalId": "pms-task-123"
}
```

Rules:

- `externalId` unique per source; duplicate returns existing task;
- assignee optional;
- no arbitrary user IDs from untrusted input.

## Contract

- OpenAPI 3.1 file at `docs/api/openapi.yaml`; generated/validated against handlers.
- Errors: `application/problem+json` with `code`, `detail`, `requestId`.
- Validation: Zod shared with application service.
- Versioning: `/api/v1`; no breaking changes inside v1.
- Pagination: limit/offset for GET rooms; default 100, max 500.
- Rate limit: e.g. 60 req/min per key (configurable).
- CORS: disabled by default; allowlist only if a browser client is approved.

## Data model (minimal)

```text
ApiKey
  id, name, keyHash, prefix, scopes, propertyId, active,
  createdAt, lastUsedAt, revokedAt

ExternalEntityMap (only when PMS adapter is added)
  provider, externalType, externalId, localId, lastExternalUpdatedAt
```

No `Property` table yet: single installation is one property; `propertyId` may be a stable constant/config until multi-property is real.

## PMS integration

- Stage 3 ships the API and a **mock adapter** only.
- One real PMS adapter is added only after Stage 0 selects a pilot.
- Candidate order: the hotel’s actual PMS first; Cloudbeds/Apaleo/Mews only if that is the pilot.
- If the PMS is cloud-only, integration runs in **connected mode** with internet; local core remains offline.
- Outbound sync uses existing outbox; inbound idempotency via `WebhookInbox` only after webhook scope is approved.

## Security and offline behavior

- API key required on every request; no anonymous access.
- If internet is absent, API is unavailable externally; local UI continues.
- Do not expose API through a public tunnel by default; local network/VPN only.
- HTTPS and reverse proxy are deployment responsibilities; API rejects non-local plain HTTP only if configured.
- Audit every API mutation to `LogEvent` with key prefix, not key value.

## Tests

- 401 missing/invalid/revoked key.
- 403 scope/property mismatch.
- 200/400/404/409 for status transitions.
- Idempotency for task `externalId`.
- Rate limit.
- Stale update rejected.
- OpenAPI contract test.
- API key never appears in logs.
- Local UI still works with API disabled.

## Acceptance

- Three endpoints documented and tested.
- Admin can create/revoke a key; only hash stored.
- One mock PMS flow works end-to-end.
- No OAuth2/marketplace/multi-tenant code.
- Existing 103 tests + API tests + build green.
- Decision recorded: which one PMS, if any, gets the first real adapter.

## Explicit non-goals

- OAuth2, scopes server, marketplace listing.
- Cloudbeds + Apaleo + Mews simultaneously.
- Reservations/rates/folios.
- Multi-property SaaS.
- Public webhooks in v1.
