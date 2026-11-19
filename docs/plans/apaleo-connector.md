# Apaleo connector plan — for approval

Status: **Stage 0.5 read-only PASS — write test and next stages await approval**  
Supersedes: `stage-0-mews-next.md` (Mews rejected)  
Product frame: **reliable local product + personal language + one Apaleo connector on request**.

## 0. Confirmed decisions (user, 2026-11-19)

- Apaleo **simple client + client credentials**, one property.
- **Fine-grained minimal permissions**, without reservations/rates/folios.
- **Polling first**; webhooks only with a public HTTPS endpoint.
- Secrets in **env**/local `id_client_apaleo.txt`, not in DB/UI.
- **No public API key** for Apaleo.
- User provides **Apaleo property_id** and permission to create a client.
- Budget confirmed: **€100 / 5,000 RUB per one-time connector**.
- **Initial installation language is English for both admin and maids**; each can change it personally afterwards.
- Six built-in locales; tests for admin and maids on all six.
- Apaleo credentials file: `id_client_apaleo.txt` in the project root.
- Stage 0.5 read-only result: **PASS** — token, property `LND`, 51 units, and `unit.status.condition` confirmed.
- No Apaleo write has been performed.

These decisions are recorded; write verification and next stages require explicit approval.

## 0.1 Fixed product decisions

| Area | Decision |
|---|---|
| Europe PMS | **Apaleo only**; optional connector in the build |
| Russia | **1C + Excel**; no Apaleo dependency |
| Internet | Intermittent; local core authoritative; sync is queued |
| Languages | **6 built-in**: English (initial default for admin and maids), Russian, Italian, Spanish, German, French |
| Staff languages | **Initial: English for admin and maids**; each can switch personally to de/it/es/ru/fr |
| Devices | iPhone, Android 9+, iPad 7th generation+, Android tablets |
| Price | **€100 / 5,000 RUB** per integration; no marketplace/certification budget |
| Auth | Apaleo OAuth2 **client credentials** via a simple/custom client for one hotel |

### Language order and defaults

```text
en (default) → ru → it → es → de → fr
```

- New installation default: **English**.
- Existing installation: **explicit saved locale may remain**, but the default for unset users and all new installations is English.
- Fallback: requested user locale → English → key.
- All six catalogs must have the same key/placeholder set.
- `es-MX` is a later optional pack; it is not a seventh built-in.
- Admin: German; maids: Italian/Spanish; English is the default and fallback.
- Tests: **6 locales × admin + maid** (12 role/locale scenarios), plus fallback/placeholder checks.
- The old fixed five-locale assertion must be generalized.

### Credential file

`id_client_apaleo.txt` in the project root is the local credential source:

```text
The client id is: <client_id>
The client secret is: <client_secret>
```

Rules:

- add it to `.gitignore`; never commit;
- never include it in archive/checkpoint;
- parse only server-side;
- never log/print the secret;
- optional `.env` values can override the file;
- `property_id` is not in the current file; obtain it via API after token success.

The file currently exists and is ignored by Git, but its credentials are rejected by Apaleo (`invalid_client`).

### Device baseline

| Device | Minimum |
|---|---|
| Android phone/tablet | **Android 9 (API 28)** |
| Apple iPad | **iPad 7th generation** (iPadOS 15) |
| iPhone | iOS 15+ (test current Safari) |
| Browser | current Chrome/Safari; no promise for older WebViews |

Test actual old iPad 7 and Android 9 devices; if the modern Next/React bundle is not usable, document the minimum OS and fallback. Do not claim universal old-device support.

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

### Registration and key guide (Apaleo)

