# Deploy & environment variables

Decentralized Global Education & Skills Passport **does not require a committed `.env` file**. Secrets stay out of git; you inject them where each layer runs.

## Three layers

| Layer | Needs env? | When vars are read |
| --- | --- | --- |
| **Jury UI** (`apps/web`) | Optional | **Build time** (`VITE_*` baked into static JS) |
| **Keeper / appraisal API** | Yes (secrets) | **Runtime** (shell, systemd, Fly/Railway secrets) |
| **One-off scripts** (deploy, e2e) | Yes | **Runtime** (inline `VAR=… command` or CI secrets) |

---

## 1. Jury UI — ship without any env

The demo works from **embedded `DEMO_TRACE`** (`demo-trace.generated.ts` from `pnpm agents:e2e`). No `.env` needed.

```bash
pnpm install
pnpm web:build
# static output → apps/web/dist
```

Host `dist/` on Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3, etc.

**Build settings (generic):**

| Setting | Value |
| --- | --- |
| Install | `pnpm install` |
| Build | `pnpm web:build` |
| Output directory | `apps/web/dist` |
| Node | 22+ |

---

## 2. Jury UI — optional live contract poll

Only if you want **“Poll live contract”** on the deployed site, set these **before `pnpm web:build`** in the hosting UI (Vercel → Settings → Environment Variables, etc.).

Copy from `apps/web/.env.example`:

```bash
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_CONTRACT_ID=CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y
VITE_ROUND_ID=1
```

**Mainnet example** (live poll against mainnet smoke):

```bash
VITE_RPC_URL=https://rpc.ankr.com/stellar_soroban
VITE_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
VITE_CONTRACT_ID=CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX
VITE_ROUND_ID=1
```

Important: Vite only exposes vars prefixed with `VITE_`. They are **public** in the browser bundle — never put secret keys here.

### Local dev (optional)

```bash
cp apps/web/.env.example apps/web/.env.local
# edit VITE_* then:
pnpm web:dev
```

`.env.local` is gitignored; not required for production.

---

## 3. Keeper watch mode (runtime secrets)

Runs on a server/VM, not in the static site. No `.env` file required — export vars in the process manager:

```bash
export KEEPER_SECRET="S…"
export ROUND_CONTRACT_ID="C…"
export RPC_URL="https://soroban-testnet.stellar.org"
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export WATCH_POLL_MS=15000
export WATCH_ROUND_IDS=1

pnpm keeper:watch
```

Or one line:

```bash
KEEPER_SECRET=S… ROUND_CONTRACT_ID=C… pnpm keeper:watch
```

For a read-only preflight of one round, no signing secret is required:

```bash
KEEPER_DRY_RUN=true ROUND_CONTRACT_ID=C… ROUND_ID=1 pnpm --filter @decentralized-global-education-skills-passport/keeper start
```

The command prints a structured JSON summary with the round status, Drand
round, bidder/revealed counts, current phase, and next action. It exits without
submitting open, reveal, clear, settle, or void transactions.

On Fly.io / Railway / GitHub Actions: put the same names in **Secrets**, not in the web build.

See root `.env.example` for the full keeper variable list.

---

## 4. Deploy & settle scripts (runtime, inline)

Scripts read env at invocation — no `.env` file on disk:

```bash
OPERATOR_SECRET=S… pnpm mainnet:deploy

OPERATOR_SECRET=S… \
ROUND_CONTRACT_ID=CA7KSDEY… \
RPC_URL=https://rpc.ankr.com/stellar_soroban \
pnpm mainnet:settle
```

E2E scripts (`lifecycle:e2e`, `agents:e2e`) generate ephemeral keys via Stellar CLI — they do not need a root `.env` either.

---

## 5. Appraisal API (if you host it)

Runtime env for `pnpm appraisal:start`:

| Var | Purpose |
| --- | --- |
| `FACILITATOR_SECRET` | Signs/submits x402 settle txs |
| `PAY_TO` / server key | Receives USDC |
| `X402_NETWORK` | `stellar:testnet` (default) or `stellar:pubnet` |
| `NETWORK_PASSPHRASE` | Optional; when set, must match `X402_NETWORK` |
| `RPC_URL` | Soroban RPC; required for pubnet |
| `PAYMENT_ASSET` | SEP-41 contract; defaults to USDC for the selected network |
| `PRICE` | Appraisal price (default 0.10) |
| `PORT` | HTTP port (default 4021) |

