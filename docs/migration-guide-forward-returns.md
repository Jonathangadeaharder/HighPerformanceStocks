# Rewrite: Replace Decayed CAGR Model with 1-Year Forward Returns

## Problem Statement

The codebase has two return calculation systems, but only the legacy one is actually wired up:

| System                                             | Defined in            | Used by                                               |
| -------------------------------------------------- | --------------------- | ----------------------------------------------------- |
| `calcDecayedCagr` (legacy)                         | `lib/finance-core.js` | `update-data.ts`, `validate-data.ts`, `deployment.ts` |
| `calcForwardReturn` / `calcForwardScenarios` (new) | `lib/finance-core.js` | **Nothing**                                           |

The legacy system projects EPS forward 10 years with exponential growth decay, then values the stock at an exit P/E. This requires five tunable parameters per stock (`epsGrowth`, `exitPE` x3, `decayFactor`, `horizon`) and a global RTM shrinkage constant — all of which interact in non-obvious ways. The result: NVDA shows `scenarios: null` despite having a full CAGR model, and multiple stocks produce base CAGRs that contraddict their screener signals.

The forward return system is a one-liner: `(targetPrice - currentPrice) / currentPrice + dividendYield`. It already has analyst low/mean/high target prices flowing into every stock record via `update-data.ts` → `financialData.targetMeanPrice`. The data is there; we just aren't using it.

### Why this is a rewrite, not a migration

A phased migration with fallbacks doubles the code surface and creates two execution paths that can silently diverge. Every stock in the universe already has `targetPrice` populated by Yahoo Finance. Stocks without analyst coverage (rare — RXRX is the only one) already get `signal: 'NO_DATA'` from the screener. There is nothing to fall back to.

---

## Target Architecture

### `lib/finance-core.js` — after rewrite

```javascript
// KEEP: Parsing utilities (unchanged)
export function parsePercent(value) { ... }
export function parseDisplayPrice(value) { ... }

// KEEP: Forward return calculations (already implemented, currently unused)
export function calcForwardReturn({ currentPrice, targetPrice, dividendYieldPct }) { ... }
export function calcForwardScenarios({ currentPrice, targetLow, targetMean, targetHigh, dividendYieldPct }) { ... }

// DELETE: Legacy CAGR model (all four exports)
// - calcDecayedCagr
// - DEFAULT_HORIZON
// - DEFAULT_GROWTH_DECAY
```

### `lib/finance-core.d.ts` — after rewrite

Remove the `calcDecayedCagr`, `DEFAULT_HORIZON`, `DEFAULT_GROWTH_DECAY` type declarations.

---

## Data Model Changes

### New fields on stock records (`data/stock-records/*.json`)

```jsonc
{
	// NEW: structured analyst targets (already partially available via financialData)
	"analystTargets": {
		"low": 220.0, // financialData.targetLowPrice
		"mean": 267.54, // financialData.targetMeanPrice
		"high": 310.0 // financialData.targetHighPrice
	}
}
```

### Fields to remove from stock records

```jsonc
{
  "cagrModel": {
    // DELETE these:
    "horizon": 5,           // no longer needed — forward returns are 1-year by definition
    "ttmEPS": 4.89,         // no longer needed for scenario math (keep only if screener still needs it)
    "exitPE": { ... },      // no longer needed — targets replace exit valuation
    "exitPESource": "auto", // no longer needed
    "decayFactor": 0.75,    // no longer needed
    "scenarios": { ... },   // recomputed from analystTargets

    // KEEP these (screener still uses them):
    "epsGrowth": "29%",
    "epsGrowthSource": "auto",
    "dividendYield": "0%",
    "basis": "..."
  }
}
```

### Fields to rename/repurpose

The `cagrModel` key should be renamed to `model` since it no longer computes a CAGR. Its remaining purpose is to hold screener inputs (`epsGrowth`, `dividendYield`, `basis`) and the forward return `scenarios`.

### `scenarios` becomes forward returns

Before: `{ bear: "5%", base: "12%", bull: "18%" }` (10-year CAGR)
After: `{ bear: "-5%", base: "47%", bull: "70%" }` (1-year forward return)

This changes the magnitude and interpretation of these numbers. The deployment hurdles must be recalibrated (see below).

### Types (`src/lib/types/dashboard.ts`)

