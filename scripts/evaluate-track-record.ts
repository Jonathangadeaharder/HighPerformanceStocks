import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
	evaluateSnapshot,
	parseNumericPrice,
	type SnapshotItem
} from '../src/lib/domain/ranking/track-record.js';
import { STOCK_RECORDS_DIR } from '../src/lib/server/infrastructure/paths.js';

const HISTORY_DIR = resolve(process.cwd(), 'data', 'history');
const KNOWN_SPLITS: Record<string, number> = {
	BKNG: 25,
	CRWD: 4
};

function loadCurrentStocks(): Map<string, { price: number; targetPrice?: number | null }> {
	const map = new Map<string, { price: number; targetPrice?: number | null }>();
	const files = readdirSync(STOCK_RECORDS_DIR).filter((f) => f.endsWith('.json'));

	for (const file of files) {
		try {
			const data = JSON.parse(readFileSync(join(STOCK_RECORDS_DIR, file), 'utf-8'));
			const price = parseNumericPrice(data.currentPrice);
			if (price != null && price > 0) {
				const target = parseNumericPrice(data.targetPrice);
				map.set(data.ticker, { price, targetPrice: target });
			}
		} catch {
			// Skip unreadable files
		}
	}
	return map;
}

function loadSnapshotFile(path: string): SnapshotItem[] {
	const raw = JSON.parse(readFileSync(path, 'utf-8'));
	if (Array.isArray(raw)) return raw;

	// Convert dictionary format to array if needed
	return Object.entries(raw).map(([ticker, val]: [string, any]) => ({
		ticker,
		price: val.price,
		signal: val.signal,
		deployment: val.deployment,
		score: val.score,
		target: val.target ?? val.targetPrice
	}));
}

function printTable(headers: string[], rows: string[][]): void {
	const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)));
	const formatRow = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i]!)).join(' | ');

	console.log(formatRow(headers));
	console.log(widths.map((w) => '-'.repeat(w)).join('-+-'));
	for (const row of rows) {
		console.log(formatRow(row));
	}
}

