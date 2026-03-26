import { loadFindingStocks } from './src/lib/server/findings';
import { buildDashboardData } from './src/lib/domain/deployment';

const stocks = await loadFindingStocks();
const nvo = stocks.find((s) => s.ticker === 'NVO');

if (nvo) {
	console.log('📊 NVO Found:');
	console.log(`  Ticker: ${nvo.ticker}`);
	console.log(`  Name: ${nvo.name}`);
	console.log(`  Screener: ${nvo.screener.signal} (score: ${nvo.screener.score})`);
	console.log(`  Expected CAGR: ${nvo.expectedCAGR}`);
	console.log(`  Target: ${nvo.targetPrice}`);
} else {
	console.log('❌ NVO not found');
}

const dashboard = buildDashboardData(stocks, { tone: 'hold', signal: 'neutral' });
const nvoInDeploy = dashboard.deployNow.find((s) => s.ticker === 'NVO');
const nvoInWait = dashboard.cheapWait.find((s) => s.ticker === 'NVO');
const nvoInWatchlist = dashboard.watchlist.find((s) => s.ticker === 'NVO');

console.log('\n📈 Dashboard Classification:');
if (nvoInDeploy) console.log(`  ✓ In DEPLOY section (rank ${nvoInDeploy.deploymentRank})`);
if (nvoInWait) console.log(`  ✓ In WAIT section (rank ${nvoInWait.deploymentRank})`);
if (nvoInWatchlist)
	console.log(`  ✓ In WATCHLIST section (reason: ${nvoInWatchlist.deploymentStatus})`);
