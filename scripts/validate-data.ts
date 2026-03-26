import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDisplayPrice, parsePercent } from '../src/lib/domain/finance/core.js';
import { STOCK_RECORDS_DIR } from '../src/lib/server/infrastructure/paths.js';

const DATA_DIR = STOCK_RECORDS_DIR;
const RETURN_TOLERANCE_PP = 2;

const requiredFields = [
	'ticker',
	'name',
	'group',
	'confidence',
	'confidenceReason',
	'marketCap',
	'expectedCAGR',
	'expectedVolatility',
	'bullCase',
	'bearCase',
	'currentPrice',
	'targetPrice'
];

function validateForwardReturns(data: any, price: number, dyPct: number, errors: string[]) {
	const targetMap = {
		bear: data.analystTargets.low,
		base: data.analystTargets.mean,
		bull: data.analystTargets.high
	};

	for (const [label, target] of Object.entries(targetMap)) {
		const statedReturn = parsePercent(data.cagrModel.scenarios[label] as string);
		if (statedReturn == null || target == null) continue;

		const expectedReturn = ((target as number - price) / price) * 100 + dyPct;
		const diff = Math.abs(expectedReturn - statedReturn);
		if (diff > RETURN_TOLERANCE_PP) {
			errors.push(
				`Forward return mismatch in '${label}': stated ${statedReturn}%, calculated ${expectedReturn.toFixed(1)}% (${diff.toFixed(1)}pp difference)`
			);
		}
	}
}

function verifyData() {
	const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
	let hasErrors = false;
	const today = new Date().toISOString().slice(0, 10);
	const warnings: string[] = [];

	console.log(`🔍 Verifying ${files.length} stock files in ${DATA_DIR}...\n`);

	for (const f of files) {
		const filePath = resolve(DATA_DIR, f);
		let data;
		try {
			data = JSON.parse(readFileSync(filePath, 'utf-8'));
		} catch {
			console.error(`❌ [${f}] Invalid JSON format.`);
			hasErrors = true;
			continue;
		}

		const errors: string[] = [];

		// 1. Verify all required fields exist and are not null/empty
		for (const field of requiredFields) {
			if (data[field] === undefined || data[field] === null || data[field] === '') {
				errors.push(`Missing required field: '${field}'`);
			}
		}

		// 2. Verify CAGR Model structure (if present)
		if (data.cagrModel) {
			if (!data.cagrModel.scenarios?.base) {
				errors.push(`Missing 'cagrModel.scenarios.base'`);
			}
			if (!data.cagrModel.ttmEPS || data.cagrModel.ttmEPS <= 0) {
				errors.push(`Missing or invalid 'cagrModel.ttmEPS' (must be positive)`);
			}
			if (!data.cagrModel.epsGrowth) {
				errors.push(`Missing 'cagrModel.epsGrowth'`);
			}
		} else {
			errors.push(`Missing 'cagrModel' object`);
		}

		// 3. Verify Valuation & Metrics objects
		if (!data.valuation) errors.push(`Missing 'valuation' object`);
		if (!data.metrics) errors.push(`Missing 'metrics' object`);

		// 4. Verify Persistent Daily Cache (lastUpdated)
		if (data.lastUpdated) {
			const updatedDate = data.lastUpdated.slice(0, 10);
			const daysSinceUpdate = Math.floor(
				(Date.now() - new Date(updatedDate).getTime()) / (1000 * 60 * 60 * 24)
			);
			if (daysSinceUpdate > 1) {
				warnings.push(
					`${data.ticker || f}: Cache stale (${daysSinceUpdate} days old, lastUpdated: ${updatedDate})`
				);
			}
		} else {
			errors.push(`Missing 'lastUpdated' timestamp`);
		}

		// 5. Verify screener object
		if (data.screener) {
			const validEngines = [
				'fPERG',
				'tPERG',
				'fEVG',
				'fCFG',
				'fANIG',
				'fFREG',
				'totalReturn',
				'N/A'
			];
			const validSignals = ['PASS', 'WAIT', 'FAIL', 'REJECTED', 'NO_DATA'];
			if (!validEngines.includes(data.screener.engine)) {
				errors.push(`Invalid screener.engine: '${data.screener.engine}'`);
			}
			if (!validSignals.includes(data.screener.signal)) {
				errors.push(`Invalid screener.signal: '${data.screener.signal}'`);
			}
			if (
				data.screener.signal !== 'NO_DATA' &&
				data.screener.score == null &&
				!data.screener.note
			) {
				errors.push(`Screener has signal '${data.screener.signal}' but missing score`);
			}
			if (data.screener.secondaryEngine != null && data.screener.secondaryScore == null) {
				errors.push(`screener.secondaryEngine present but secondaryScore is missing`);
			}
		} else {
			errors.push(`Missing 'screener' object`);
		}

		// 5b. Verify screener/return consistency: PASS signal should align with viable base return
		if (
			data.screener?.signal === 'PASS' &&
			data.cagrModel?.scenarios?.base &&
			data.screener.engine !== 'totalReturn'
		) {
			const baseReturn = parsePercent(data.cagrModel.scenarios.base);
			if (baseReturn != null && baseReturn < 15) {
				errors.push(
					`Screener PASS but base return ${baseReturn}% < 15% hurdle (valuation/return mismatch)`
				);
			}
		}

		// 6. Verify forward return scenarios match analyst targets
		if (data.analystTargets?.mean && data.currentPrice && data.cagrModel?.scenarios) {
			const price = parseDisplayPrice(data.currentPrice);
			const dyPct = parsePercent(data.cagrModel?.dividendYield) ?? 0;

			if (price && !isNaN(price) && price > 0) {
				validateForwardReturns(data, price, dyPct, errors);
			}
		}

		if (errors.length > 0) {
			console.log(`❌ ${data.ticker || f} has issues:`);
			for (const e of errors) {
				console.log(`   - ${e}`);
			}
			hasErrors = true;
		}
	}

	if (warnings.length > 0) {
		console.log(`\n⚠️  Warnings (${warnings.length}):`);
		for (const w of warnings) {
			console.log(`   - ${w}`);
		}
	}

	if (hasErrors) {
		console.log(`\n❌ Validation failed. Run 'pnpm update-data' to refresh cache or fix manually.`);
		process.exit(1);
	} else {
		console.log(`\n✅ All ${files.length} stocks successfully validated!`);
		console.log(`✅ Data is locally cached for today (${today}) to prevent rate limits.`);
		process.exit(0);
	}
}

verifyData();
