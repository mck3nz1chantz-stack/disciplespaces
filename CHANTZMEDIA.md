# ChantzMedia Project

**Project:** DiscipleSpaces

This workspace is a **ChantzMedia project**. When you see this file (or the user says `ChantzMedia`), operate as the ChantzMedia project hub.

## Key reference

**Paths, folder layout, and canonical commands:** `$LAUNCHER/PATHS.md` (launcher read-only; default `~/Desktop/ChantzMediaLauncher/PATHS.md`)

## Launcher (read-only by default)

Load rules, templates, skills, and guardrails from `$LAUNCHER` — see `PATHS.md` § Roots. **Do not modify the launcher** unless the user gives explicit permission (`PERMISSIONS.md`).

## Modules

Route every task to one primary module. GrokLaw audits and can block — it does not execute work.

| Module | Role | Entry |
|--------|------|-------|
| **GrokBuild** | Coding, technical work, basic compliance | `GrokBuild/GROKBUILD_CORE.md` |
| **GrokDocs** | Document generation from build state | `GrokDocs/GROKDOCS_CORE.md` |
| **Document Design** | Polish + format after GrokDocs | `skills/grokbuild-document-design/SKILL.md` |
| **Document Deployment** | Local PDF package + fillable Client Form (not web deploy) | `skills/grokbuild-document-design/SKILL.md` |
| **vite-dev-guard** | Vite dev-server diagnostics | `skills/vite-dev-guard/SKILL.md` |
| **site-perf-guard** | Site performance & basic SEO audit | `skills/site-perf-guard/SKILL.md` |
| **GrokLaw** | Pre-build consult, doc review, compliance gates | `GrokLaw/GROKLAW_CORE.md` |

Pipeline order: see `PATHS.md` § Pipeline order

Use `MODULE_ROUTER.md` and `WORKFLOW.md` in the launcher for routing and gate order.

## Project standards

- **GrokLaw registry** — see `PATHS.md` § GrokLaw filing
- **Build handoff** — GrokBuild updates `build-state.json` before GrokDocs runs
- **Document design** — polished deliverables go to `docs/final/` with format manifest
- **Document Deployment (Option A)** — when `documentDeployment.mode` is `local-pdf`, Grok **automatically** runs `build-doc-package.js` after GrokLaw PASS. See `DOCUMENT_DEPLOYMENT_ROUTER.md` and `PATHS.md` § Document Deployment.

## Activation

Minimal trigger — any of these is enough:

```
ChantzMedia
```

Or open this project and start talking naturally. Grok infers the module from the request. For explicit module focus, the user can say `build`, `docs`, `law`, or use shorthand flows (`DocPipeline`, `DocFinish`, `BuildLaw`, `URLCheck`, `vite-guard`, `site-perf-guard`, `FullSlice`) from `ACTIVATION_PROMPTS.md`.

## Workspace

Project folder layout: see `PATHS.md` § Project workspace layout