export function runEvaluation(): void {
	const args = process.argv.slice(2);
	const baselineArg = args.find((a) => a.startsWith('--baseline='))?.split('=')[1];
	const saveArg = args.includes('--save');

	if (!existsSync(HISTORY_DIR)) {
		console.error(`❌ History directory not found at ${HISTORY_DIR}.`);
		process.exit(1);
	}

	const historyFiles = readdirSync(HISTORY_DIR)
		.filter((f) => f.endsWith('.json') && !f.startsWith('evaluation'))
		.sort((a, b) => a.localeCompare(b));

	if (historyFiles.length === 0) {
		console.error('❌ No historical snapshot files found in data/history/.');
		process.exit(1);
	}

	const selectedFile = baselineArg ? `${baselineArg}.json` : historyFiles[0]!;
	const snapshotPath = join(HISTORY_DIR, selectedFile);

	if (!existsSync(snapshotPath)) {
		console.error(`❌ Snapshot file ${selectedFile} not found in ${HISTORY_DIR}.`);
		process.exit(1);
	}

	const baselineDate = selectedFile.replace('.json', '');
	const currentDate = new Date().toISOString().slice(0, 10);
	const baselineItems = loadSnapshotFile(snapshotPath);
	const currentStocks = loadCurrentStocks();

	const report = evaluateSnapshot(
		baselineItems,
		currentStocks,
		baselineDate,
		currentDate,
		KNOWN_SPLITS
	);

	console.log(`\n======================================================`);
	console.log(`  PORTFOLIO PERFORMANCE & TRACK RECORD EVALUATION`);
	console.log(`  Baseline Date: ${report.baselineDate} | Evaluation Date: ${report.currentDate}`);
	console.log(`  Total Evaluated Tickers: ${report.totalStocks}`);
	console.log(`======================================================\n`);

	const basketHeaders = ['Basket', 'Count', 'Mean %', 'Median %', 'Win %', 'Best Ticker', 'Max DD %'];
	const b = report.baskets;

	const basketRows = [
		[
			'DEPLOY',
			String(b.deploy.count),
			`+${b.deploy.meanReturn}%`,
			`+${b.deploy.medianReturn}%`,
			`${b.deploy.winRate}%`,
			b.deploy.bestPerformer ? `${b.deploy.bestPerformer.ticker} (+${b.deploy.bestPerformer.returnPct}%)` : '-',
			`-${b.deploy.maxDrawdown}%`
		],
		[
			'TRIM',
			String(b.trim.count),
			`${b.trim.meanReturn >= 0 ? '+' : ''}${b.trim.meanReturn}%`,
			`${b.trim.medianReturn >= 0 ? '+' : ''}${b.trim.medianReturn}%`,
			`${b.trim.winRate}%`,
			b.trim.bestPerformer ? `${b.trim.bestPerformer.ticker} (+${b.trim.bestPerformer.returnPct}%)` : '-',
			`-${b.trim.maxDrawdown}%`
		],
		[
			'WAIT',
			String(b.wait.count),
			`${b.wait.meanReturn >= 0 ? '+' : ''}${b.wait.meanReturn}%`,
			`${b.wait.medianReturn >= 0 ? '+' : ''}${b.wait.medianReturn}%`,
			`${b.wait.winRate}%`,
			b.wait.bestPerformer ? `${b.wait.bestPerformer.ticker} (+${b.wait.bestPerformer.returnPct}%)` : '-',
			`-${b.wait.maxDrawdown}%`
		],
		[
			'FAIL / REJECT',
			String(b.fail.count),
			`${b.fail.meanReturn >= 0 ? '+' : ''}${b.fail.meanReturn}%`,
			`${b.fail.medianReturn >= 0 ? '+' : ''}${b.fail.medianReturn}%`,
			`${b.fail.winRate}%`,
			b.fail.bestPerformer ? `${b.fail.bestPerformer.ticker} (+${b.fail.bestPerformer.returnPct}%)` : '-',
			`-${b.fail.maxDrawdown}%`
		],
		[
			'UNIVERSE (ALL)',
			String(b.overall.count),
			`${b.overall.meanReturn >= 0 ? '+' : ''}${b.overall.meanReturn}%`,
			`${b.overall.medianReturn >= 0 ? '+' : ''}${b.overall.medianReturn}%`,
			`${b.overall.winRate}%`,
			b.overall.bestPerformer ? `${b.overall.bestPerformer.ticker} (+${b.overall.bestPerformer.returnPct}%)` : '-',
			`-${b.overall.maxDrawdown}%`
		]
	];

	printTable(basketHeaders, basketRows);

	console.log(`\nALPHA VS UNIVERSE: ${report.alphaVsUniverse >= 0 ? '+' : ''}${report.alphaVsUniverse}%\n`);

	const sortedDeploy = report.stocks
		.filter((s) => s.deployment === 'DEPLOY')
		.sort((a, b) => b.returnPct - a.returnPct);

	if (sortedDeploy.length > 0) {
		console.log(`--- Top DEPLOY Performers ---`);
		const topHeaders = ['Ticker', 'Base Price', 'Current Price', 'Return %', 'Target Price', 'Target Hit'];
		const topRows = sortedDeploy.slice(0, 8).map((s) => [
			s.ticker,
			`$${s.basePrice}`,
			`$${s.currentPrice}`,
			`+${s.returnPct}%`,
			s.targetPrice ? `$${s.targetPrice}` : 'N/A',
			s.targetMet ? 'YES' : 'NO'
		]);
		printTable(topHeaders, topRows);
	}

	if (saveArg) {
		const outPath = join(HISTORY_DIR, `evaluation-${baselineDate}-to-${currentDate}.json`);
		writeFileSync(outPath, JSON.stringify(report, null, 2));
		console.log(`\n💾 Saved detailed report to ${outPath}`);
	}
}

if (process.argv[1]?.endsWith('evaluate-track-record.ts')) {
	runEvaluation();
}
