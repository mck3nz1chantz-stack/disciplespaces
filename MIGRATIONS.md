# Dexie schema migrations

DiscipleSpaces uses **Dexie versioned stores**. The ordered list lives in:

`src/lib/db/schema.ts` → `SCHEMA_MIGRATIONS`

Applied in `src/lib/db.ts` via `this.version(n).stores(...).upgrade(...)`.

## Rules

1. **Never reorder or delete** past migration versions.
2. **Only append** a new version when the schema or stored shape must change.
3. Keep indexes minimal — nested fields (`members`, `responses`) stay unindexed.
4. Document the new version in `SCHEMA_MIGRATIONS[].notes` and this file.

## Current versions

| Version | Notes |
|--------:|-------|
| 1 | Phase 0 foundations |
| 2 | Phase 1 domain (members objects, session attendees, template steps) |
| 3 | Phase 5 `inviteCode` index on spaces |
| 4 | Space templates (`spaceTemplate`, `defaultSessionTemplateId`) + session `notes` default |
| 5 | `spaceKind` (`group` \| `family`) for member capacity; private notes may store `sectionKey` / `updatedAt` |
| 6 | Shared `prayerBoard` table (individual/group scopes; included in Space Update export) |
| 7 | `space.sync` metadata (default `local-only`) + `syncQueue` table for opportunistic shared-layer push; **privateNotes never queued** |

`CURRENT_SCHEMA_VERSION` should match the highest entry.

### v7 notes (Space relay readiness)

- Existing Spaces get `{ mode: "local-only" }` on upgrade — **no data loss**, no network.
- Opt-in **Connect** writes `mode: "connected"` + `roomId` / `shortCode` when `VITE_SPACE_RELAY_URL` is set.
- File import/export (DSX1) unchanged; private notes still never leave the device.

## Adding a migration (checklist)

```ts
// src/lib/db/schema.ts
{
  version: 5,
  notes: "What changed and why",
  stores: {
    spaces: "id, name, createdAt, inviteCode, spaceTemplate",
    sessions: "id, spaceId, date, templateId",
    // ...
  },
  upgrade: async (tx) => {
    // optional data transforms
  },
}
```

Then set `CURRENT_SCHEMA_VERSION = 5` and ship.

## Live queries

UI that must stay reactive (Space timeline, session lists) can use
`dexie-react-hooks` `useLiveQuery` against `db.*` tables. Mutations still go
through the Zustand store / Dexie writes; live queries re-render automatically.
