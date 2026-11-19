# Apaleo Stage 0.5 — credential spike result

Date: 2026-11-19  
Status: **BLOCKED — `invalid_client`**  
Scope: read-only token/property/units/housekeeping discovery. No UI or source code changes.

## Input

- Local credential file: `id_client_apaleo.txt` (project root).
- File is gitignored and excluded from archives.
- It contains client ID and client secret; no `property_id`.
- Secret values are not reproduced in this document.

## What was attempted

1. Parsed the credential file server-side without printing values.
2. Requested a token:

```http
POST https://identity.apaleo.com/connect/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

3. Also tested credentials in the request body (diagnostic only).

## Result

Both requests returned:

```text
HTTP 400
{"error":"invalid_client"}
```

No access token was issued. Therefore:

- property list was not queried;
- units/housekeeping fields were not read;
- no update test was attempted;
- no production data was changed.

## Likely causes

- secret expired, rotated, or copied incorrectly;
- app is a **connect client**, not a **simple/custom client**;
- app inactive or created in another Apaleo account;
- the custom app’s selected property/permissions are incomplete;
- client ID and secret do not belong together.

## Required fix (user side)

1. Apaleo Dashboard → **Apps → Connected apps**.
2. Open the custom app; confirm it is a **simple/custom client**.
3. Create a **new secret** for the app.
4. Update `id_client_apaleo.txt` locally:
   ```text
   The client id is: <client_id>
   The client secret is: <client_secret>
   ```
5. Confirm the app is active and the pilot property is selected.
6. Do not send the secret in chat; only confirm that the file is updated.

## Re-run checklist after fix

- [ ] token returns `access_token`, `expires_in`, `token_type=Bearer`;
- [ ] `GET /inventory/v1/properties` returns the pilot property;
- [ ] `property_id` is recorded in `property_id.local.txt` or `.env` (never committed);
- [ ] units list is readable;
- [ ] housekeeping/condition field is identified;
- [ ] read-only status test succeeds;
- [ ] update test is **not** run without explicit approval;
- [ ] 403 behavior for an unselected property is documented.

## Next step

After the credential file is corrected, re-run Stage 0.5. Only then ask for approval of Stage 1/2. No connector code is to be written while this gate is blocked.
