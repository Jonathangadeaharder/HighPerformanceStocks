import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import type { ForwardEstimates } from '../../src/lib/types/dashboard.js';

const execFileAsync = promisify(execFile);

export async function fetchAllMarketWatch(tickers: string[]): Promise<Record<string, ForwardEstimates>> {
	if (tickers.length === 0) return {};

	const scriptPath = resolve(process.cwd(), 'scripts', 'lib', 'crawlers', 'marketwatch.py');
	
	console.log(`\n🕵️  Spawning MarketWatch CDP Crawler for ${tickers.length} tickers...`);
	console.log(`   (This may take several minutes due to required anti-bot jitter and browser startup)`);
	
	try {
		// Pass tickers as a JSON array string to Python
		const { stdout, stderr } = await execFileAsync('python', [scriptPath, JSON.stringify(tickers)], {
			maxBuffer: 10 * 1024 * 1024 // 10MB buffer just in case
		});

		// Python eprint() outputs to stderr to avoid polluting the JSON payload
		if (stderr) {
			// We can optionally log the stderr for debugging if needed, but it's noisy.
			// Let's just log a summary if it finishes successfully
			console.log(`   Crawler finished execution.`);
		}

		if (!stdout.trim()) {
			console.log(`  ❌ MarketWatch Crawler returned empty stdout`);
			return {};
		}

		let jsonPayload = stdout.trim();
		// nodriver sometimes leaks 'successfully removed temp profile' to stdout on exit
		const firstBrace = stdout.indexOf('{');
		const lastBrace = stdout.lastIndexOf('}');
		if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
			jsonPayload = stdout.slice(firstBrace, lastBrace + 1);
		}

		const parsed: Record<string, ForwardEstimates> = JSON.parse(jsonPayload);
		const hitCount = Object.keys(parsed).length;
		console.log(`  ✅ Successfully extracted multi-year EPS for ${hitCount} / ${tickers.length} stocks.`);
		
		return parsed;
		
	} catch (error: any) {
		console.error(`  ❌ MarketWatch Crawler execution failed:`, error.message);
		if (error.stderr) {
			console.error(`  --- Crawler Traceback ---`);
			console.error(error.stderr);
		}
		return {};
	}
}
