# Account Key & Group Key — product spec

**Status:** Locked decisions + implementation guide  
**Constraint:** Existing local data (IndexedDB spaces, sessions, private notes, prayer board) is never wiped by this feature. Keys are additive.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Who may regenerate Group Key | **Host only** (immediate; no votes) |
| Sign-off threshold | **None** — host regenerates when needed |
| Private notes encryption | **Same Account Key** |
| After Group Key rotate | **Auto-issue new short join code** |
| Email/password accounts | **Never** |
| Hard download/import | **Always available** |
| Key dismiss gate | User-initiated download + acknowledgements before Done |

## Modes (online-first Spaces)

1. **Account Key (personal home)** — *your* Spaces live encrypted under this key (auto vault upload when Online). Link key on another device to restore. Not a login; not required for guests to Join a room.
2. **Group room key** — host creates/opens a group online → short room key (join code). One room per Space id. Guests **only Join**. Room is collaboration only, not personal recovery.
3. **Host** — Space creator; opens the room; can regenerate Group Key + new join code.
4. **Offline + hard backup** — Offline mode pauses sync after you’re linked; DSX1/DSP1 remain the safety net.

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
- **Regenerate:** host only, immediate (no multi-member vote). Guests re-Join with the new room key if they lost the link.
- On complete: new Group Key on host device, **new short join code** when room is connected; old join code invalid, old Group Key invalid.
- Member add/remove: host only. Nudge after member remove: suggest regenerate.

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
- **Group Key** create / view / regenerate works on-device for the host only; regenerate completes immediately and rotates the room key when connected.
- Raw Group Key never sent to the relay; only optional hash after rotate. New join code via `POST /rooms/:id/rotate-code`.

## UI copy principles

- Say **Account Key / Group Key / Backup**, not password / login.
- No “forgot key” email — only backup file or re-join.
