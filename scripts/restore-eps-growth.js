/**
 * restore-eps-growth.js — One-time restoration of epsGrowth (and adjusted ttmEPS) values
 * that were overwritten when indexTrend mistakenly set every stock to 12% (S&P 500 index LTG).
 *
 * Strategy:
 *   - For stocks with manual overrides (adjusted/normalized EPS): hardcode correct values.
 *   - For all others: binary-search for epsGrowth such that calcCAGR() reproduces the
 *     base CAGR from the first successful update run (which used the original epsGrowth values).
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data', 'findings');

// Base CAGR from the first successful update run (live prices + original epsGrowth).
// Source: pnpm update-data output before indexTrend was added.
const FIRST_RUN_BASE_CAGR = {
	ABBV: -11, 'ADDT-B.ST': 6, 'ADYEN.AS': 30, ANET: 11, APO: 17, ASML: 13,
	AVGO: 12, BN: -11, CDNS: 8, 'CSU.TO': 18, DHR: 6, 'EQT.ST': 22,
	EXEL: 31, FNV: 5, GOOGL: 10, HEI: 8, KKR: 0, 'LIFCO-B.ST': 10,
	'LMN.V': 11, MA: 21, META: 13, MRVL: 20, MU: 2, NU: 28,
	NVDA: 18, REGN: 8, RGLD: 8, ROP: 20, SNPS: 8, XYZ: 21,
	TDG: 21, TFPM: 9, 'TOI.V': -1, TPL: 0, TSM: 9, V: 19,
	VEEV: 20, 'VIT-B.ST': 27, VNOM: 3, VRT: 7, VRTX: 9, WPM: 5
};

// Manual overrides: stocks where Yahoo EPS is wrong type (GAAP vs adjusted)
// or where a GBp conversion bug corrupted the value.
const MANUAL_OVERRIDES = {
	ABBV: { epsGrowth: '15%', ttmEPS: 10.65 },   // Model uses adjusted EPS, not GAAP
	'CSU.TO': { epsGrowth: '18%', ttmEPS: 44.2 }, // Model uses normalized EPS
	'DPLM.L': { epsGrowth: '14%', ttmEPS: 1.37 }  // GBp bug: EPS was divided by 100
};

function parsePercent(str) {
	if (!str) return null;
	const m = str.match(/-?\d+(?:\.\d+)?/);
	return m ? parseFloat(m[0]) : null;
}

function parsePrice(str) {
	if (!str) return null;
	return parseFloat(str.replace(/[^0-9.\-]/g, '')) || null;
}

function calcCAGR(price, ttmEPS, epsGrowth, exitPE, dividendYield, horizon = 5) {
	const futureEPS = ttmEPS * Math.pow(1 + epsGrowth / 100, horizon);
	return (Math.pow((futureEPS * exitPE) / price, 1 / horizon) - 1 + dividendYield / 100) * 100;
}

function solveEpsGrowth(price, ttmEPS, exitPE, dy, targetBaseCagr) {
	let lo = -20, hi = 100, mid = 0, cagr;
	for (let i = 0; i < 200; i++) {
		mid = (lo + hi) / 2;
		cagr = calcCAGR(price, ttmEPS, mid, exitPE, dy);
		if (Math.abs(cagr - targetBaseCagr) < 0.001) break;
		if (cagr < targetBaseCagr) lo = mid;
		else hi = mid;
	}
	return Math.round(mid);
}

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));

for (const f of files) {
	const path = resolve(DATA_DIR, f);
	const stock = JSON.parse(readFileSync(path, 'utf-8'));
	const { ticker, cagrModel: model } = stock;

	if (!model?.exitPE) {
		console.log(`  ⏭  ${ticker} — no model, skipping`);
		continue;
	}

	const override = MANUAL_OVERRIDES[ticker];

	if (override) {
		const prev = { epsGrowth: model.epsGrowth, ttmEPS: model.ttmEPS };
		if (override.epsGrowth) model.epsGrowth = override.epsGrowth;
		if (override.ttmEPS != null) model.ttmEPS = override.ttmEPS;
		writeFileSync(path, JSON.stringify(stock, null, '\t') + '\n');
		console.log(`  📝 ${ticker}: manual override → epsGrowth ${prev.epsGrowth}→${model.epsGrowth}, ttmEPS ${prev.ttmEPS}→${model.ttmEPS}`);
		continue;
	}

	const target = FIRST_RUN_BASE_CAGR[ticker];
	if (target === undefined) {
		console.log(`  ⚠️  ${ticker} — no first-run data, skipping`);
		continue;
	}

	const price = parsePrice(stock.currentPrice);
	const ttmEPS = model.ttmEPS;
	const exitPE = model.exitPE.base;
	const dy = parsePercent(model.dividendYield) || 0;

	if (!price || !ttmEPS || !exitPE) {
		console.log(`  ⚠️  ${ticker} — missing price/EPS/PE, skipping`);
		continue;
	}

	const recovered = solveEpsGrowth(price, ttmEPS, exitPE, dy, target);
	const prev = model.epsGrowth;
	model.epsGrowth = `${recovered}%`;
	writeFileSync(path, JSON.stringify(stock, null, '\t') + '\n');
	const check = calcCAGR(price, ttmEPS, recovered, exitPE, dy).toFixed(1);
	console.log(`  🔄 ${ticker}: epsGrowth ${prev}→${recovered}% (target base ${target}%, actual ${check}%)`);
}

console.log('\n✅ Restoration complete. Run: pnpm update-data --force');
