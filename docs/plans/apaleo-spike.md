# Apaleo Stage 0.5 — credential spike result

Date: 2026-11-19  
Status: **READ-ONLY PASS**  
Scope: token, property, units, housekeeping-field discovery. No write operations.

## Input

- Local credential file: `id_client_apaleo.txt` (project root).
- File is gitignored and excluded from archives.
- Contains client ID and client secret; no `property_id`.
- Secrets are not reproduced in this document.

## Authentication

```http
POST https://identity.apaleo.com/connect/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

Result:

- **HTTP 200**
- `token_type=Bearer`
- `expires_in=3600`
- `scope=identity:permissions` → fine-grained client

## Property

`GET https://api.apaleo.com/inventory/v1/properties`

- property ID: `LND`
- name: `Hotel London`
- status: `Test`
- only one property visible

## Units

`GET https://api.apaleo.com/inventory/v1/units?propertyId=LND`

- 51 units
- fields include `id`, `name`, `description`, `unitGroup`, `status`
- sample status:

```json
{
  "status": {
    "isOccupied": false,
    "condition": "Clean"
  }
}
```

## Housekeeping field

There is **no separate `housekeeping` object**. The housekeeping condition is:

```text
unit.status.condition
```

Allowed values:

```text
Clean
CleanToBeInspected
Dirty
```

Out-of-order/maintenance is represented separately via `status.maintenance` / resource blocks.

## Update method

`PATCH /inventory/v1/units/{id}` accepts JSON Patch.

- allowed methods include `PATCH` (confirmed via `OPTIONS`);
- required permission for condition changes:
  - `core.units.status.condition.modify`, or
  - broader `core.units.modify`.
- exact JSON Patch path/value must be confirmed with a **same-value no-op** test on `LND` before any real change.

**No PATCH was sent.** This requires explicit approval because it is a write to the test property.

## Limitations

- `LND` is a **Test** property; production requires a real property ID.
- The client is fine-grained; write permission may not yet be granted.
- Webhooks require a public HTTPS endpoint; polling remains the default.

## Next step

Ask for approval to:

1. send one no-op PATCH on a single test unit (`condition` stays `Clean`);
2. verify the response and JSON Patch path;
3. then approve Stage 1/2 implementation.

No connector code is written until this is resolved.
