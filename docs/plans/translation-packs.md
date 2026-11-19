# Stage 4 — translation packs (phase 1)

Status: **pending approval**  
Depends on: Stage 1 per-user locale.  
Goal: ADMIN can upload a full translation file for an additional language; server and mobile use it without a rebuild.

## Scope phase 1

- Full-catalog JSON pack only.
- Any BCP-47 locale code.
- LTR only.
- ADMIN-only upload/activate/delete.
- Fallback to default locale for missing/unresolved keys.
- No partial packs, no in-app editor, no RTL, no XLIFF/CSV in phase 1.

## File schema

`schemas/translation-pack.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["schemaVersion", "locale", "name", "messages"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "locale": { "type": "string", "pattern": "^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$" },
    "name": { "type": "string", "minLength": 2, "maxLength": 80 },
    "nativeName": { "type": "string", "minLength": 2, "maxLength": 80 },
    "direction": { "enum": ["ltr"] },
    "fallback": { "type": "string", "default": "en" },
    "messages": { "$ref": "#/$defs/messages" }
  },
  "additionalProperties": false
}
```

Example:

```json
{
  "schemaVersion": 1,
  "locale": "pt-BR",
  "name": "Português (Brasil)",
  "nativeName": "Português (Brasil)",
  "direction": "ltr",
  "fallback": "en",
  "messages": {
    "meta": { "title": "..." },
    "common": { "save": "..." }
  }
}
```

## Storage

```text
app/storage/i18n/<locale>.json     # messages, outside public
TranslationPack table              # metadata, status, checksum, version
```

Metadata:

```text
locale, name, nativeName, direction, fallback,
checksum, status (ACTIVE/INACTIVE), version,
createdAt, updatedBy
```

Atomic write: temp file → validate → rename. Backup `storage/i18n` with DB.

## Validation

Reject if:

- invalid locale/schema;
- missing any key present in the base catalog (`ru` or `en` — choose one canonical base);
- extra unknown keys (phase 1 strict);
- placeholder mismatch (e.g. `{count}`, `{date}`);
- file > 1 MB, nesting > 8 levels;
- `__proto__`, `constructor`, `prototype` keys;
- invalid JSON/UTF-8;
- HTML/script injection patterns in message values (React escaping remains defense-in-depth).

ADMIN UI shows:

- coverage 100% or exact missing keys;
- placeholder errors;
- preview sample strings;
- activate/deactivate/delete.

## Runtime loading

- Built-in locales: static imports in `src/i18n/messages/*.json`.
- Custom locales: server-side `fs.readFile` from `storage/i18n`; cache by `{locale, checksum}`.
- Do not use dynamic `import()` with user-controlled path.
- `getRequestConfig` chooses built-in map or custom loader.
- `isLocale` becomes `isInstalledLocale`; dynamic list from built-ins + active packs.
- `LOCALE_LABELS` becomes a runtime map.
- Cookie/setting/user preference must reference an installed locale; otherwise fallback.

## Server and mobile

- Same messages feed admin and mobile.
- `<html lang/dir>` from resolved locale.
- Language selector includes active custom packs.
- PWA:
  - service worker cache key includes locale + pack checksum/version;
  - custom pack is cached for offline use;
  - activating a new version invalidates old cache;
  - manifest `lang` follows locale.
- Excel/report labels: custom pack must include report namespace; otherwise fallback.
- Server errors: machine codes; localized via pack; no raw Russian for custom locale.

## Permissions and audit

- New permission `settings.i18n` (ADMIN).
- Upload/activate/delete logged in `LogEvent` with checksum, not file contents.
- No public upload endpoint; tRPC admin only.

## Tests

- Valid `pt-BR` pack accepted; UI renders it.
- Missing key rejected; placeholder mismatch rejected.
- `__proto__` rejected.
- Upload path traversal rejected.
- Activate/deactivate/delete; fallback after delete.
- Admin ru + maid custom locale concurrently.
- Mobile offline uses cached pack.
- Existing six-locale test updated to built-in + custom, not fixed list.
- Backup/restore includes pack.

## Acceptance

- Upload valid pack; activate; all pages render; `html lang=pt-BR`.
- Invalid pack cannot be activated.
- PWA offline shows selected custom language.
- No source rebuild required.
- Existing tests + new pack tests + build green.

## Later (not approved)

- Partial packs with coverage UI.
- RTL (`ar`, `he`) and logical CSS audit.
- XLIFF 2.0/CSV import.
- Per-tenant packs.
