# Stage 0 decisions → next steps for approval

> **Superseded:** Mews was rejected in favor of Apaleo. See [apaleo-connector.md](apaleo-connector.md). This file is kept for decision history only.

Status: **superseded**  
Input: hotel profile from Stage 0 (Europe/Mews, intermittent internet, German admin, Italian/Mexican maids, phones/tablets, low integration budget).

## 0. Fixed decisions

| Area | Decision |
|---|---|
| Europe PMS | **Mews only**; optional connector in the build |
| Russia PMS | **1C + Excel**; no Mews dependency |
| Internet | **Intermittent**; local core is authoritative; Mews sync is optional/queued |
| Languages | Admin **de**, maids **it/es**; `es-MX` optional later |
| Devices | iPhone, Android phones, old iPads, Android tablets |
| Price | ~€100 or ~5,000 RUB per integration; no marketplace/certification budget assumed |
| Product | Reliable local product + personal language + one PMS on request |

## 1. Critical correction: Mews is not “our API”

Mews Connector API is an **outbound** API:

- the app calls Mews with `ClientToken`, `AccessToken`, `Client`;
- Mews housekeeping flow: get all resources → map rooms → update resources;
- webhooks/WebSockets are optional and require connectivity;
- Mews requires certification/private-integration process.

Therefore:

- **Mews connector** is the first integration.
- The previously proposed `/api/v1` + API key is **not required for Mews**; keep it deferred for a different PMS/automation partner.
- Do not build both at once.

## 2. Stage 0.5 — Mews feasibility gate (1–3 days)

Before code:

1. Confirm the hotel has Mews **Connectivity Add-on / Enterprise**, otherwise Connector API access is unavailable.
2. Confirm whether a **private integration** is allowed, or marketplace certification is mandatory.
3. Get Mews **demo credentials** and test `resources/getAll`.
4. Confirm certification/partner cost and timeline; compare with €100/5,000 RUB budget.
5. Confirm outbound HTTPS and whether a public webhook URL exists; if not, use polling.
6. Confirm exact room status mapping in Mews (Dirty/Clean/Inspected/OutOfOrder).
7. Collect device models/OS versions for the old iPads/tablets.

**Stop rule:** if Mews certification/partner cost exceeds the customer budget and no private path exists, do not build the connector; offer manual Excel/1C workflow.

## 3. Stage 1 — per-user language + device baseline (3–5 days)

### Language

- Admin: **de**.
- Maids: **it**, **es** (Mexican staff).
- Installation default: German (or chosen).
- `User.locale` migration and resolver:
  ```text
  user.locale > NEXT_LOCALE > installation default > env > "en"
  ```
- Mobile `/m/more` language selector.
- `es-MX` initially maps to `es`; a separate `es-MX` pack only if dialect differences matter.
- No custom upload UI yet; built-in de/it/es already exist.

### Devices

Support matrix to test:

- iPhone Safari, current iOS;
- Android Chrome, current;
- old iPad Safari (collect exact iPadOS version);
- Android tablet Chrome;
- 390×844, 768×1024, 1024×768.

Acceptance:

- login, tasks, room status, QR scan, offline queue on each class;
- PWA install/offline on supported devices;
- if an old iPad cannot run the modern bundle, document minimum OS and use a supported fallback device.

**Risk:** Next 15/React 19 may not support very old Safari; this is a gate, not an assumption.

## 4. Stage 2 — Mews housekeeping MVP (1–2 weeks after credentials)

Scope:

1. Settings → Integrations → Mews:
   - enable/disable;
   - environment (demo/production);
   - token fields (encrypted at rest or local secret store);
   - “Test connection”;
   - last sync/status.
2. Pull `resources/getAll`, map Mews resources → local rooms.
3. Push local status via `resources/update`.
4. Optional create Mews task via `tasks/add` only if needed; not in first cut.
5. Sync every 5–15 min or on demand; **polling first**, because webhooks need a public HTTPS endpoint.
6. Offline queue: local status changes stay in outbox; push on reconnect.
7. Conflict: compare timestamps/source; do not overwrite newer local change.
8. UI: “Mews: connected / offline / last sync / pending changes”.
9. Logging: sync events, 429/408, no tokens in logs.

Mews API constraints from official docs:

- all operations are HTTP POST;
- body requires `ClientToken`, `AccessToken`, `Client`;
- request limits use sliding windows and `429 Retry-After`;
- housekeeping uses resources + update resources; webhooks/WebSockets optional.

Acceptance:

- demo Mews room list mapped;
- local status pushed to demo;
- network loss → queued → reconnect → delivered;
- 429/backoff;
- no token leakage;
- local app still works with Mews disabled.

## 5. Deferred / rejected for now

- Mews marketplace listing.
- Mews reservations/rates/folios.
- Generic `/api/v1` + API key: defer to a non-Mews integration request.
- Admin translation-pack uploader: built-in de/it/es covers the staff; `es-MX` later.
- Multi-property/tenant.
- Dependency upgrades.

## 6. Budget guard

At €100 / 5,000 RUB per integration:

- one-time private connector only;
- no marketplace certification unless customer pays;
- no ongoing cloud service;
- limit support to one Mews property;
- manual setup with customer-provided Mews tokens.

## 7. Approval questions

1. Approve **Mews connector** instead of generic API as the first integration.
2. Approve **polling** first; webhooks only if a public HTTPS endpoint exists.
3. Approve de/it/es per-user language; `es-MX` later.
4. Approve device baseline: collect old iPad/Android OS; if unsupported, document minimum.
5. Approve Stage 0.5 certification/cost gate before coding.
6. Confirm Mews subscription/Connectivity Add-on and demo credentials.
