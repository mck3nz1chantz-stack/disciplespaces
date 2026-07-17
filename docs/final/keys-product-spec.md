# Account Key & Group Key — product spec

**Status:** Locked decisions + implementation guide  
**Constraint:** Existing local data (IndexedDB spaces, sessions, private notes, prayer board) is never wiped by this feature. Keys are additive.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Who may propose Group Key regenerate | **Any member** |
| Sign-off threshold | **All members** (unanimous) |
| Private notes encryption | **Same Account Key** |
| After Group Key rotate | **Auto-issue new short join code** |
| Email/password accounts | **Never** |
| Hard download/import | **Always available** |
| Key dismiss gate | User-initiated download + acknowledgements before Done |

## Modes

1. **Use without keys** — default; full local app.
2. **Account Key (optional)** — same person, multiple devices; encrypts personal backup (optional private notes).
3. **Group Key (optional)** — space-level secret; regenerate with all-member sign-off; new join code on rotate.
4. **DSX1 / Restore** — always; shared-layer safety net.

## Account Key

- Format: `DS-ACC-` + base32-like secret (human-copyable).
- Generated client-side; stored only on this device after create (like a house key).
- **Regenerate:** invalidates old key (verifier replaced). Other devices must enter the new key or restore a new personal backup.
- **Cannot recover for the user** — copy, disclaimer, backup download gate.
- **Private notes:** default device-only; opt-in “include encrypted private notes in personal backup” uses Account Key (AES-GCM). Never plain on relay.

## Group Key

- Format: `DS-GRP-` + secret.
- Lives under **Space → Sharing & keys** (not global Settings).
- Short **join code** stays for inviting; Group Key for trusted re-link / after membership change.
- **Propose regenerate:** any member.
- **Approve:** every current space member must approve (in-app on their device, or “confirmed in person” on a device with disclaimer).
- On complete: new Group Key material to connected devices, **new short join code**, old join code invalid, old Group Key invalid.
- Nudge after member remove: suggest regenerate.

## Data boundaries

| Data | Default | With keys |
|------|---------|-----------|
| Private notes | Device only | Optional encrypted personal backup (Account Key) |
| Shared sessions / prayer | Local + optional DSX1 / relay | Unchanged |
| Account Key | — | localStorage this device only |
| Group Key | — | localStorage per space; server stores hash only |
| Relay payloads | No private notes | Still rejected if present |

## Non-destructive implementation rules

- No Dexie table drops; schema bumps only **append** optional fields.
- Missing Account Key / Group Key = current behavior.
- DSX1 format unchanged; personal backup is separate (`DSP1.`).
- Existing connected rooms keep working without Group Key until first create/rotate.

## MVP notes (v1)

- **Account Key** fully works offline: create, view, regenerate, personal backup with optional encrypted notes, link on another device, restore DSP1.
- **Group Key** create / view / regenerate works on-device. Unanimous “all members” approvals are recorded on the Space (including in-person “approve on behalf” with confirm). Multi-device live sign-off over the relay (syncing only hashes/approvals, not raw keys) can land later; face-to-face groups can complete on one phone.
- Raw Group Key never sent to the relay; only optional hash after rotate. New join code via `POST /rooms/:id/rotate-code`.
- Pending rotation secret stays on the **proposing device** until finalize.

## UI copy principles

- Say **Account Key / Group Key / Backup**, not password / login.
- No “forgot key” email — only backup file or re-join.
