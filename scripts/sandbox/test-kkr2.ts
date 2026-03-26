import { computeScreener } from './scripts/lib/screener.ts';
import fs from 'fs';
const data = JSON.parse(fs.readFileSync('data/stock-records/KKR.json', 'utf8'));
const summary = {
	earningsTrend: {
		trend: [{ period: '+1y', epsRevisions: { upLast30days: 0, downLast30days: 6 } }]
	}
};
const r = computeScreener(data, summary, 100, 100, {});
console.log(r);