Official flow: [Register an OAuth simple client (custom) app](https://apaleo.dev/guides/oauth-connection/register-simple-client-app.html). Only an account administrator can register an app.

#### 1. Sign in to the Apaleo Dashboard

- Open <https://app.apaleo.com/dashboard>.
- Use the account where the hotel/property lives.
- If there is no developer account: <https://identity.apaleo.com/account/register-dev-account>.

#### 2. Create a custom app

1. Go to **Apps → Connected apps**.
2. Click **Add a new app**.
3. Select **Add custom app**.

#### 3. Fill the app form

| Field | Value for this connector |
|---|---|
| Client code | e.g. `HOTEL_LINEN` — 3–30 letters/numbers/underscores; becomes part of client ID |
| Client name | e.g. `Hotel linen housekeeping connector` |
| Personally identifiable information | **Omit all** — housekeeping needs no guest names/contacts |
| Secrets | description e.g. `production`; create the secret |
| Client access | **Fine-grained client** (recommended; cannot be changed later) |
| Permissions | only property/unit/inventory read and unit housekeeping update; see below |
| Property access | **Only selected properties** → select the pilot hotel |

**Permissions:** exact labels are shown in Apaleo’s UI/Swagger and may change. Select the minimum that covers:
- read property/unit inventory;
- read unit housekeeping/condition;
- update unit housekeeping/condition.

Do **not** select reservations, rates, folios, payments, guest/PII, company, or accounting permissions.

#### 4. Save and copy credentials

After saving, copy:

- **Client ID** (`client_id`);
- **Client Secret** (`client_secret`) — shown only once; store it safely;
- the selected **property ID** (see next step).

If the secret is lost or compromised:

- add a **new secret** to the app;
- update `.env`;
- delete the old secret after the connector is verified;
- never send the secret in chat/email.

#### 5. Get `property_id`

With the token from step 6, call the inventory properties endpoint (confirm exact path in Swagger):

```http
GET https://api.apaleo.com/inventory/v1/properties
Authorization: Bearer <access_token>
```

The property `id` is the value for `APALEO_PROPERTY_ID`.  
If the response contains several properties, select only the pilot hotel; do not use “all properties”.

#### 6. Test token and property

Token request:

```http
POST https://identity.apaleo.com/connect/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

PowerShell Base64 helper:

```powershell
$pair = "$clientId`:$clientSecret"
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))
```

Test:

```powershell
$token = (Invoke-RestMethod -Method Post `
  -Uri "https://identity.apaleo.com/connect/token" `
  -Headers @{ Authorization = "Basic $basic" } `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "grant_type=client_credentials").access_token

Invoke-RestMethod -Uri "https://api.apaleo.com/inventory/v1/properties" `
  -Headers @{ Authorization = "Bearer $token" }
```

Expected:
- token response has `access_token`, `expires_in`, `token_type=Bearer`;
- property list succeeds;
- a property outside the selected access returns `403`.

#### 7. Store in `.env`

```text
APALEO_CLIENT_ID=...
APALEO_CLIENT_SECRET=...
APALEO_PROPERTY_ID=...
```

Never commit `.env`; never store the secret in SQLite or return it to the browser. For v1, UI only enables/disables and tests the connector.

#### 8. Later rotation

- Add a new secret in Apaleo.
- Update `.env` and restart the app.
- Verify token + property.
- Delete the old secret.

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

### Current Stage 0.5 result (2026-11-19)

**READ-ONLY PASS.**

- Credential file exists and is gitignored; no secret printed.
- Token request succeeded:
  - `token_type=Bearer`
  - `expires_in=3600`
  - `scope=identity:permissions` (fine-grained client)
- `GET /inventory/v1/properties` returned:
  - property `id=LND`, name `Hotel London`, status `Test`.
- `GET /inventory/v1/units?propertyId=LND` returned **51 units**.
- There is **no separate `housekeeping` object**. The housekeeping condition is inside:

```json
{
  "status": {
    "isOccupied": false,
    "condition": "Clean"
  }
}
```

- Allowed condition values from Apaleo `UnitStatusModel`:
  - `Clean`
  - `CleanToBeInspected`
  - `Dirty`
- Out-of-order/maintenance is a separate `status.maintenance` / resource-block concept.
- Read-only `GET` works for properties and units.

### Update endpoint (not exercised)

- `PATCH /inventory/v1/units/{id}` accepts **JSON Patch** operations.
- Relevant permission: `core.units.status.condition.modify` (or broader `core.units.modify`).
- 405 response confirms allowed methods include `PATCH`.
- Exact JSON Patch path/value must be verified with a **same-value no-op test** on the test property before any real status change.

**No write has been performed. A same-value no-op PATCH requires explicit approval.**

### Important limitation

Property `LND` has status **Test**, not production. A real hotel property ID must be provided before production use.

**Stop rule:** if the hotel cannot create a client or the needed housekeeping permissions are unavailable, do not build the connector.

**Output:** `docs/plans/apaleo-spike.md` with:
- exact endpoints;
- token flow;
- status mapping;
- sample requests/responses (secrets removed);
- go/no-go.

## 3. Stage 1 — per-user language + device baseline (3–5 days)

### Language

- Built-in six: **English (initial default), Russian, Italian, Spanish, German, French**.
- **On first installation, both admin and maids start in English.**
- After login, each user can change language personally; the choice is stored in `User.locale`.
- Example target preferences after setup: admin **de**, maids **it/es**; en/ru/fr also available.
- English is the installation default and fallback.
- `User.locale` migration:
  ```text
  user.locale > NEXT_LOCALE > installation default > env > "en"
  ```
- Mobile `/m/more` language selector.
- `es-MX` initially maps to `es`; custom `es-MX` pack later only if needed.
- No admin translation uploader yet — built-in six covers the pilot.
- Add `fr` catalog with full key/placeholder parity.
- Tests: **6 locales × admin + maid** (12 role/locale scenarios), plus fallback/placeholder checks.

### Devices

Test:

- iPhone Safari (iOS 15+);
- Android 9+ Chrome;
- iPad 7th generation Safari;
- Android 9+ tablet;
- 390, 768, 1024 widths.

Check login, tasks, room status, QR scan, offline queue, PWA install.

**Gate:** actual iPad 7 and Android 9 devices must be tested. If an old device cannot run the modern Next/React bundle, set a documented minimum OS or use a supported device. Do not promise universal old-device support.

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
   - property ID display;
   - client ID display;
   - **no secret input** (secret comes from `.env`);
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
   - condition mapping:
     | Local | Apaleo `status.condition` |
     |---|---|
     | CLEAN | `Clean` |
     | DIRTY | `Dirty` |
     | INSPECTED | `CleanToBeInspected` |
     | OUT_OF_ORDER | **not in v1** — separate maintenance/block; do not write as condition |
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
- `status.condition` mapping verified; no separate housekeeping field assumed.
- Local status update reaches Apaleo; read-back matches.
- Internet loss → status queued → reconnect → delivered.
- 401/403/429 handled; no token/secret in logs.
- Local app fully works with connector disabled/offline.
- Initial install: **English for admin and maids**.
- All six locales tested for admin and maids.
- Old iPad 7 / Android 9 baseline documented.
- 100-room performance targets pass.

## 8. Approval questions

1. Approve one **same-value no-op PATCH** on a single `LND` test unit to verify JSON Patch (`status.condition` remains `Clean`).
2. Approve **Stage 1**: six locales, initial English for admin and maids, per-user switching, device baseline, performance fixes.
3. Approve **Stage 2**: Apaleo connector MVP with `status.condition` mapping; no out-of-order write in v1.
4. Keep **simple client + client credentials**, one property.
5. Keep **fine-grained minimal permissions** (no reservations/rates/folios).
6. Keep **polling first**, webhooks only with public HTTPS.
7. Keep secrets in env/`id_client_apaleo.txt`, not DB/UI.
8. Confirm whether `LND` is the intended test property and provide the production `property_id` later.
9. Confirm old iPad 7 / Android 9 devices are available for testing.
10. Keep **no public API key/generic API** for Apaleo.