Minimal local/testnet configuration:

```bash
export FACILITATOR_SECRET="S…"
export PAY_TO="G…"
export X402_NETWORK="stellar:testnet"
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

pnpm appraisal:start
```

Testnet defaults to the canonical testnet USDC contract, Soroban testnet RPC,
price `0.10`, and port `4021`. For pubnet, set
`X402_NETWORK=stellar:pubnet`, the public-network passphrase, and an explicit
`RPC_URL`; the default payment asset then changes to pubnet USDC.

Configuration errors fail before the HTTP server starts and name the affected
variable, for example:

```text
FACILITATOR_SECRET: missing required env var
PRICE: must be a finite number greater than 0
X402_NETWORK: unsupported network "stellar:mainnet"
NETWORK_PASSPHRASE: does not match X402_NETWORK=stellar:testnet
RPC_URL: is required when X402_NETWORK=stellar:pubnet
```

Agents point at the public URL via `X402_APPRAISAL_URL` — not baked into the web UI.

---

## Quick decision tree

```
Shipping jury demo only?
  → pnpm web:build, upload dist/, no env

Want live on-chain overlay on the site?
  → set VITE_* in hosting build env, then build

Running keeper 24/7?
  → KEEPER_SECRET + ROUND_CONTRACT_ID on the server (runtime)

Deploying new contract round?
  → OPERATOR_SECRET inline for mainnet:deploy / mainnet:settle
```

## Mainnet scripts

```bash
pnpm mainnet:ready -- --strict       # consolidated read-only readiness
pnpm mainnet:verify              # read-only — no secrets
pnpm mainnet:micro               # dry-run checklist
MAINNET_CONFIRM=SKILLS_PASSPORT_MAINNET OPERATOR_SECRET=S… BIDDER_SECRET=S… \
  pnpm mainnet:micro -- --execute   # optional micro commit (≤1 XLM escrow)
MAINNET_CONFIRM=SKILLS_PASSPORT_MAINNET KEEPER_SECRET=S… ROUND_CONTRACT_ID=C… \
  pnpm mainnet:settle               # keeper settle (requires readiness + confirm)
```

### Mainnet launch checklist

1. Run `pnpm mainnet:ready -- --strict` (no secrets required for baseline checks).
2. Run `pnpm mainnet:verify` to confirm settled round 1 matches frozen artifacts.
3. Optional balance review: `pnpm mainnet:ready -- --with-balances` with funded operator/keeper secrets in env.
4. For value-moving commands, set `MAINNET_CONFIRM=SKILLS_PASSPORT_MAINNET` and re-run readiness implicitly via deploy/micro/settle guards.
5. After settlement, confirm contract native XLM SAC balance is **0** (settle script enforces this).

## 6. Passport contract Testnet deployment & migration

The project preserves the legacy `2026-10-27` deployment while running the hardened contract as a separate verified Testnet instance:

- **Hardened (`2026-11-11`, active frontend/verifier default):** `CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2` ([`contracts/passport/deployed-testnet-hardened.json`](../contracts/passport/deployed-testnet-hardened.json)), WASM SHA-256 `f7975920f377927af8d803f87df3a3ade4e84cc012835868f004eca4105888bf` (verified against local release build, 17 confirmed Testnet lifecycle transactions).
- **Legacy (`2026-10-27`, preserved unmodified):** `CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5` ([`contracts/passport/deployed-testnet.json`](../contracts/passport/deployed-testnet.json)), WASM SHA-256 `f7f29f6c3ab6f0e3524605b7d3bb1ff41c1de7fb015973719f50aed5ce480610`.

