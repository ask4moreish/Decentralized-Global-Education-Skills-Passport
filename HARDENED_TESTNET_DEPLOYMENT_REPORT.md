# Hardened Testnet Deployment & Verification Report — Education & Skills Passport

**Repository:** `https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport`  
**Deployment Evidence File:** [`contracts/passport/deployed-testnet-hardened.json`](./contracts/passport/deployed-testnet-hardened.json)  
**Preserved Legacy Manifest:** [`contracts/passport/deployed-testnet.json`](./contracts/passport/deployed-testnet.json) (`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5`)  
**Deployment Timestamp (UTC):** `2026-11-11T07:59:17.973Z`  
**Compiler & Build Profile:** `rustc 1.97.1 (8bab26f4f 2026-07-14)` · `cargo 1.97.1 (c980f4866 2026-06-30)` · Target `wasm32v1-none` · `--release` (`[optimized]`)

---

## 1. Old vs. New Stellar Testnet Contract Instances

| Attribute | Legacy Pre-Hardening Instance (`2026-10-27`) | Newly Deployed Hardened Instance (`2026-11-11`) |
| --- | --- | --- |
| **Contract ID** | [`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5`](https://stellar.expert/explorer/testnet/contract/CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5) | [`CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2`](https://stellar.expert/explorer/testnet/contract/CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2) |
| **Manifest File** | [`contracts/passport/deployed-testnet.json`](./contracts/passport/deployed-testnet.json) (**preserved unmodified**) | [`contracts/passport/deployed-testnet-hardened.json`](./contracts/passport/deployed-testnet-hardened.json) |
| **On-Chain WASM SHA-256** | `f7f29f6c3ab6f0e3524605b7d3bb1ff41c1de7fb015973719f50aed5ce480610` | `f7975920f377927af8d803f87df3a3ade4e84cc012835868f004eca4105888bf` |
| **Matches Current Source WASM** | **No** (pre-hardening build; `is_paused()` traps with `MissingValue`) | **Yes** (verified byte-for-byte via `pnpm passport:verify:testnet:hardened`) |
| **Hardened Controls Live** | None (`set_admin` only; no pause, key rotation, batch cap, or pagination) | **Yes** (`propose_admin` / `accept_admin`, `pause` / `unpause`, `rotate_issuer_key`, `MAX_BATCH_SIZE = 50`, paginated queries) |
| **Status Classification** | **IMPLEMENTED AND VERIFIED ON TESTNET** (Read-Only + Archived History) | **IMPLEMENTED AND VERIFIED ON TESTNET** (`17` confirmed txs, `12` queries, `8` sims) |

---

## 2. Hardened WASM Artifact & Compiler Details

- **Binary Path:** `target/wasm32v1-none/release/skills_passport_core.wasm` (`42,382` bytes)
- **SHA-256 Digest:** `f7975920f377927af8d803f87df3a3ade4e84cc012835868f004eca4105888bf`
- **Build Toolchain:** `rustc 1.97.1 (8bab26f4f 2026-07-14)` / `cargo 1.97.1 (c980f4866 2026-06-30)`
- **ABI Verification:** `pnpm passport:check` confirms Soroban `contractspecv0` / `contractenvmetav0` sections, all `29` expected contract exports, all `12` SDK client target functions, and `20` `PassportError` variants (`1..=20`).

---

## 3. New Testnet Deployment Identities (Public Addresses Only)

Ephemeral Testnet accounts were funded solely via Stellar Testnet Friendbot during [`scripts/testnet-e2e-live.mjs`](./scripts/testnet-e2e-live.mjs); secret seeds (`S...`) were kept in memory only, never logged, and never written to disk (`pnpm passport:deploy:test` enforces zero `S...` matches).

- **Contract ID:** `CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2` ([Explorer](https://stellar.expert/explorer/testnet/contract/CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2))
- **Initial Deployer / Admin (`admin1`):** `GBCL7YYLZAF72NR3JBX25XI3SSFXLG5P4XMVZKOHUSR4BFHOQFS7AY6D`
- **Handover Administrator (`admin2`, Active):** `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ`
- **Initial Issuer (`issuer1`, Rotated Out):** `GBUWRYZ4NKH4L4NYW7XZVZ2VZHDBFZQ2J2NRHACGHAJYG7LUWU2WSNEQ`
- **Rotated Issuer (`issuer2`, Active):** `GAGLNXX4EV5DTA4CHD3XV2K4BCFKHQNKCD57XZ2Z4LEXG6MTCQKZSTQT`
- **Learner Recipient (`learner`):** `GC722TZXBDDRSNMBRNPGG7ON2GA4OTOVJAKXNXIJCSZ6CDHKXLAD6POL`

---

## 4. Confirmed On-Chain Transactions (`17/17` Complete Hashes & Explorer Links)

Status: **IMPLEMENTED AND VERIFIED ON TESTNET** — Every transaction below returned `SUCCESS` on Stellar Testnet and was independently re-verified via `pnpm passport:verify:testnet:hardened` (`getTransaction` on `https://soroban-testnet.stellar.org`).

| # | Operation | Authorizing Account(s) | Complete Transaction Hash (SHA-256) | Explorer | Ledger | Resulting State & Actual Verification |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `uploadContractWasm` | `GBCL7YYLZAF72NR3JBX25XI3SSFXLG5P4XMVZKOHUSR4BFHOQFS7AY6D` | `c0bfed72346830857bb12296921ac04811c66c07597055e5508ae0a4bb1e90a7` | [View Tx](https://stellar.expert/explorer/testnet/tx/c0bfed72346830857bb12296921ac04811c66c07597055e5508ae0a4bb1e90a7) | `5672045` | Hardened `42,382`-byte WASM `f7975920f377927af8d803f87df3a3ade4e84cc012835868f004eca4105888bf` uploaded (`SUCCESS`) |
| 2 | `createCustomContract` | `GBCL7YYLZAF72NR3JBX25XI3SSFXLG5P4XMVZKOHUSR4BFHOQFS7AY6D` | `40eb077321244a96b468acb4d2e4ff63c898c9332aa95b530f523ee0389b443c` | [View Tx](https://stellar.expert/explorer/testnet/tx/40eb077321244a96b468acb4d2e4ff63c898c9332aa95b530f523ee0389b443c) | `5672046` | Instance `CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2` created |
| 3 | `initialize` | `GBCL7YYLZAF72NR3JBX25XI3SSFXLG5P4XMVZKOHUSR4BFHOQFS7AY6D` | `7314995d4abbb347574630cfb4fbfefdce308ca325e952c961205b4846401c7b` | [View Tx](https://stellar.expert/explorer/testnet/tx/7314995d4abbb347574630cfb4fbfefdce308ca325e952c961205b4846401c7b) | `5672047` | `get_admin() = GBCL7YYLZAF72NR3JBX25XI3SSFXLG5P4XMVZKOHUSR4BFHOQFS7AY6D`, `is_paused() = false` |
| 4 | `propose_admin` | `GBCL7YYLZAF72NR3JBX25XI3SSFXLG5P4XMVZKOHUSR4BFHOQFS7AY6D` | `5e49a894ab330db4dcb450e5d24ba5fc7ebedecf57806af9140dba4ae098c40b` | [View Tx](https://stellar.expert/explorer/testnet/tx/5e49a894ab330db4dcb450e5d24ba5fc7ebedecf57806af9140dba4ae098c40b) | `5672048` | `get_pending_admin() = GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ`; active admin remains `admin1` |
| 5 | `accept_admin` | `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ` | `eaa8d5afc62d2f97d0a435b56e70bd398d324b31d2e2d24e66427d9c475e4547` | [View Tx](https://stellar.expert/explorer/testnet/tx/eaa8d5afc62d2f97d0a435b56e70bd398d324b31d2e2d24e66427d9c475e4547) | `5672049` | `get_admin() = GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ`, `get_pending_admin() = None` |
| 6 | `pause` | `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ` | `5c0edf14d3a31c9f0326024fdc3047b3c7064513f75e556683362893013b6499` | [View Tx](https://stellar.expert/explorer/testnet/tx/5c0edf14d3a31c9f0326024fdc3047b3c7064513f75e556683362893013b6499) | `5672050` | `is_paused() = true`; circuit breaker engaged |
| 7 | `unpause` | `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ` | `a7d7778bbbf066a87ed5a956c8181adf16e9ce603b9079130659c4df7a6f0e01` | [View Tx](https://stellar.expert/explorer/testnet/tx/a7d7778bbbf066a87ed5a956c8181adf16e9ce603b9079130659c4df7a6f0e01) | `5672051` | `is_paused() = false`; normal mutations re-enabled |
| 8 | `register_issuer` | `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ` | `84536350fae5925c10f7029011a3ed1f26aadb7e45eba0b63b0c783929c88332` | [View Tx](https://stellar.expert/explorer/testnet/tx/84536350fae5925c10f7029011a3ed1f26aadb7e45eba0b63b0c783929c88332) | `5672052` | `issuer1` (`GBUWRYZ4NKH4L4NYW7XZVZ2VZHDBFZQ2J2NRHACGHAJYG7LUWU2WSNEQ`) registered (`is_issuer_authorized = true`) |
| 9 | `register_template (Degree)` | `GBUWRYZ4NKH4L4NYW7XZVZ2VZHDBFZQ2J2NRHACGHAJYG7LUWU2WSNEQ` | `8d763b70af6a9b4494af489a6fc264832f404f83bbdb241477b023941ff6061f` | [View Tx](https://stellar.expert/explorer/testnet/tx/8d763b70af6a9b4494af489a6fc264832f404f83bbdb241477b023941ff6061f) | `5672053` | Template `Degree` bound to `issuer1` |
| 10 | `issue_credential` | `GBUWRYZ4NKH4L4NYW7XZVZ2VZHDBFZQ2J2NRHACGHAJYG7LUWU2WSNEQ` | `83e91a30a2c4cc9620ce8499d028b0e3f6883d43b9efcec935988cdb0686f2ef` | [View Tx](https://stellar.expert/explorer/testnet/tx/83e91a30a2c4cc9620ce8499d028b0e3f6883d43b9efcec935988cdb0686f2ef) | `5672054` | Cred `9d470cb57a0fac5c05b87628f8d438040753b6b085cf0f21f7b8ea2992044276` issued (`Active = 1`); `verify_credential()` `is_valid = true, hash_matches = true` |
| 11 | `batch_issue_credentials` (`4` items) | `GBUWRYZ4NKH4L4NYW7XZVZ2VZHDBFZQ2J2NRHACGHAJYG7LUWU2WSNEQ` | `c57b2e303dcfffa079d2c1cfd3b5eeacbf172b3e01a923478319dd701e524a7a` | [View Tx](https://stellar.expert/explorer/testnet/tx/c57b2e303dcfffa079d2c1cfd3b5eeacbf172b3e01a923478319dd701e524a7a) | `5672055` | `4` credentials issued atomically (`get_learner_credential_count = 5`) |
| 12 | `suspend_credential` | `GBUWRYZ4NKH4L4NYW7XZVZ2VZHDBFZQ2J2NRHACGHAJYG7LUWU2WSNEQ` | `d109a0c3f3aa6d47e2a346788e59146ea34f33bad8bbf34f5b5b3924f7ed7f54` | [View Tx](https://stellar.expert/explorer/testnet/tx/d109a0c3f3aa6d47e2a346788e59146ea34f33bad8bbf34f5b5b3924f7ed7f54) | `5672057` | Status updated to `Suspended = 3`; `verify_credential()` `is_valid = false` |
| 13 | `reactivate_credential` | `GBUWRYZ4NKH4L4NYW7XZVZ2VZHDBFZQ2J2NRHACGHAJYG7LUWU2WSNEQ` | `c3ce01158f940ce8005d89b8e26d4b05187a25002571d86e5746718988e82f43` | [View Tx](https://stellar.expert/explorer/testnet/tx/c3ce01158f940ce8005d89b8e26d4b05187a25002571d86e5746718988e82f43) | `5672058` | Restored to `Active = 1`; `verify_credential()` `is_valid = true` |
| 14 | `revoke_credential` | `GBUWRYZ4NKH4L4NYW7XZVZ2VZHDBFZQ2J2NRHACGHAJYG7LUWU2WSNEQ` | `083432ae418c732893ccac7abdf4b3e8129321a58e6c4b174ea190eec5e406b9` | [View Tx](https://stellar.expert/explorer/testnet/tx/083432ae418c732893ccac7abdf4b3e8129321a58e6c4b174ea190eec5e406b9) | `5672059` | Permanently `Revoked = 2`; `verify_credential()` `is_valid = false, hash_matches = true` |
| 15 | `rotate_issuer_key` | `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ` + `GAGLNXX4EV5DTA4CHD3XV2K4BCFKHQNKCD57XZ2Z4LEXG6MTCQKZSTQT` | `007c75c60b2a64611a4ff9b13ca6d85d5b413405455e5f0a92f5152240aee81a` | [View Tx](https://stellar.expert/explorer/testnet/tx/007c75c60b2a64611a4ff9b13ca6d85d5b413405455e5f0a92f5152240aee81a) | `5672060` | `is_issuer_authorized(issuer1) = false`, `is_issuer_authorized(issuer2) = true` |
| 16 | `register_template (Cert)` | `GAGLNXX4EV5DTA4CHD3XV2K4BCFKHQNKCD57XZ2Z4LEXG6MTCQKZSTQT` | `54ffd1ba1f661078344ddeac20f035f9a9be884569e2da5775be5b9b884c4cfc` | [View Tx](https://stellar.expert/explorer/testnet/tx/54ffd1ba1f661078344ddeac20f035f9a9be884569e2da5775be5b9b884c4cfc) | `5672061` | Rotated `issuer2` registers `Cert` template |
| 17 | `issue_credential` (post-rotation) | `GAGLNXX4EV5DTA4CHD3XV2K4BCFKHQNKCD57XZ2Z4LEXG6MTCQKZSTQT` | `64c06850afd89966d0dc1640a579ad7027a5c87fdb01bfe2fe4cc9084e9b6799` | [View Tx](https://stellar.expert/explorer/testnet/tx/64c06850afd89966d0dc1640a579ad7027a5c87fdb01bfe2fe4cc9084e9b6799) | `5672062` | Post-rotation cred `d77d96ee2a1bd5566ea7fb36cc02fbee4b6a5e1345290e97aa483997f2d84664` issued (`Active = 1`, `is_valid = true`, learner count `6`) |

### Preserved Legacy Instance References (`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5`, `2026-10-27`)

| Operation | Complete Transaction Hash | Explorer | Ledger |
| --- | --- | --- | --- |
| `deploy` | `5b6424a33e13fc1eeb87dd18a7972324e3ad09e319d3ac8ade8ce908f0677c5d` | [View Tx](https://stellar.expert/explorer/testnet/tx/5b6424a33e13fc1eeb87dd18a7972324e3ad09e319d3ac8ade8ce908f0677c5d) | `5412569` |
| `initialize` | `59bad59001b1f7c9e59b910afd299e9d773fce46eae91a8863917c8370964394` | [View Tx](https://stellar.expert/explorer/testnet/tx/59bad59001b1f7c9e59b910afd299e9d773fce46eae91a8863917c8370964394) | `5412570` |
| `registerIssuer` | `4f107688e3be794f69ca4377dbbae440bddbb5adaf480270655891002222904f` | [View Tx](https://stellar.expert/explorer/testnet/tx/4f107688e3be794f69ca4377dbbae440bddbb5adaf480270655891002222904f) | `5412572` |
| `registerTemplate` | `f39c6809d32499392684cfcb3196f3ddba9744ab36d8f2ed3a80598775adb27e` | [View Tx](https://stellar.expert/explorer/testnet/tx/f39c6809d32499392684cfcb3196f3ddba9744ab36d8f2ed3a80598775adb27e) | `5412573` |
| `issueCredential` | `0fac86a487f55ecf79a1a675638faa972fa89d2fd8990f3d14535dbf69ee9827` | [View Tx](https://stellar.expert/explorer/testnet/tx/0fac86a487f55ecf79a1a675638faa972fa89d2fd8990f3d14535dbf69ee9827) | `5412574` |
| `suspendCredential` | `84c8f791a1b30a9cfc326e9bfefc2c215f4a143d2c7d2973e59e41091711b2b6` | [View Tx](https://stellar.expert/explorer/testnet/tx/84c8f791a1b30a9cfc326e9bfefc2c215f4a143d2c7d2973e59e41091711b2b6) | `5412575` |
| `reactivateCredential` | `a20cadbf98d950f3a74e42c5452a8b698a079b7fa47acd85e01ce07f21c0227b` | [View Tx](https://stellar.expert/explorer/testnet/tx/a20cadbf98d950f3a74e42c5452a8b698a079b7fa47acd85e01ce07f21c0227b) | `5412576` |
| `revokeCredential` | `fbf1f4b6e2c36a1daef4a421cba3db98dfadb707182b2626f36832f1c4dcef5d` | [View Tx](https://stellar.expert/explorer/testnet/tx/fbf1f4b6e2c36a1daef4a421cba3db98dfadb707182b2626f36832f1c4dcef5d) | `5412577` |

---

## 5. Evidence by Security-Control Area

### Administrator Handover (Sections 4–5)
- **Status:** **IMPLEMENTED AND VERIFIED ON TESTNET** (Handover TXs `#4–#5`) & **SIMULATED ON TESTNET** (Previous-admin lockouts)
- After `propose_admin` (`5e49a894ab330db4dcb450e5d24ba5fc7ebedecf57806af9140dba4ae098c40b`), read-only RPC `get_pending_admin()` returned `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ` while `get_admin()` remained `GBCL7YYLZAF72NR3JBX25XI3SSFXLG5P4XMVZKOHUSR4BFHOQFS7AY6D`. After `accept_admin` (`eaa8d5afc62d2f97d0a435b56e70bd398d324b31d2e2d24e66427d9c475e4547`), `get_admin()` switched to `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ` and `get_pending_admin()` cleared to `None`. Enforcing Soroban RPC simulations (`authMode: "enforce"`) confirmed old admin `admin1` can no longer execute `pause` or `register_issuer` (`Error(Auth, InvalidAction)` citing `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ`).

### Emergency Pause & Unpause (Section 5)
- **Status:** **IMPLEMENTED AND VERIFIED ON TESTNET** (`pause`/`unpause` TXs `#6–#7`) & **SIMULATED ON TESTNET** (`ContractPaused #17`)
- While `is_paused() === true` (after `5c0edf14d3a31c9f0326024fdc3047b3c7064513f75e556683362893013b6499`), simulating `register_issuer` trapped with `Error(Contract, #17)` (`ContractPaused`). Immediately after `unpause()` (`a7d7778bbbf066a87ed5a956c8181adf16e9ce603b9079130659c4df7a6f0e01`), `is_paused()` returned `false` and `register_issuer` (`84536350fae5925c10f7029011a3ed1f26aadb7e45eba0b63b0c783929c88332`) succeeded on-chain in ledger `5672052`.

### Issuer Key Rotation (Section 5)
- **Status:** **IMPLEMENTED AND VERIFIED ON TESTNET** (Dual-auth rotation TX `#15` + Post-rotation issuance TXs `#16–#17`) & **SIMULATED ON TESTNET** (Old-key lockouts `#4`, Template ownership `#3`)
- Both active admin `admin2` (`GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ`) and incoming key `issuer2` (`GAGLNXX4EV5DTA4CHD3XV2K4BCFKHQNKCD57XZ2Z4LEXG6MTCQKZSTQT`) signed `rotate_issuer_key` (`007c75c60b2a64611a4ff9b13ca6d85d5b413405455e5f0a92f5152240aee81a`, ledger `5672060`). Afterwards, `issuer1` could neither issue (`Error(Contract, #4)`) nor suspend (`Error(Contract, #4)`), while `issuer2` could not use `issuer1`'s `Degree` template (`Error(Contract, #3)`) and successfully registered `Cert` (`54ffd1ba1f661078344ddeac20f035f9a9be884569e2da5775be5b9b884c4cfc`) + issued valid credential `d77d96ee2a1bd5566ea7fb36cc02fbee4b6a5e1345290e97aa483997f2d84664` (`64c06850afd89966d0dc1640a579ad7027a5c87fdb01bfe2fe4cc9084e9b6799`).

### Credential Lifecycle (Section 5)
- **Status:** **IMPLEMENTED AND VERIFIED ON TESTNET** (Issue/Suspend/Reactivate/Revoke TXs `#10, #12–#14`) & **SIMULATED ON TESTNET** (Tamper, Active/Revoked Reactivation Guards)
- `verify_credential` confirmed `is_valid = true` after issuance (`83e91a30a2c4cc9620ce8499d028b0e3f6883d43b9efcec935988cdb0686f2ef`), `is_valid = false` (`status = 3` Suspended) after `suspend_credential` (`d109a0c3f3aa6d47e2a346788e59146ea34f33bad8bbf34f5b5b3924f7ed7f54`), `is_valid = true` (`status = 1` Active) after `reactivate_credential` (`c3ce01158f940ce8005d89b8e26d4b05187a25002571d86e5746718988e82f43`), `is_valid = false` with `hash_matches = true` (`status = 2` Revoked) after `revoke_credential` (`083432ae418c732893ccac7abdf4b3e8129321a58e6c4b174ea190eec5e406b9`), and `hash_matches = false, is_valid = false` for a tampered digest.

### Batch Operations & Pagination (Section 5)
- **Status:** **IMPLEMENTED AND VERIFIED ON TESTNET** (`4`-Item Batch TX `#11` + Pagination Reads) & **SIMULATED ON TESTNET** (`BatchTooLarge #15`, Atomic Failure Rollback)
- Issuing `4` credentials atomically via `batch_issue_credentials` (`c57b2e303dcfffa079d2c1cfd3b5eeacbf172b3e01a923478319dd701e524a7a`) brought `get_learner_credential_count` from `1` to `5`. Querying `get_learner_credentials_page` with `limit = 2` at cursors `0`, `2`, `4`, and `6` returned page lengths `2, 2, 1, 0` (`uniqueCountAcrossAllPages = 5`, matching `get_learner_credentials` exact order with zero duplicates and zero omissions).
- Simulation of `51` items (`> MAX_BATCH_SIZE = 50`) rejected with `Error(Contract, #15)`.
- Simulation of atomic failure (`[freshProbeId, existingCred1Id]`) rejected at item 2 with `Error(Contract, #5)`, and `get_credential(freshProbeId)` returned `null`, confirming atomic rollback with unchanged state. (`batch_issue_credentials` boundary tests `50` pass / `51` reject also pass locally in `contracts/passport/src/test.rs`).

---

## 6. Unauthorized Operations, Simulations & Failed Transactions

- **Failed Ledger Transactions Broadcast:** `0` (`failedTransactions = []`; Soroban RPC preflight simulation rejected invalid operations before transaction submission, conserving funds cleanly).
- **Read-Only Negative Simulations Verified on Live Testnet Contract `CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2` (`SIMULATED ON TESTNET`):**
  1. `oldAdminPauseRejected`: `HostError: Error(Auth, InvalidAction)` (`authMode: "enforce"`, requires `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ`)
  2. `oldAdminRegisterIssuerRejected`: `HostError: Error(Auth, InvalidAction)` (`authMode: "enforce"`, requires `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ`)
  3. `acceptAdminWithoutPendingRejected`: `HostError: Error(Contract, #18)` (`NoPendingAdmin`)
  4. `pausedRegisterIssuerRejected`: `HostError: Error(Contract, #17)` (`ContractPaused`)
  5. `unauthorizedIssueRejected`: `HostError: Error(Contract, #4)` (`IssuerNotAuthorized`)
  6. `duplicateIssueRejected`: `HostError: Error(Contract, #5)` (`CredentialAlreadyExists`)
  7. `paginationZeroLimitRejected`: `HostError: Error(Contract, #14)` (`InvalidInput`)
  8. `batchTooLarge` (`51 > 50`): `HostError: Error(Contract, #15)` (`BatchTooLarge`)
  9. `batchAtomicRollbackRejected` (`[fresh, dup]`): `HostError: Error(Contract, #5)` + `rollbackProbeCredentialAbsent = true`
  10. `reactivateActiveRejected`: `HostError: Error(Contract, #8)` (`CredentialNotSuspended`)
  11. `reactivateRevokedRejected`: `HostError: Error(Contract, #8)` (`CredentialNotSuspended`)
  12. `unauthorizedRevokeRejected`: `HostError: Error(Contract, #3)` (`Unauthorized`)
  13. `rotatedOutIssuerIssueRejected` & `rotatedOutIssuerSuspendRejected`: `HostError: Error(Contract, #4)` (`IssuerNotAuthorized`)
  14. `newIssuerSpoofOldTemplateRejected`: `HostError: Error(Contract, #3)` (`Unauthorized`)
- **Independent CLI Negative Verifier (`pnpm passport:verify:testnet:hardened` `[8/9]`):** `8/8` read-only rejection checks (`8b`–`8i`) + tampered digest check (`8a`) all passed.

---

## 7. Complete Verification Results Summary

| Check | Result |
| --- | --- |
| `cargo test --workspace` | **IMPLEMENTED AND VERIFIED LOCALLY** (`90 passed, 0 failed`: `32` Passport + `58` Round) |
| `pnpm passport:check` | **IMPLEMENTED AND VERIFIED LOCALLY** (WASM `f7975920f377927af8d803f87df3a3ade4e84cc012835868f004eca4105888bf`, 29 exports, 12 SDK calls, 20 error codes, both manifests verified) |
| `pnpm passport:deploy:test` | **IMPLEMENTED AND VERIFIED LOCALLY** (`3/3` passed: manifest separation, secret scan, tx telemetry, overwrite guards) |
| `pnpm sdk:test` & `pnpm --filter skills-passport-sdk build` | **IMPLEMENTED AND VERIFIED LOCALLY** (`123 passed, 0 failed` across 24 suites) |
| `pnpm lifecycle:passport` | **IMPLEMENTED AND VERIFIED LOCALLY** (`10/10` scenarios passed) |
| `pnpm web:typecheck`, `pnpm web:test`, `pnpm web:build` | **IMPLEMENTED AND VERIFIED LOCALLY** (`88 passed, 0 failed`; CSS lint `751` classes; `1656` Vite modules built) |
| `pnpm passport:verify:testnet:hardened` | **IMPLEMENTED AND VERIFIED ON TESTNET** (`17` confirmed txs, `12` read-only RPC queries, `8` negative sims, WASM `MATCH`) |
| `pnpm passport:verify:testnet` | **IMPLEMENTED AND VERIFIED ON TESTNET** (`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5` legacy check: `8` historical txs, `8` queries, `6` sims, untouched) |
| `pnpm -r --workspace-concurrency=1 --if-present run typecheck` | **IMPLEMENTED AND VERIFIED LOCALLY** (11/11 TypeScript packages pass) |
| `pnpm docs:check`, `pnpm docs:check-links`, `pnpm threat-model:check` | **IMPLEMENTED AND VERIFIED LOCALLY** |
| `pnpm bindings:check` | **BLOCKED** locally on Windows (`stellar`/`soroban` CLI absent; checked in Ubuntu CI) |
| Mainnet Passport Deploy / External Audit / ZK Proofs | **NOT IMPLEMENTED** |

---

## 8. Remaining Risks & Blockers

- **Key Custody & Multisig Governance:** Testnet verification used Friendbot-funded ephemeral keys; Mainnet deployment requires hardware-backed / multisig Soroban admin governance and formal institutional key-rotation SOPs.
- **No Automated Substitute for Audit:** All Soroban VM tests and live Testnet transactions do **not** replace an independent external Soroban & cryptography audit per [`docs/SECURITY_REVIEW_REQUIREMENTS.md`](./docs/SECURITY_REVIEW_REQUIREMENTS.md).
- **Local Windows `bindings:check` & Interactive Freighter QA:** `pnpm bindings:check` remains **BLOCKED** locally due to missing `stellar` CLI on Windows; interactive Freighter popup signing in Chrome/Firefox remains manual QA (**DEPLOYED BUT NOT FULLY VERIFIED**).
- **Privacy Limits:** Salted SHA-256 commitments (`StellarSorobanSaltedClaims2026`) provide redaction without zero-knowledge unlinkability (`NOT IMPLEMENTED`).
