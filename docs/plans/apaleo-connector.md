# Apaleo connector plan — for approval

Status: **pending approval**  
Supersedes: `stage-0-mews-next.md` (Mews rejected)  
Product frame: **reliable local product + personal language + one Apaleo connector on request**.

## 0. Fixed decisions

| Area | Decision |
|---|---|
| Europe PMS | **Apaleo only**; optional connector in the build |
| Russia | **1C + Excel**; no Apaleo dependency |
| Internet | Intermittent; local core authoritative; sync is queued |
| Languages | Admin **de**, maids **it/es**; `es-MX` optional later |
| Devices | iPhone, Android phones, old iPads, Android tablets |
| Price | ~€100 / 5,000 RUB per integration; no marketplace/certification budget |
| Auth | Apaleo OAuth2 **client credentials** via a simple/custom client for one hotel |

## 1. Why Apaleo and which client type

Apaleo uses OAuth 2.0 / OpenID Connect.

For one hotel-owned connector, use:

- **Simple client (custom app)**;
- **Client credentials grant**:
  ```http
  POST https://identity.apaleo.com/connect/token
  Authorization: Basic base64(clientId:clientSecret)
  Content-Type: application/x-www-form-urlencoded

  grant_type=client_credentials
  ```
- Bearer access token for `https://api.apaleo.com/...`;
- access token lifetime is typically 3,600 seconds — refresh before expiry.

Why not connect/authorization-code now:

- connect clients are for multi-hotel marketplace apps;
- the current scope is one hotel;
- client credentials are appropriate for a trusted, hotel-owned local app;
- no public redirect/callback endpoint required.

If the hotel later wants multiple properties, the app must move to a connect client + authorization code; that is a separate project.

### Registration

1. Apaleo developer account (already registered).
2. Create **simple client**.
3. Choose **fine-grained client** if available; grant only:
   - property inventory read;
   - unit/housekeeping status read/write;
   - no rates, reservations, folios, payments, company data.
4. Select only the pilot property.
5. Copy `client_id`, `client_secret`, `property_id` through a secure channel.
6. Test token + `403` behavior with a property the client cannot access.

Exact Core API paths and the housekeeping status field must be confirmed from Apaleo Swagger (`https://api.apaleo.com/swagger/index.html`) during the credential spike; do not hardcode assumptions before that.

## 2. Stage 0.5 — Apaleo credential spike (1–3 days)

No UI integration yet.

1. Register simple client; fine-grained permissions, one property.
2. Obtain access token; confirm `expires_in`.
3. Call property/inventory endpoints; record exact paths and response shapes.
4. Confirm how to read and update unit housekeeping state.
5. Confirm whether tasks/notes are available for housekeeping; if not, scope is status only.
6. Confirm rate limits, pagination, error envelope, version prefix.
7. Confirm that the app is not required to be in the Apaleo Store for a private custom client.
8. Confirm device/OS inventory for old iPads/tablets.

**Stop rule:** if the hotel cannot create a client or the needed housekeeping permissions are unavailable, do not build the connector.

**Output:** `docs/plans/apaleo-spike.md` with:
- exact endpoints;
- token flow;
- status mapping;
- sample requests/responses (secrets removed);
- go/no-go.

## 3. Stage 1 — per-user language + device baseline (3–5 days)

### Language

- Admin **de**.
- Maids **it**, **es**.
- Installation default can be German.
- `User.locale` migration:
  ```text
  user.locale > NEXT_LOCALE > installation default > env > "en"
  ```
- Mobile `/m/more` language selector.
- `es-MX` initially maps to `es`; custom `es-MX` pack later only if needed.
- No admin translation uploader yet — built-in de/it/es covers the pilot.

### Devices

Test:

- iPhone Safari;
- Android Chrome;
- old iPad Safari;
- Android tablet;
- 390, 768, 1024 widths.

Check login, tasks, room status, QR scan, offline queue, PWA install.

**Gate:** collect exact iPadOS/Android versions. If an old iPad cannot run the modern Next/React bundle, set a documented minimum OS or use a supported device. Do not promise universal old-iPad support.