| Var | Purpose |
| --- | --- |
| `PASSPORT_CONTRACT_ID` | Optional existing contract ID for post-deploy / E2E scripts |
| `PASSPORT_ADMIN_SECRET` | Administrator `S…` signing key for initializing or administering the new deployment |
| `PASSPORT_ISSUER_SECRET` | Optional institution `S…` signing key |
| `CONFIRM_TESTNET_DEPLOY` | Set to `1` alongside `--execute` to broadcast live Testnet txs |
| `CONFIRM_OVERWRITE_DEPLOYED` | Must be `1` to overwrite `contracts/passport/deployed-testnet.json` (leave unset so legacy `CAP3J5...` stays untouched) |
| `ALLOW_EPHEMERAL_KEYS` | Set to `1` only if intentionally funding fresh ephemeral Testnet Friendbot keys for isolated testing |

### Verification & redeployment steps

1. **Verify both live Testnet contracts and manifest separation (read-only):**
   ```bash
   pnpm passport:check
   pnpm passport:deploy:test
   pnpm passport:verify:testnet:hardened
   pnpm passport:verify:testnet
   ```

2. **Preflight before any new Testnet deployment:**
   ```bash
   pnpm passport:deploy:testnet -- --dry-run
   pnpm passport:lifecycle:testnet -- --dry-run
   ```
   Dry-run mode performs **no** Friendbot calls and **no** ledger writes. It validates local WASM exports (`initialize`, `propose_admin`, `accept_admin`, `pause`, `unpause`, `rotate_issuer_key`, `get_learner_credentials_page`) and enforces overwrite locks protecting [`contracts/passport/deployed-testnet.json`](../contracts/passport/deployed-testnet.json).

3. **Optional custom deployment + frontend override:**
   ```bash
   CONFIRM_TESTNET_DEPLOY=1 PASSPORT_ADMIN_SECRET=S… \
     pnpm passport:deploy:testnet -- --execute

   VITE_PASSPORT_CONTRACT_ID=C… pnpm web:build
   ```
   Never commit private keys or alter [`contracts/passport/deployed-testnet.json`](../contracts/passport/deployed-testnet.json) without explicit release approval.

## Security headers

The project ships security-hardened HTTP response headers for the three major
static hosting platforms. The headers are identical across all three so
behavior is consistent regardless of where the site is deployed.

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | HTTPS-only for one year, preload-ready |
| `X-Frame-Options` | `DENY` | Prevents clickjacking — site cannot be embedded in iframes |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends origin-only for cross-origin requests |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Disables camera, mic, location; opts out of FLoC |
| `Content-Security-Policy` | See below | Restricts resource loading to trusted origins |

The CSP allows:
- **Scripts:** same-origin only (`script-src 'self'; object-src 'none'` — no `'unsafe-inline'`)
- **Styles:** same-origin + Google Fonts
- **Fonts:** Google Fonts CDN
- **Connections:** Soroban RPC endpoints, Drand quicknet beacons
- **Frames:** the site cannot be embedded anywhere (`frame-ancestors 'none'`)

### Platform config files

| File | Platform |
|---|---|
| [`apps/web/public/_headers`](../apps/web/public/_headers) | **Netlify** and **Cloudflare Pages** — auto-served by Vite into `dist/`, read natively by the hosting platform |
| [`apps/web/vercel.json`](../apps/web/vercel.json) | **Vercel** — security headers + SPA fallback rewrites |
| [`apps/web/vite.config.ts`](../apps/web/vite.config.ts) | **Dev server** — same security headers applied locally |

### Adding a new RPC endpoint to the CSP

If you deploy with a custom Soroban RPC URL that differs from the defaults,
add it to the `connect-src` directive in all three config files above.

```bash
# Example: add a custom RPC endpoint
# Edit apps/web/public/_headers  (Netlify / Cloudflare)
# Edit apps/web/vercel.json      (Vercel)
# Edit apps/web/vite.config.ts    (dev server)
```

### Override for GitHub Pages / S3

GitHub Pages and S3 do not support custom response headers through config
files. To set security headers on those platforms, configure them at the CDN
or reverse-proxy layer (CloudFront, Cloudflare, Fastly, etc.).

## Secrets

- **Never** commit `.env` with secrets (already in `.gitignore`).
- **Never** put `S…` secret keys in `VITE_*` — they end up in public JS.
- Rotate any key that was pasted in chat or logs.
