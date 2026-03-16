import fs from 'fs';
import path from 'path';
import { buildDashboardData } from './src/lib/domain/deployment';

const DATA_DIR = 'data/stock-records';

function main() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    const stocks = files.map(f => {
        const fullPath = path.resolve(DATA_DIR, f);
        return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    });

    const dashboard = buildDashboardData(stocks, { source: 'VIX', signal: 'WAIT', score: 25, value: 25, fallbackActive: false });

    console.log('\n--- NEW TOP PICKS (DIVERSIFIED) ---');
    dashboard.topPicks.forEach(s => {
        console.log(`[${s.pickLabel}] ${s.ticker} (${s.group}) | Rank: ${s.deploymentRank}`);
    });

    console.log('\n--- NEW DEPLOY RANKINGS (w/ Quality & Dynamic Momentum) ---');
    dashboard.deployNow.forEach((s, idx) => {
        const return6m = s.screener?.realityChecks?.stabilization?.return6m ?? 0;
        const return1m = s.screener?.realityChecks?.stabilization?.return1m ?? 0;
        const roe = s.metrics?.roe ?? 'N/A';
        const fcfYield = s.metrics?.fcfYield ?? 'N/A';
        const r40 = s.metrics?.ruleOf40 ?? 'N/A';

        console.log(`${idx + 1}. ${s.ticker} | Rank: ${s.deploymentRank} | Mom(6m-1m): ${(return6m - return1m).toFixed(1)}% | Q(ROE:${roe}, FCF:${fcfYield}, R40:${r40})`);
    });
}

main();
