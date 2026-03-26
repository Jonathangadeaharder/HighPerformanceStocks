import { loadFindingStocks } from './src/lib/server/findings';
import { assignDeployment } from './src/lib/domain/deployment';
async function main() {
	const list = await loadFindingStocks();
	const evaluated = assignDeployment(list);
	const pe = evaluated.filter((s) =>
		['APO', 'KKR', 'BN', 'ARES', 'EQT.ST', 'OWL', 'CG'].includes(s.ticker)
	);
	for (const p of pe) {
		console.log(
			p.ticker.padEnd(6) +
				' | Status: ' +
				p.deployment.status.padEnd(10) +
				' | Pct: ' +
				p.cagrModel.scenarios.base +
				' | Engine: ' +
				p.screener?.engine +
				' | Reason: ' +
				(p.screener?.note || p.screener?.signal)
		);
	}
}
main();
