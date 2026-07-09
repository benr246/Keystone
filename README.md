# Keystone — Milestone Escrow on Stellar Soroban

Keystone is a milestone-based escrow dApp on Stellar testnet. A client locks the full budget of a project into a Soroban smart contract, split across 2–3 named milestones for a designated freelancer. As the client approves each milestone, the escrow contract executes a real inter-contract transfer (Escrow → Stellar Asset Contract) paying that milestone to the freelancer. If the client cancels, every still-locked milestone is refunded on-chain — already-released payments are untouched.

![Hero screenshot](PENDING — generate after deployment)

## Live Demo

`PENDING — generate after deployment`

## Demo Video (1–2 minutes)

`PENDING — generate after deployment`

## Contract Deployment Address

| Contract | Address | Explorer |
|---|---|---|
| Escrow | `CA62WWTOFZQIYWXQHZUOAXF3ZB5IB3AS6N7RYYXGG4YK6M3NJ6OK2SQO` | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CA62WWTOFZQIYWXQHZUOAXF3ZB5IB3AS6N7RYYXGG4YK6M3NJ6OK2SQO) |
| Native XLM SAC (token) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

## Transaction Hash for Contract Interaction

All three hashes are real, executed on Stellar testnet, and resolve on Stellar Expert:

| Action | Transaction hash |
|---|---|
| `create_escrow` (3 milestones, 500 XLM locked) | [`03bb53cfdec76d0a3957b1a243a412e848545d5f694be35d47bd750c8c38a122`](https://stellar.expert/explorer/testnet/tx/03bb53cfdec76d0a3957b1a243a412e848545d5f694be35d47bd750c8c38a122) |
| `release_milestone(0, 0)` (100 XLM paid to freelancer) | [`02ebf6eea4de81bbe3fa4442369ff7b5e88b0c05974f883347de34792f6e578f`](https://stellar.expert/explorer/testnet/tx/02ebf6eea4de81bbe3fa4442369ff7b5e88b0c05974f883347de34792f6e578f) |
| `cancel_escrow(0)` (400 XLM refunded to client) | [`815aea33524aaec8553b10ca0ef4958f1dc5967cbec59d9faac33fb208f8bf05`](https://stellar.expert/explorer/testnet/tx/815aea33524aaec8553b10ca0ef4958f1dc5967cbec59d9faac33fb208f8bf05) |

## Inter-Contract Communication

Every fund movement in Keystone is a real Soroban cross-contract invocation from the escrow contract to the Stellar Asset Contract (SAC) for native XLM, via the generated token client (`soroban_sdk::token::Client`):

- `create_escrow` → `token.transfer(client, escrow_contract, total)` — locks the full budget into contract custody.
- `release_milestone` → `token.transfer(escrow_contract, freelancer, amount)` — pays the freelancer.
- `cancel_escrow` → `token.transfer(escrow_contract, client, refunded_total)` — refunds locked funds.

On-chain proof: the [release transaction](https://stellar.expert/explorer/testnet/tx/02ebf6eea4de81bbe3fa4442369ff7b5e88b0c05974f883347de34792f6e578f) shows a `transfer` event emitted **by the SAC contract** (`CDLZ…CYSC`) with the escrow contract (`CA62…2SQO`) as sender and the freelancer as recipient — that event can only exist because the escrow contract invoked the token contract cross-contract. There is no internal balance bookkeeping substitute.

## Event Streaming & Real-Time Updates

The contract emits events on every state change:

- `("escrow", "created")` → `(id, client, freelancer, total)`
- `("escrow", "released")` → `(id, index, amount)`
- `("escrow", "cancelled")` → `(id, refunded_total)`

The frontend polls Soroban RPC every 5 seconds:

- `get_progress` feeds the live hero — the keystone arch and the `X XLM released / Y XLM locked` numerals update without a reload.
- RPC `getEvents` (cursor-paginated across the retention window) feeds the live activity feed ("Site log"), newest first, each row linking its real transaction hash to Stellar Expert.

## Smart Contract Deployment Workflow

Exact commands used (all executed for real):

```bash
# 1. Identities, funded via Friendbot
stellar keys generate keystone-deployer --network testnet --fund
stellar keys generate keystone-client --network testnet --fund
stellar keys generate keystone-freelancer --network testnet --fund

# 2. Build
cd contracts && stellar contract build

# 3. Deploy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/escrow.wasm \
  --source keystone-deployer --network testnet
# → CA62WWTOFZQIYWXQHZUOAXF3ZB5IB3AS6N7RYYXGG4YK6M3NJ6OK2SQO

# 4. Native XLM SAC address
stellar contract id asset --asset native --network testnet
# → CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

# 5. Representative transactions (create / release / cancel)
stellar contract invoke --id CA62…2SQO --source keystone-client --network testnet -- \
  create_escrow --client G… --freelancer G… --token CDLZ…CYSC \
  --milestones '[["Design mockups","1000000000"],["Build frontend","1500000000"],["Deploy & handover","2500000000"]]'
stellar contract invoke --id CA62…2SQO --source keystone-client --network testnet -- \
  release_milestone --id 0 --index 0
stellar contract invoke --id CA62…2SQO --source keystone-client --network testnet -- \
  cancel_escrow --id 0
```

## CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs two jobs on every push:

1. **contracts** — Rust stable + `wasm32v1-none` target, `cargo test`, release WASM build.
2. **frontend** — Node 20, `npm ci`, `npm run lint`, `npm run build` (static export).

Badge and green-run screenshot: `PENDING — generate after deployment` (add after first push to GitHub).

![CI run screenshot](PENDING — generate after deployment)

## Tests

11 passing contract tests with real inter-contract balance assertions against a registered Stellar Asset test contract. Actual `cargo test` output:

```
running 11 tests
test test::test_create_fails_zero_amount - should panic ... ok
test test::test_create_fails_one_milestone - should panic ... ok
test test::test_create_fails_client_is_freelancer - should panic ... ok
test test::test_create_fails_four_milestones - should panic ... ok
test test::test_create_escrow_locks_total ... ok
test test::test_release_requires_client_auth ... ok
test test::test_release_after_cancel_fails - should panic ... ok
test test::test_cancel_with_nothing_locked_fails - should panic ... ok
test test::test_double_release_fails - should panic ... ok
test test::test_release_pays_correct_amount ... ok
test test::test_cancel_refunds_only_locked ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.14s
```

Run them yourself: `cd contracts && cargo test`

![Test output screenshot](PENDING — generate after deployment)

## Error Handling & Loading States

Three distinct, individually styled error states (plus friendly mapping of contract panics):

1. **Wallet not found** (`error / no. 01`) — no wallet extension detected → instructive card with a Freighter install link.
2. **Rejected signature** (`error / no. 02`) — user declines in the wallet → non-blaming "transaction declined" state with retry.
3. **Insufficient balance** (`error / no. 03`) — pre-flight check (total + fee headroom vs. balance) → exact shortfall message before any signing.

Every blockchain action tracks pending → success/fail. Success always surfaces the real transaction hash linked to Stellar Expert; there are no silent failures.

## Mobile Responsive Frontend

Verified at 375px (iPhone SE) and 768px: milestone rows stack, the hero arch scales, the feed compacts, and all tap targets are ≥44px.

![375px screenshot](PENDING — generate after deployment)

## Production-Ready Architecture

- **Contracts:** persistent storage with TTL extension on access, checked arithmetic (workspace-wide `overflow-checks = true`), strict input validation, auth on every mutating call via `require_auth`.
- **Frontend:** Next.js 14 static export (no server), typed Soroban helpers, SWR polling with automatic revalidation, wallet kit loaded lazily to keep prerender clean.
- **Deployment:** Cloudflare Workers static assets driven by the root `wrangler.toml`; all `NEXT_PUBLIC_*` values baked at build time.
- **CI:** contracts and frontend built and tested on every push.

## Setup Instructions

```bash
git clone <repo-url> && cd keystone

# Contracts
cd contracts
cargo test                 # run the 11 tests
stellar contract build     # build WASM

# Frontend
cd ../frontend
cp .env.example .env.local
npm ci
npm run dev                # http://localhost:3000
```

Deploy to Cloudflare Workers: create a Worker from the repo, leave the dashboard build command blank (root `wrangler.toml` drives the build), add the four `NEXT_PUBLIC_*` variables (unencrypted) before the first deploy.

## Screenshots

| Item | Screenshot |
|---|---|
| Wallet options modal (StellarWalletsKit) | `PENDING — generate after deployment` |
| Connected state + XLM balance | `PENDING — generate after deployment` |
| Create escrow flow | `PENDING — generate after deployment` |
| Hero progress after a release | `PENDING — generate after deployment` |
| Live activity feed | `PENDING — generate after deployment` |
| Mobile UI (375px) | `PENDING — generate after deployment` |
| CI/CD run (Actions tab) | `PENDING — generate after deployment` |
| Test output | `PENDING — generate after deployment` |
