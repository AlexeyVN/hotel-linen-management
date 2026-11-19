# Stage 0 + Stage 1 — demand validation and personal language

Status: **pending approval**  
Purpose: confirm the market before building API/translation packs; make server and maid devices independently multilingual.

## Stage 0 — demand validation (no code)

Duration: 1 week.  
Owner: product/lead, not an implementation agent.

### Steps

1. Interview 5–10 hotels with 5–100 rooms.
2. Record:
   - room count;
   - PMS: Cloudbeds / Mews / Apaleo / Oracle / 1C / Excel / none;
   - internet availability and quality;
   - staff languages and devices;
   - who needs a different language: admin, maid, manager;
   - willingness to pay for PMS integration.
3. Select **one** PMS pilot candidate; do not build four adapters.
4. Define one concrete PMS scenario:
   - room status sync;
   - or housekeeping task creation.
5. Decide whether “API on request” is needed now or only after a paying pilot.

### Exit criteria

- At least one real hotel or PMS partner confirms a scenario.
- If no demand: stop API work; keep local product and per-user language.
- Written decision: `docs/plans/decisions/stage-0.md`.

## Stage 1 — per-user and per-device locale

Duration: 3–5 days.  
Goal: admin can use Russian, maid English on the same server, without changing the installation default.

### Current defect

`app/src/i18n/get-locale.ts` resolves:

```text
Setting ui.locale → cookie NEXT_LOCALE → env → en
```

Because `Setting` is first and global, a maid cannot override the admin’s language. This must change.

### Target model

```text
locale =
  authenticated user.locale
  ?? device cookie NEXT_LOCALE
  ?? installation default (Setting ui.locale)
  ?? env APP_DEFAULT_LOCALE
  ?? "en"
```

- `Setting ui.locale` becomes **default for new/unset users**.
- `User.locale` is optional and personal.
- `NEXT_LOCALE` covers login/first render and devices without an authenticated preference.

### Data model

- Migration: `User.locale String?`.
- No per-tenant locale in stage 1.
- Keep `Setting ui.locale` for installation default.
- `users.setMyLocale` mutation; `settings.setDefaultLocale` remains ADMIN-only.
- Existing `settings.setLocale` either renamed or kept as default; do not silently change its semantics without UI copy.

### Server resolution

- Add `resolveLocaleForRequest()` in `src/i18n/`.
- Do not use a module-global `cache()` for locale; it is per-request, not per-user.
- Use the authenticated user when available; cookie fallback for pre-login.
- Store locale in JWT/session to avoid a DB query on every request; update cookie/session after a language change.
- `app/src/i18n/request.ts` uses the resolver, not the global `getConfiguredLocale`.
- `<html lang>` and `dir` follow resolved locale.
- Excel/PDF/report exports use the current user’s locale; API errors use `Accept-Language` + machine error codes.

### UI

- Admin: profile/settings language selector → personal locale.
- Admin: installation default language selector → ADMIN only.
- Mobile `/m/more`: language selector for maid; no admin permission required.
- Language list: built-in 5 first; custom packs only after Stage 4.
- Changing language must not log the user out and must not change other users.

### Tests

- Admin `ru` and maid `en` concurrently on the same server: each sees own `html lang` and UI.
- Mobile device `en`, server default `ru`.
- New user without preference follows default.
- User preference survives device change (because `User.locale`).
- `NEXT_LOCALE` before login works; after login user preference wins.
- Missing translation falls back to default locale, never blank.
- PWA: locale switch online/offline; cached page does not show stale language.
- Existing 103 tests remain green.

### Acceptance

- No global switch changes all users.
- No logout on language change.
- No hardcoded locale in server components.
- `npm test` + build; Playwright smoke for two concurrent locales.
- Documented in `docs/ARCHITECTURE.md` and `docs/CONTINUATION.md`.

### Risks

| Risk | Mitigation |
|---|---|
| Cached locale leaks between users | no global cache; per-request resolver |
| JWT stale after preference change | update cookie/session or re-read gracefully |
| Cookie overrides admin default unexpectedly | explicit precedence + tests |
| PWA shows cached old language | cache key by locale/version; network-first HTML |

## Not in Stage 1

- Custom translation file upload (Stage 4).
- RTL layouts.
- Per-tenant/multi-property locale.
- OAuth2/PMS API.
