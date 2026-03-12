import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data', 'findings');

const HORIZON = 5;
const TERMINAL_GROWTH_PCT = 6;
const GROWTH_DECAY = 0.80;

function calcCAGR(price, ttmEPS, epsGrowthPct, exitPE, dividendYieldPct, horizon, decayFactor = GROWTH_DECAY) {
	let eps = ttmEPS;
	for (let yr = 1; yr <= horizon; yr++) {
		const g = TERMINAL_GROWTH_PCT + (epsGrowthPct - TERMINAL_GROWTH_PCT) * Math.pow(decayFactor, yr);
		eps *= 1 + g / 100;
	}
	const futurePrice = eps * exitPE;
	const priceReturn = Math.pow(futurePrice / price, 1 / horizon) - 1;
	return (priceReturn + dividendYieldPct / 100) * 100;
}

function parsePercent(str) {
	if (!str) return null;
	const m = str.match(/-?\d+(?:\.\d+)?/);
	return m ? parseFloat(m[0]) : null;
}

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

function verifyData() {
	const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
	let hasErrors = false;
	const today = new Date().toISOString().slice(0, 10);

	console.log(`🔍 Verifying ${files.length} stock files in ${DATA_DIR}...\n`);

	for (const f of files) {
		const filePath = resolve(DATA_DIR, f);
		let data;
		try {
			data = JSON.parse(readFileSync(filePath, 'utf-8'));
		} catch (e) {
			console.error(`❌ [${f}] Invalid JSON format.`);
			hasErrors = true;
			continue;
		}

		const errors = [];

		// 1. Verify all required fields exist and are not null/empty
		for (const field of requiredFields) {
			if (data[field] === undefined || data[field] === null || data[field] === '') {
				errors.push(`Missing required field: '${field}'`);
			}
		}

		// 2. Verify CAGR Model structure (if present)
		if (!data.cagrModel) {
			errors.push(`Missing 'cagrModel' object`);
		} else {
			if (!data.cagrModel.scenarios || !data.cagrModel.scenarios.base) {
				errors.push(`Missing 'cagrModel.scenarios.base'`);
			}
		}

		// 3. Verify Valuation & Metrics objects
		if (!data.valuation) errors.push(`Missing 'valuation' object`);
		if (!data.metrics) errors.push(`Missing 'metrics' object`);

		// 4. Verify Persistent Daily Cache (lastUpdated)
		if (!data.lastUpdated) {
			errors.push(`Missing 'lastUpdated' timestamp`);
		} else {
			const updatedDate = data.lastUpdated.slice(0, 10);
			if (updatedDate !== today) {
				errors.push(`Cache stale: lastUpdated is ${updatedDate} (Expected ${today})`);
			}
		}

		// 5. Verify screener object
		if (!data.screener) {
			errors.push(`Missing 'screener' object`);
		} else {
			const validEngines = ['fPERG', 'fEVG', 'fCFG', 'fANIG', 'fFREG', 'totalReturn', 'N/A'];
			const validSignals = ['PASS', 'WAIT', 'FAIL', 'REJECTED', 'NO_DATA'];
			if (!validEngines.includes(data.screener.engine)) {
				errors.push(`Invalid screener.engine: '${data.screener.engine}'`);
			}
			if (!validSignals.includes(data.screener.signal)) {
				errors.push(`Invalid screener.signal: '${data.screener.signal}'`);
			}
			if (data.screener.signal !== 'NO_DATA' && data.screener.score == null && !data.screener.note) {
				errors.push(`Screener has signal '${data.screener.signal}' but missing score`);
			}
		}

		// 6. Verify CAGR scenario math matches the exponential growth decay model
		const cm = data.cagrModel;
		if (cm && cm.ttmEPS && cm.epsGrowth && cm.exitPE && cm.scenarios && cm.horizon) {
			// Parse currentPrice — strip currency symbols/letters
			let price = null;
			if (data.currentPrice) {
				const priceStr = String(data.currentPrice).replace(/[^0-9.\-]/g, '');
				price = parseFloat(priceStr);
				// GBp/GBX prices are in pence; convert to pounds to match EPS units
				if (data.currentPrice.includes('£') === false && /GBp|GBX/i.test(data.currentPrice)) {
					price /= 100;
				}
			}
			const epsGrowthPct = parsePercent(cm.epsGrowth);
			const dividendYieldPct = parsePercent(cm.dividendYield) ?? 0;
			const horizon = cm.horizon ?? HORIZON;
			const decayFactor = typeof cm.decayFactor === 'number' ? cm.decayFactor : GROWTH_DECAY;

			if (price && !isNaN(price) && epsGrowthPct != null) {
				for (const [label, scenario] of Object.entries(cm.scenarios)) {
					const exitPE = cm.exitPE?.[label];
					const statedCAGR = parsePercent(scenario);
					if (statedCAGR == null) continue;
					if (exitPE == null) continue;

					const expectedCAGR = calcCAGR(price, cm.ttmEPS, epsGrowthPct, exitPE, dividendYieldPct, horizon, decayFactor);
					const rounded = Math.round(expectedCAGR);
					if (Math.abs(rounded - statedCAGR) > 2) {
						errors.push(`CAGR mismatch in '${label}': stated ${statedCAGR}% but model calculates ~${rounded}% (diff ${Math.abs(rounded - statedCAGR)}pp)`);
					}
				}
			}
		}

		if (errors.length > 0) {
			console.log(`❌ ${data.ticker || f} has issues:`);
			errors.forEach(e => console.log(`   - ${e}`));
			hasErrors = true;
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