### Performance (from 100-room benchmark)

- low-stock report pagination (100 rows/page);
- summary count/value separate from rows;
- WAL + `busy_timeout`;
- index `Operation(documentDate)`;
- limit concurrent Excel exports;
- target: 100 rooms, low-stock p95 < 300 ms server, 10 concurrent < 2 s.

## 4. Stage 2 — Apaleo connector MVP (1–2 weeks after spike)

### Scope

1. `/admin/settings/integrations/apaleo`:
   - enable/disable;
   - property ID;
   - client ID;
   - secret input (see secrets below);
   - “Test connection”;
   - last sync / pending changes.
2. OAuth token service:
   - client credentials;
   - in-memory token cache;
   - refresh before `expires_in`;
   - 401 → refresh once → retry;
   - never log token/secret.
3. Pull:
   - property/units/resources;
   - map Apaleo unit IDs → local rooms;
   - read housekeeping state.
4. Push:
   - local status changes → Apaleo unit update;
   - only status; no rates/reservations/folios.
5. Sync:
   - every 5–15 min or on demand;
   - polling first;
   - webhooks only if a public HTTPS endpoint exists;
   - idempotency + `ExternalEntityMap`;
   - conflict: source + timestamp; do not overwrite newer local changes.
6. Offline:
   - local changes queued in outbox;
   - retry with exponential backoff;
   - local UI never blocks on Apaleo.
7. UI:
   - connected / offline / last sync / pending;
   - disconnect;
   - mapping preview.
8. Logging:
   - sync success/failure, 401/403/429, duration;
   - no client secret/access token.

### Secrets

Preferred for v1:

- `APALEO_CLIENT_ID`, `APALEO_CLIENT_SECRET`, `APALEO_PROPERTY_ID` in server env;
- UI only enables/disables and tests;
- no secret in SQLite/browser/logs.

If UI credential entry is required later:

- encrypt with an installation secret;
- never return secret to client;
- rotation flow required.

### Apaleo API facts

- [Authentication](https://apaleo.dev/guides/oauth-connection/authentication): OAuth2/OIDC; fine-grained clients recommended.
- [Client credentials](https://apaleo.dev/guides/oauth-connection/simple-client): token endpoint, Basic auth, 3,600 s token.
- [Scopes/permissions](https://apaleo.dev/guides/api/scopes): request minimal permissions.
- [Webhooks](https://apaleo.dev/guides/webhook/overview): public HTTPS endpoint required; polling is the fallback.

## 5. API key / public API — not for Apaleo

Apaleo is an **outbound OAuth2 integration**. The local app does not need a public `/api/v1` or API key for Apaleo.

- No `X-API-Key` endpoint in this stage.
- No OAuth authorization-code server in this stage.
- No marketplace.
- The previously planned 3-endpoint API remains deferred for a different PMS/automation partner.

## 6. Budget guard

At €100 / 5,000 RUB per integration:

- one simple client, one property;
- no Apaleo Store listing/certification;
- one-time setup;
- customer supplies client credentials;
- no cloud service;
- limited support scope.

If Apaleo requires marketplace certification for the desired capabilities, stop and price it separately.

## 7. Acceptance

- Token obtained via client credentials; expires/refresh tested.
- Apaleo property/units read; local rooms mapped.
- Local status update reaches Apaleo; read-back matches.
- Internet loss → status queued → reconnect → delivered.
- 401/403/429 handled; no token/secret in logs.
- Local app fully works with connector disabled/offline.
- Admin de + maids it/es simultaneously.
- Old iPad/Android baseline documented.
- 100-room performance targets pass.

## 8. Approval questions

1. Approve **simple client + client credentials**, one property.
2. Approve **fine-grained minimal permissions** (no reservations/rates/folios).
3. Approve **polling first**, webhooks only with public HTTPS.
4. Approve env-based client secret for v1 (no credentials in DB/UI).
5. Provide/confirm Apaleo property ID and permission to create a custom client.
6. Confirm exact old iPad/Android versions for the device gate.
7. Approve that no public API key/generic API is built for Apaleo.