```typescript
// NEW
export interface AnalystTargets {
	low: number;
	mean: number;
	high: number;
}

// REPLACE CagrModel with:
export interface StockModel {
	epsGrowth?: string;
	epsGrowthSource?: 'auto' | 'manual';
	dividendYield?: string;
	basis?: string;
	scenarios?: Partial<Record<ScenarioKey, string>>; // now holds forward returns
	ttmEPS?: number; // retained for screener P/E calculations
}

// On FindingStock:
export interface FindingStock {
	// ...existing fields...
	analystTargets?: AnalystTargets; // NEW
	model?: StockModel; // RENAMED from cagrModel
	// cagrModel?: CagrModel;        // DELETE
}
```

---

## Hurdle Recalibration

Current hurdles assume 10-year CAGR values. Forward returns are 1-year and much more volatile. The hurdles must change:

| Hurdle           | Current (10yr CAGR) | New (1yr Forward Return) | Rationale                                                         |
| ---------------- | ------------------- | ------------------------ | ----------------------------------------------------------------- |
| ETF hurdle       | 14%                 | 15%                      | S&P 500 long-run average ~10%, analyst targets skew 15-20% upside |
| Bear floor       | 0%                  | -10%                     | 1-year bear targets routinely show modest losses                  |
| Value floor bear | 12%                 | 5%                       | Adjusted for 1-year horizon                                       |
| Value floor base | 18%                 | 25%                      | Preserve selectivity — only deep value gets upgraded              |

These are starting points. Run the full universe through the new system and check that the deploy/wait/watchlist split remains sensible (~10-15 deploys, ~10 waits, rest watchlist).

---

## File-by-File Changes

### 1. `scripts/update-data.ts`

**Remove:**

- Import of `calcDecayedCagr`, `DEFAULT_HORIZON`, `DEFAULT_GROWTH_DECAY`
- The entire `INDUSTRY_PE_MAP` (no longer needed for exit P/E derivation)
- The `exitPE` auto-derivation block (lines 353-376)
- The RTM shrinkage constants and adjusted growth calculation (lines 449-454)
- The `calcDecayedCagr` scenario loop (lines 459-480)

**Add:**

- Import of `calcForwardScenarios`
- Populate `stock.analystTargets` from `financialData.targetLowPrice / targetMeanPrice / targetHighPrice`
- Compute scenarios via `calcForwardScenarios`:

```typescript
const fd = summary?.financialData ?? {};
if (fd.targetLowPrice && fd.targetMeanPrice && fd.targetHighPrice) {
	stock.analystTargets = {
		low: fd.targetLowPrice,
		mean: fd.targetMeanPrice,
		high: fd.targetHighPrice
	};

	const scenarios = calcForwardScenarios({
		currentPrice: priceForCalc,
		targetLow: fd.targetLowPrice,
		targetMean: fd.targetMeanPrice,
		targetHigh: fd.targetHighPrice,
		dividendYieldPct: dyPct
	});
	model.scenarios = {
		bear: `${Math.round(scenarios.bear)}%`,
		base: `${Math.round(scenarios.base)}%`,
		bull: `${Math.round(scenarios.bull)}%`
	};

	stock.expectedCAGR = `${Math.round(scenarios.bear)}% - ${Math.round(scenarios.bull)}%`;
}
```

**Keep:**

- `ttmEPS` update logic (screener needs trailing EPS for P/E-based scores)
- `epsGrowth` auto-derivation (screener needs growth rate)
- `dividendYield` update logic
- Screener computation (unchanged — screener uses P/E and growth, not scenarios)
- QCS computation (unchanged)

### 2. `src/lib/domain/deployment.ts`

**Remove:**

- Import of `calcDecayedCagr`
- `computeSensitivityCagr` function (sensitivity from perturbed CAGR model)

**Replace `computeSensitivityCagr` with:**

```typescript
function computeSensitivity(stock: FindingStock): number | null {
	const targets = stock.analystTargets;
	const currentPrice = parseDisplayPrice(stock.currentPrice);
	if (!targets || currentPrice == null || currentPrice <= 0) return null;

	const bearReturn = ((targets.low - currentPrice) / currentPrice) * 100;
	const bullReturn = ((targets.high - currentPrice) / currentPrice) * 100;
	return +(bullReturn - bearReturn).toFixed(1);
}
```

**Update hurdle constants** (see Hurdle Recalibration above).

**Update `enrichStock`:**

