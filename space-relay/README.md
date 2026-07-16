# DiscipleSpaces Space relay

Light Cloudflare Worker + Durable Object for **shared** Space data only.

- Private notes are rejected if present in any payload.
- Host **Connect** → `POST /rooms` with a shared snapshot → short code.
- Guest **Join** → `POST /rooms/join` with short code + name.
- **Sync** → `GET/POST /rooms/:roomId`.

## Preview vs product

- **App preview** (`*.pages.dev`) is fine until full product domain.
- Deploy this Worker separately; point the app at it with:

```bash
# Pages / Vite build env
VITE_SPACE_RELAY_URL=https://disciple-spaces-relay.<your-subdomain>.workers.dev
# Optional later:
# VITE_CANONICAL_ORIGIN=https://disciplespaces.app
```

Without `VITE_SPACE_RELAY_URL`, the app stays fully local; Connect explains that easy join is not on this build.

## Deploy

```bash
cd space-relay
npm install
npx wrangler login   # once
npm run deploy
```

Then rebuild the app with `VITE_SPACE_RELAY_URL` set and redeploy Pages.

## Pilot feedback inbox

Testers use **Report a problem** in the app → `POST /feedback`.

**Store:** Durable Object `FeedbackInbox` (last 200). Also logs to `wrangler tail`.

**List reports (you only):**

```bash
# secret already set on deploy machine; rotate with:
#   printf '%s' "$(openssl rand -hex 16)" | npx wrangler secret put FEEDBACK_ADMIN_SECRET
# local copy (gitignored): .admin-secret.local

set -a && source .admin-secret.local && set +a
curl -sS "https://disciple-spaces-relay.mck3nz1-chantz.workers.dev/feedback?secret=${FEEDBACK_ADMIN_SECRET}&limit=40" | jq
```

Or live stream while testing: `npx wrangler tail` (look for `pilot_feedback` logs).

Never contains private notes (rejected if present).

## Join codes

Short codes look like `ABCD-EF`. Lookup is **hyphen-insensitive** (`ABCDEF` and `ABCD EF` work). New rooms bind under the normalized key; resolve also tries the legacy hyphenated key for rooms created before that fix.

## Common “can’t sync” causes

1. Guest typed offline **reference** invite code instead of Connect **join** code → invalid code.
2. Host and guest each pressed **Connect** on their own copy → two different rooms (orphaned). Fix: only the host Connects; guests **Join a group** with the host’s code.
3. Older app builds skipped updating existing sessions on pull (add-only import). Relay pull now uses replace-shared merge.

## CORS

Worker reflects request `Origin` for browser calls from pages.dev / localhost / future custom domain.
