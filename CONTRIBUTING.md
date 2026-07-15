# Contributing

Thanks for your interest in contributing to the Decentralized Global Education & Skills Passport monorepo.

This document covers development setup, branch conventions, code style, testing, PR expectations, and the release process.

---

## Table of contents

- [Development setup](#development-setup)
- [Branch conventions](#branch-conventions)
- [Commit messages](#commit-messages)
- [Code style](#code-style)
- [Testing](#testing)
- [Pull request checklist](#pull-request-checklist)
- [CI workflows](#ci-workflows)
- [Release process](#release-process)
- [Need help?](#need-help)

---

## Development setup

### Prerequisites

| Tool | Version | Required for |
|------|---------|--------------|
| [Node.js](https://nodejs.org) | `>=22` | All TypeScript/JS packages |
| [pnpm](https://pnpm.io) | `10.13.1` | Package management (monorepo) |
| [Rust](https://rustup.rs) | stable + `wasm32v1-none` | Contract compilation (optional for most work) |
| [Stellar CLI](https://github.com/stellar/stellar-cli) | latest | Contract build, bindings generation, testnet deploys |

### Clone and install

```bash
git clone https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport.git
cd decentralized-global-education-skills-passport

# Install all workspace dependencies
pnpm install
```

> If you're only working on TypeScript packages (SDK, tlock, bindings, web UI),
> Rust and the Stellar CLI are **not required**. Tests that rely on live contract
> bindings use committed fixtures and generated types.

### Environment

Most development doesn't require any `.env` file. The web UI works from an
embedded demo trace. For testnet e2e scripts that need Stellar keys, see
[`docs/DEPLOY.md`](./docs/DEPLOY.md).

Copy the template if you need to configure local variables:

```bash
cp .env.example .env
# Never commit .env — it's in .gitignore
```

---

## Branch conventions

Branches follow the pattern `<type>/<short-kebab-description>`:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New features or user-facing changes | `feat/verifier-ui` |
| `chore/` | Maintenance, docs, tooling, CI | `chore/docs-historical-preambles` |
| `fix/` | Bug fixes | `fix/receipt-encoding-edge-case` |
| `ci/` | CI/CD changes only | `ci/speed-up-bindings-check` |

Branch from `main` and open pull requests against `main`.

---

## Commit messages

This project uses **Conventional Commits**. Each commit message must be
structured as:

```
<type>(<optional-scope>): <imperative-description>
```

Common types:

| Type | When to use |
|------|-------------|
| `feat` | A new feature (corresponds to a minor version bump) |
| `fix` | A bug fix (corresponds to a patch version bump) |
| `chore` | Maintenance, refactoring, documentation, tooling |
| `docs` | Documentation-only changes |
| `ci` | CI/CD configuration changes |
| `test` | Adding or updating tests |

Scopes are the workspace package or area (e.g., `web`, `sdk`, `tlock`,
`keeper`, `docs`, `auction-template`).

Examples:

```
feat(web): add receipt verification page
fix(sdk): handle empty bidder index in exportReceipt
chore(docs): add deploy security headers section
ci: use pnpm 10.13.1 in npm-publish workflow
test(tlock): add round-trip test for auditor blob
```

---

## Code style

### TypeScript

- **Strict mode** — all packages enable `"strict": true` in their
  `tsconfig.json`.
- **No `any`** — avoid `as any` and `as unknown` casts in production code.
  Test files may use them sparingly with justification.
- **No `@ts-ignore` or `@ts-expect-error`** — these are banned in production
  code. If a type error can't be resolved, the type definition likely needs
  fixing upstream.
- **No `console.log`** — use `console.error` for errors and structured logging.
  Test files may use `console.log` for diagnostics.
- **No TODO/FIXME/HACK markers** — commit message or a GitHub issue is the
  right place for tracked work. Inline TODO markers accumulate and become
  noise (see the [codebase audit](https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport#status)).
- **ES modules** — all packages use `"type": "module"`. Use `import`/`export`,
  not `require`. File extensions in imports are required (`.js`, `.ts` when
  resolved by tsx).
- **Node built-ins** — use `node:` prefix for Node.js built-in imports (e.g.,
  `import { createHash } from "node:crypto"`).

### Rust

- Follow standard Rust formatting (`rustfmt`).
- Error codes are documented in [`contracts/round/ERRORS.md`](./contracts/round/ERRORS.md)
  and are enforced by tests.

### Documentation

- Markdown link paths must be relative and valid — checked by the
  `Docs link check` CI workflow.
- API changes in `packages/sdk/` should be reflected in the SDK README and
  the public API snapshot test (`public-api-snapshot.test.ts`).

---

## Testing

### Run all TS tests

```bash
pnpm sdk:test            # 87 tests — SDK core + preflight + receipt verification
pnpm tlock:test          # 32 tests — tlock seal/open, auditor blob, Drand round-trip
pnpm bindings:test       # 17 tests — event-snapshot drift, decoder, normalization
pnpm web:test            # 51 tests — UI components + verification page
pnpm keeper:test         # 63 tests — watch loop, settlement guard, status API
pnpm appraisal:test      # 38 tests — valuation, fixtures, drift guard
pnpm agent:test          # 10 tests — mandate creation/verification, cap enforcement
pnpm template:test       # smoke test — fixture-based sealed auction verification
```

### Run Rust contract tests

Requires Rust + `wasm32v1-none` target + Stellar CLI:

```bash
pnpm contract:test       # 14 Rust tests
```

### Run typechecks

```bash
pnpm sdk:typecheck
pnpm tlock:typecheck     # (tlock has no root script; use pnpm --filter skills-passport-tlock typecheck)
pnpm bindings:typecheck
pnpm web:typecheck
pnpm appraisal:typecheck
pnpm agent:typecheck
```

### Snapshot and fixture integrity

```bash
pnpm snapshot:check      # Contract test snapshot drift
pnpm bindings:check       # Generated TS bindings match the compiled WASM
pnpm docs:check           # Deploy doc consistency
pnpm docs:check-links     # Local markdown link validity
pnpm threat-model:check   # Threat model anchor references
```

### E2E tests (testnet, requires funded keys)

```bash
pnpm lifecycle:e2e        # USDC, 2 bidders, keeper settle → 0
pnpm agents:e2e           # x402 + mandate + keeper reveal + settle → single UI trace
pnpm appraisal:e2e        # HTTP 402 → on-chain USDC settle
```

---

## Pull request checklist

Before opening a PR, verify the following:

### Required

- [ ] TypeScript packages pass `typecheck` for all affected workspaces
- [ ] Tests pass for all affected workspaces
- [ ] New or changed behavior has corresponding tests
- [ ] Commit messages follow [Conventional Commits](#commit-messages)
- [ ] PR targets the `main` branch

### If you added a dependency

- [ ] The dependency is necessary (no unused or duplicate deps)
- [ ] The package.json version range matches the monorepo convention (`^major.minor.0`)
- [ ] For Node.js polyfills in the web app: verify they're actually imported
  (see the [polyfill audit](https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport#status))

### If you changed the SDK public API

- [ ] The public API snapshot test (`packages/sdk/src/public-api-snapshot.test.ts`)
  is updated to reflect new exports
- [ ] The SDK README quick-start and method tables are updated
- [ ] The per-package READMEs (SDK, tlock, round-bindings) are in sync

### If you changed the contract or bindings

- [ ] `pnpm bindings:check` passes (generated TS bindings match the WASM)
- [ ] The event-snapshot golden fixture is updated
- [ ] Snapshot drift tests (`pnpm snapshot:check`) pass

### If you changed fixtures or test data

- [ ] Fixture integrity checks pass (`pnpm docs:check`, fixture drift guards)

### If you changed documentation

- [ ] `pnpm docs:check-links` passes (all markdown links are valid)

---

## CI workflows

| Workflow | Trigger | What it checks |
|----------|---------|----------------|
| **Bindings check** | Push/PR to `main` (any path) | Rust contract → WASM → generated TS bindings match committed ones |
| **Examples typecheck** | Push/PR touching `examples/` or `packages/` | `tsc --noEmit` for `grant-scoring` example |
| **Fixture drift guard** | Push/PR touching `appraisal-api/` | Fixture hashes stay in sync with canonical serializers |
| **Docs link check** | Push/PR touching `*.md` | All local markdown links resolve (no 404s) |
| **Release** | Push to `main` | Creates Version Packages PR or publishes to npm |

---

## Release process

This project uses [Changesets](https://github.com/changesets/changesets) for
version management and publishing. See [`RELEASE_GUIDE.md`](./RELEASE_GUIDE.md)
for detailed instructions.

Quick summary:

```bash
# During development, create a changeset for any meaningful change
pnpm changeset
# Follow the prompts — select packages and describe the change

# Commit the changeset file
git add .changeset/<name>.md
git commit -m "chore: add changeset"

# Push to main — CI handles the rest
git push origin main
```

The three publishable packages
([`skills-passport-sdk`](packages/sdk),
[`skills-passport-tlock`](packages/tlock),
[`round-bindings`](packages/round-bindings))
are versioned together as a fixed group. A changeset touching any one of them
bumps all three.

---

## Need help?

- **Architecture**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system overview, lifecycle, trust boundaries
- **Crypto design**: [`docs/TECH_DESIGN.md`](./docs/TECH_DESIGN.md) — tlock, BLS, settlement
- **Threat model**: [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md) — adversaries and mitigations
- **Deployment**: [`docs/DEPLOY.md`](./docs/DEPLOY.md) — env vars, hosting, security headers
- **Limitations**: [`docs/LIMITATIONS.md`](./docs/LIMITATIONS.md) — honest scope boundaries

For questions, open a [GitHub Discussion](https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/discussions)
or file an issue.
