# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A stock research dashboard built with SvelteKit 2 + Svelte 5, deployed via `@sveltejs/adapter-node`. It evaluates ~85 global equities using a multi-scenario CAGR model with exponential growth decay, a multi-engine screener (fPERG/fEVG/fCFG/fANIG/fFREG/tPERG/totalReturn — all normalized, lower is better), and a world volatility regime signal. The single-page dashboard classifies stocks into Deploy / Wait / Watchlist (including Overpriced) buckets.

## Commands

- `pnpm dev` — Start Vite dev server
- `pnpm build` — Production build (outputs to `build/`)
- `pnpm preview` / `pnpm start` — Run the production build (`node build`)
- `pnpm check` — Svelte-kit sync + svelte-check (type checking)
- `pnpm lint` — ESLint (strict TypeScript + unicorn + svelte)
- `pnpm lint:fix` — ESLint with auto-fix
- `pnpm format` — Prettier (tabs, single quotes, trailing comma: none)
- `pnpm format:check` — Prettier check only
- `pnpm update-data` — Refresh all stock JSON from Yahoo Finance (skips stocks updated today; use `--force` to re-fetch all)
- `pnpm validate-data` — Verify stock JSON integrity, field completeness, and CAGR math consistency

## Architecture

### Data Layer (outside `src/`)

- **`data/stock-records/*.json`** — One JSON file per stock (e.g. `ABBV.json`). Each contains ticker metadata, valuation multiples, financial metrics, a CAGR model with bear/base/bull exit-PE scenarios, screener output, and consensus targets. These are the single source of truth; some fields are manually authored (group, bullCase, bearCase, exitPE, epsGrowth) while others are auto-refreshed by `update-data`.
- **`lib/finance-core.js`** — Shared financial math (CAGR decay calculation, percent/price parsing). Used by both scripts and the SvelteKit app (`src/lib/domain/`). Has a companion `.d.ts` for type info. Not TypeScript because it must run directly in Node scripts without compilation.
- **`lib/project-paths.js`** — Resolves `STOCK_RECORDS_DIR` path. Shared between scripts and server code.
- **`scripts/update-data.js`** — Fetches Yahoo Finance quotes/summaries in batches, updates stock JSON files, recalculates CAGR scenarios and screener scores. Uses `scripts/lib/` helpers for Yahoo API, display formatting, and screener logic.
- **`scripts/validate-data.js`** — Validates all stock JSON: required fields, screener engines/signals, and CAGR math within 2pp tolerance.

### SvelteKit App (`src/`)

- **`src/routes/+page.server.ts`** — Single page load function. Reads stock JSON via `loadFindingStocks()`, fetches world vol signal, then passes both to `buildDashboardData()`.
- **`src/lib/server/findings.ts`** — Reads and parses `data/stock-records/*.json` into `FindingStock[]`.
- **`src/lib/server/world-vol.ts`** — Fetches VIX/VSTOXX composite (70/30 weighted) with URTH options fallback for world implied volatility. Classifies into buy/hold/sell tone.
- **`src/lib/domain/deployment.ts`** — Pure business logic (no I/O). Enriches stocks with upside, parsed CAGR values, deployment status (DEPLOY/WAIT/REJECT/FAIL/OVERPRICED/NO_DATA), and deployment ranking. Sorts stocks into topPicks, deployNow, cheapWait, and watchlist arrays.
- **`src/lib/types/dashboard.ts`** — All TypeScript interfaces for the dashboard domain model.
- **`src/lib/components/dashboard/`** — Svelte 5 components for the single-page dashboard (header, signal cards, deploy/wait/watchlist sections).

### Key Domain Concepts

- **CAGR Model**: 5-year horizon, exponential growth decay (factor 0.8) toward 6% terminal growth. Bear/base/bull scenarios use different exit P/E multiples. CAGR = price return from terminal EPS \* exitPE + dividend yield.
- **Screener**: Multiple engines — growth-based (`fPERG`, `tPERG`, `fEVG`, `fFREG`, `fANIG`, `fCFG`) and income-based (`totalReturn`). All output a normalized score where **lower is better** and **≤ threshold = PASS**. Growth engines use multiple/growth ratio; totalReturn uses threshold/projected-return inversion. Stocks with ≥5% dividend yield are routed to totalReturn regardless of growth rate. Each produces a signal: PASS/WAIT/FAIL/REJECTED. Reality checks include 6-month price stabilization and analyst revision trends.
- **Deployment**: Stocks with screener PASS that clear 14% base CAGR hurdle and positive bear case get DEPLOY. WAIT stocks can upgrade to DEPLOY if they hit a "value floor" (near 3-month low + supportive revisions + deep upside). High-growth (≥20% EPS) stocks with extreme screener scores (≥1.5) get OVERPRICED instead of FAIL. Stocks with `cyclical: true` get a warning note appended.
- **World Vol Signal**: Composite implied volatility < 15 = buy leverage, 15-25 = hold, > 25 = sell/reduce.

## Code Conventions

- **TypeScript-first**: `allowJs: false` in tsconfig. The `lib/` and `scripts/` directories use plain JS (excluded from TS compilation) because they run directly in Node.
- **Strict ESLint**: `strictTypeChecked` + `stylisticTypeChecked` + `unicorn/recommended`. Enforces `explicit-function-return-type` in `.ts` files (relaxed in `.svelte`), `consistent-type-imports` with inline style, `switch-exhaustiveness-check`, kebab-case filenames.
- **Prettier**: Tabs, single quotes, no trailing commas, 100 char print width.
- **Stock JSON formatting**: Tab-indented JSON with trailing newline (`JSON.stringify(stock, null, '\t') + '\n'`).
