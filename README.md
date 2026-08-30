# Umi Mint Hub

You are an expert full-stack Web3 engineer, distributed systems architect, and cryptography specialist.

Your task is to build the complete architecture, frontend, backend, and background worker infrastructure for **"Umi"** — a multi-chain NFT minting, task scheduling, and wallet automation SaaS web application.

---

### 1. CORE SYSTEM ARCHITECTURE & TECH STACK

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons, Wagmi / Viem, RainbowKit.

- **Backend / API**: Node.js / TypeScript (NestJS or Next.js Route Handlers + Fastify), Prisma ORM.

- **Database**: PostgreSQL (Supabase or AWS RDS) with encrypted columns.

- **Message Queue & Workers**: Redis + BullMQ for task scheduling, queueing, and low-latency execution.

- **Web3 / RPC Layer**: Viem / Ethers.js v6 with custom RPC provider failover pools (e.g., QuickNode, Alchemy) and proxy rotation.

- **Security / Cryptography**: Web Crypto API (SubtleCrypto) / `node:crypto` using AES-256-GCM and PBKDF2/scrypt.

---

### 2. SECURITY & KEY MANAGEMENT ENGINE (CRITICAL)

The app handles private keys for up to 500 wallets per user. Implement the two-tier encryption architecture:

1. **Authentication & Client-Side Encryption (Sync Storage)**:

   - User connects a burner/master wallet via SIWE (Sign-In with Ethereum).

   - User signs a deterministic seed-generation message (e.g., `"Sign to decrypt your Umi Key Vault"`).

   - Derive an encryption key on the client using PBKDF2/scrypt from this signature.

   - All imported/generated private keys are encrypted client-side using **AES-256-GCM** before sending the payload to the database.

   - _Result_: The backend server and database NEVER see or store plaintext private keys for sync storage.

2. **Temporary Mint Execution Vault (Ephemeral Storage)**:

   - When a user schedules a mint, the client temporarily decrypts the required keys and re-encrypts them using a server public key / ephemeral task secret.

   - Store these keys in a Redis cache with a short TTL (Time-To-Live).

   - Immediately purge keys from memory and Redis as soon as the mint transaction finishes or fails.

---

### 3. KEY FEATURES & MODULE SPECIFICATIONS

#### A. Wallet Management System

- **Wallet Generator**: Bulk create up to 500 EVM wallets in-browser (exportable to CSV/JSON).

- **Import Engine**: Bulk import private keys with validation.

- **Disperse / Rebalancer**: Tool to distribute native gas tokens (ETH, SEI, BERA, MON, etc.) from one funder wallet to dozens of target wallets in batch using optimized multicall / disperse smart contracts.

- **Balance Aggregator**: Fetch multi-chain balances across all imported wallets simultaneously.

#### B. Launchpad Link Parser & Whitelist Detector

- Universal link parser supporting: OpenSea, Rarible, Mintify, Scatter, Blever, Ronin, Hyperlaunch, and custom contracts.

- **WL Scanner**: Query launchpad APIs / smart contract merkle trees to check which of the imported 500 wallets are whitelisted for a given drop phase.

#### C. Background Scheduling & Low-Latency Execution Engine

- **Independent Cloud Execution**: Tasks run even if the user closes their browser.

- **Pre-Mint Poller**: Watches block timestamps or launchpad APIs and triggers transactions at exact millisecond zero.

- **EIP-1559 Dynamic Gas Estimator**: Configurable max base fee, priority fee (miner tip), and slippage protection.

- **Anti-Bot & Proxy Engine**: Built-in rotating residential/datacenter proxies and header spoofing to bypass launchpad rate-limits and captchas during payload fetches.

#### D. Dashboard UI / UX Requirements (Dark Web3 Aesthetic)

1. **Header**: Network switcher, wallet connection indicator, subscription tier status badge.

2. **Dashboard Overview**: Active tasks, successful mints, wallet count, gas spent tracker.

3. **Task Scheduler Modal**:

   - Launchpad URL input (auto-fetches collection metadata, phases, price, max per wallet).

   - Wallet selector (select all, select whitelisted only, or manual multiselect).

   - Phase selector (Public vs. WL with automatic signature/proof fetching).

   - Gas Settings: Preset profiles (Aggressive, Normal, Custom Gas/Priority).

   - Timing: Immediate execution vs. Scheduled UTC timestamp.

4. **Live Mint Monitor**: Real-time websocket status logs (`Scheduled` -> `Fetching Payload` -> `Broadcasting Tx` -> `Confirmed / Failed`).

---

### 4. DATABASE SCHEMA (PostgreSQL / Prisma)

Define models for:

- `User`: ID, connected address, nonce, subscription tier, createdAt.

- `Vault`: User ID, encrypted payload (AES-256-GCM), IV, salt, key count.

- `MintTask`: ID, User ID, chainId, contractAddress, launchpadType, scheduledFor, status (`PENDING`, `RUNNING`, `SUCCESS`, `FAILED`), gasConfig (JSON), txHashes (Array).

- `TaskLog`: Task ID, timestamp, log level, message.

---

### 5. DELIVERABLES REQUIRED

1. **Step-by-step System Architecture & Directory Structure**.

2. **Cryptographic utility files**: Client-side wallet encryption, key derivation, and backend decryption helpers.

3. **Queue Worker implementation**: BullMQ queue processor executing multi-wallet mint transactions in parallel with Viem.

4. **Launchpad Interface Layer**: A modular adapter pattern to easily add new EVM launchpads.

5. **Main Dashboard & Task Scheduling React Components** styled with Tailwind CSS.

i want a simple dashboard dont complicate it shared screenshot for reference

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1e738f41-dcad-4d3e-b756-eea2b5590ba7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
