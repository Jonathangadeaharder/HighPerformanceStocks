const fs = require('fs');
const stocks = fs.readdirSync('data/stock-records')
  .filter(f => f.endsWith('.json'))
  .map(f => require('../../data/stock-records/' + f));

const subset = stocks.filter(s => ['DEPLOY', 'OVERPRICED', 'WAIT'].includes(s.deployment?.status));
subset.sort((a,b) => (a.screener?.score || 99) - (b.screener?.score || 99));

for (const s of subset) {
  const status = (s.deployment?.status || '').padEnd(10);
  const engine = (s.screener?.engine || '').padEnd(12);
  const score = s.screener?.score || 'N/A';
  const mult = s.screener?.inputs?.multiple || 'N/A';
  const multType = s.screener?.inputs?.multipleType || 'N/A';
  const growth = s.screener?.inputs?.growth || s.cagrModel?.scenarios?.base || 'N/A';
  const return6m = s.screener?.realityChecks?.stabilization?.return6m ?? 'N/A';
  const price = s.currentPrice;
  const target = s.targetPrice;
  
  console.log(`${s.ticker.padEnd(8)} | ${status} | ${engine} | Score: ${score} | ${multType}: ${mult} | Gr/CAGR: ${growth} | 6m: ${return6m}%`);
}