- `baseCagr` / `bearCagr` / `bullCagr` → rename to `baseReturn` / `bearReturn` / `bullReturn` (or keep the field names but document they're now 1-year returns)
- `sensitivityCagr` → `sensitivity` (analyst target spread)

### 3. `scripts/validate-data.ts`

**Remove:**

- Import of `calcDecayedCagr`, `DEFAULT_HORIZON`, `DEFAULT_GROWTH_DECAY`
- RTM shrinkage constants
- The entire CAGR math verification block (lines 140-182)

**Replace with forward return validation:**

```typescript
// Validate forward return scenarios match analyst targets
if (data.analystTargets?.mean && data.currentPrice && data.model?.scenarios) {
	const price = parseDisplayPrice(data.currentPrice);
	if (price && price > 0) {
		const dyPct = parsePercent(data.model.dividendYield) ?? 0;
		for (const [label, target] of [
			['bear', data.analystTargets.low],
			['base', data.analystTargets.mean],
			['bull', data.analystTargets.high]
		] as const) {
			const stated = parsePercent(data.model.scenarios[label]);
			if (stated == null || target == null) continue;
			const expected = ((target - price) / price) * 100 + dyPct;
			const diff = Math.abs(expected - stated);
			if (diff > 2) {
				errors.push(
					`Forward return mismatch '${label}': stated ${stated}%, expected ${expected.toFixed(1)}%`
				);
			}
		}
	}
}
```

### 4. `lib/finance-core.js` and `lib/finance-core.d.ts`

Delete `calcDecayedCagr`, `DEFAULT_HORIZON`, `DEFAULT_GROWTH_DECAY` and their type declarations.

Update the module doc comment to remove the "LEGACY" section.

### 5. Stock record JSON files (all ~115 files)

Run a one-time script to:

1. Add `analystTargets: { low, mean, high }` from Yahoo Finance
2. Rename `cagrModel` → `model`
3. Remove from `model`: `horizon`, `exitPE`, `exitPESource`, `decayFactor`
4. Recompute `model.scenarios` using `calcForwardScenarios`
5. Keep in `model`: `epsGrowth`, `epsGrowthSource`, `dividendYield`, `basis`, `ttmEPS`

This script should be part of the rewrite PR, run once, then deleted.

---

## Screener Impact

The screener (`scripts/lib/screener.ts`) is **not affected** by this rewrite. It uses:

- `valuation.forwardPE` (from Yahoo quote)
- `cagrModel.epsGrowth` (retained as `model.epsGrowth`)
- `cagrModel.dividendYield` (retained as `model.dividendYield`)
- `cagrModel.ttmEPS` (retained as `model.ttmEPS`)

The screener does NOT use `calcDecayedCagr` or `scenarios`. The one interaction is the CAGR sanity gate at screener.ts:273-277 which checks `model?.scenarios?.base` against `ETF_HURDLE_CAGR`. This will continue to work but now checks a 1-year forward return instead of a 10-year CAGR, so the threshold needs updating to match the new hurdles.

---

## Dashboard Component Impact

The Svelte components display:

- `baseCagr` / `bearCagr` / `bullCagr` — values change from ~10-20% (CAGR) to ~15-50% (forward return). Labels should change from "CAGR" to "Fwd Return" or "1Y Return".
- `expectedCAGR` — rename to `expectedReturn` and update display label.
- `sensitivityCagr` — now shows analyst target spread instead of perturbed CAGR.

---

## Verification

After the rewrite, run:

1. `pnpm update-data --force` — regenerate all stock data with new forward return scenarios
2. `pnpm validate-data` — verify forward return math is consistent
3. `pnpm build` — type-check and build
4. Manual review: check that deploy/wait/watchlist counts are reasonable
5. Spot-check 5 stocks across groups to verify scenario numbers match Yahoo targets

---

## What This Eliminates

- `calcDecayedCagr` function and its 7 parameters
- `DEFAULT_HORIZON` and `DEFAULT_GROWTH_DECAY` constants
- `INDUSTRY_PE_MAP` (63 lines of manually maintained industry P/E data)
- RTM shrinkage constants (`RTM_BASELINE`, `RTM_SHRINKAGE`) in both `update-data.ts` and `validate-data.ts`
- Per-stock `exitPE` (bear/base/bull), `exitPESource`, `horizon`, `decayFactor` fields
- The concept of "growth decay" entirely
- ~150 lines of CAGR calculation and validation code

## What This Preserves

- The screener engine architecture (fPERG/fEVG/fCFG/fANIG/fFREG/tPERG/totalReturn) — untouched
- The deployment ranking system (value + momentum + quality + QCS) — untouched, just re-tuned hurdles
- The world vol signal — untouched
- Manual fields (group, bullCase, bearCase, basis) — untouched
- The data refresh pipeline structure (batch quotes → parallel summaries → write JSON) — untouched
