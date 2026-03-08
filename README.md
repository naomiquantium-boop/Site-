# SpyTON Listings MVP

A deployable Telegram Mini App starter for paid token listings on TON using Cloudflare Workers static assets + D1.

## What this MVP already does

- shows listing packages
- accepts token submissions
- stores listings in Cloudflare D1
- exposes a public live listings board
- includes a simple admin panel protected by `ADMIN_PASSWORD`
- lets admin confirm payment manually and approve or reject listings
- works as a normal web app and inside Telegram Mini Apps

## What is intentionally simplified

This starter is designed to get you online fast.

- TON payment verification is **manual** in this MVP. The user can paste a tx hash, and the admin confirms payment in the panel.
- Telegram `initData` is **read** from the Mini App header, but **not cryptographically validated** yet. Telegram recommends validating raw `initData` server-side before trusting it in production. citeturn0search2turn0search6turn0search22
- TON wallet connect is not included yet. TON Connect is the standard way to connect wallets in TON apps and Telegram Mini Apps. citeturn0search3turn0search7turn0search15

## Why this stack

Cloudflare Workers can serve static assets and API routes from one project, and Cloudflare D1 is available on Free and Paid plans. citeturn0search0turn0search4turn0search9turn0search12

## Project structure

```text
spyton-listings-mvp/
  public/
    index.html
    styles.css
    app.js
  src/
    worker.js
  migrations/
    0001_init.sql
  wrangler.toml
  package.json
  .dev.vars.example
  README.md
```

## Deploy steps

### 1) Install dependencies

```bash
npm install
```

### 2) Log in to Cloudflare

```bash
npx wrangler login
```

### 3) Create the D1 database

Cloudflare documents database creation with Wrangler:

```bash
npx wrangler d1 create spyton_listings
```

Copy the returned `database_id` into `wrangler.toml` under `[[d1_databases]]`. citeturn0search1turn0search5turn0search21

### 4) Run the migration

Local:

```bash
npm run db:migrate:local
```

Remote:

```bash
npm run db:migrate:remote
```

### 5) Add the admin password secret

For local development, copy `.dev.vars.example` to `.dev.vars` and change the password:

```bash
cp .dev.vars.example .dev.vars
```

For production, set the Worker secret:

```bash
npx wrangler secret put ADMIN_PASSWORD
```

### 6) Start local development

```bash
npm run dev
```

### 7) Deploy

```bash
npm run deploy
```

### 8) Connect to Telegram

Create your bot in `@BotFather`, then attach the deployed HTTPS URL as your Mini App. Telegram supports launching Mini Apps from bot buttons and links. citeturn0search6turn0search14

## Production upgrades to do next

1. Add TON Connect UI for wallet connection. citeturn0search3turn0search7
2. Verify TON payments automatically by checking the destination wallet and transaction amount.
3. Validate Telegram `initData` on the Worker using your bot token before trusting user identity. citeturn0search2turn0search18turn0search22
4. Add image uploads using R2 or external storage.
5. Split admin to a hidden route and add stronger auth.
6. Add package expiration and promoted slots.

## Default package pricing

- Standard Listing — 15 TON
- Featured Listing — 35 TON
- Trending Boost — 60 TON

You can change prices in `migrations/0001_init.sql`.
