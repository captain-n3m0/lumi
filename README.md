# Lumi

Lumi is a TanStack Start/Web3 dashboard for managing EVM mint wallets, validating NFT contracts, scheduling mint tasks, and dispersing native gas across supported chains.

## Live Data

- Collection search uses the server-side OpenSea proxy and on-chain contract lookup.
- Mint phases are loaded from OpenSea drop metadata when available.
- Gas telemetry is fetched from configured RPC endpoints.
- ETH/USD pricing is fetched from Coinbase spot pricing.
- The app no longer ships seeded NFT collections, generated mint phases, fake contract addresses, stock collection images, or hardcoded gas/ETH prices.

## Setup

```sh
npm install
cp .env.example .env
npm run dev
```

Open the local URL printed by Vite.

## Environment

`OPENSEA_API_KEY` is recommended for reliable OpenSea metadata. Blank `VITE_ALCHEMY_API_KEY` and `VITE_INFURA_API_KEY` values are skipped; public RPCs remain available. Server-side RPC overrides such as `ETH_RPC_URL`, `BASE_RPC_URL`, and `POLYGON_RPC_URL` can be set in `.env`.

## Production Notes

- Wallets are stored in the browser's local storage in the current app. Treat this as local-only key management unless the encrypted vault flow is fully wired into persistence.
- Unsupported launchpad adapters fail clearly instead of fabricating mint metadata or calldata.
- Scheduled tasks validate contract bytecode through live RPC. A durable external worker/queue should be connected before relying on browser-independent mint execution.

## Commands

```sh
npm run lint
npm run build
npm run preview
```

This project is connected to [Lovable](https://lovable.dev). Avoid rewriting published git history on the connected branch.
