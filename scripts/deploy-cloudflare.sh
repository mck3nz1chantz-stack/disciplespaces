#!/usr/bin/env bash
# Deploy DiscipleSpaces to Cloudflare Pages
# Usage: ./scripts/deploy-cloudflare.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_SLUG="disciple-spaces"

echo "==> Building production assets…"
npm run build

if [[ ! -d dist ]]; then
  echo "Error: dist/ missing after build" >&2
  exit 1
fi

echo "==> Deploying dist/ to Cloudflare Pages (${PROJECT_SLUG})…"
npx wrangler pages deploy dist --project-name="${PROJECT_SLUG}"

echo "==> Done."
