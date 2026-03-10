import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data', 'findings');

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
