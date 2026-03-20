import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { STOCK_RECORDS_DIR } from './lib/project-paths.js';
import { buildDashboardData } from './src/lib/domain/deployment.ts';
import type { FindingStock } from './src/lib/types/dashboard';

const DATA_DIR = STOCK_RECORDS_DIR;

async function main() {
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    const stocks: FindingStock[] = files.map((f) => {
        const path = resolve(DATA_DIR, f);
        return JSON.parse(readFileSync(path, 'utf-8'));
    });

    // We need a dummy vol signal
    const data = buildDashboardData(stocks, 'LOW');

    console.log('\n--- TOP 10 DEPLOYMENT RANKS (NEW STANDARDIZED ENGINE) ---\n');
    data.deployNow.slice(0, 10).forEach((s, i) => {
        console.log(`${i + 1}. ${s.ticker.padEnd(8)} | Rank: ${String(s.deploymentRank?.toFixed(1)).padEnd(5)} | Base CAGR: ${String(s.baseCagr).padEnd(4)}% | QCS: ${String(s.qcs?.totalScore).padEnd(4)} | Quality: ${String(s.metrics?.roe)} ROE / ${s.metrics?.fcfYield} FCFY`);
    });
    console.log('\n--------------------------------------------------------\n');
}

main().catch(console.error);
