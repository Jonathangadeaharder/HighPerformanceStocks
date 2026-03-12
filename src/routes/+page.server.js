import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

function parsePrice(str) {
	if (!str) return null;
	const n = parseFloat(String(str).replace(/[^0-9.]/g, ''));
	if (isNaN(n)) return null;
	if (/\d\s*p$/i.test(str)) return n / 100;
	return n;
}

export function load() {
	const dir = resolve('data/findings');
	const files = readdirSync(dir).filter(f => f.endsWith('.json'));

	const stocks = files.flatMap(f => {
		try {
			return [JSON.parse(readFileSync(resolve(dir, f), 'utf-8'))];
		} catch { return []; }
	});

	for (const s of stocks) {
		const cur = parsePrice(s.currentPrice);
		const tgt = parsePrice(s.targetPrice);
		s.upside = cur && tgt ? Math.round(((tgt - cur) / cur) * 100) : null;
	}

	const signals = stocks
		.filter(s => s.screener?.signal === 'PASS')
		.sort((a, b) => {
			if (a.screener.engine === b.screener.engine) {
				return a.screener.engine === 'fPERG'
					? a.screener.score - b.screener.score
					: b.screener.score - a.screener.score;
			}
			return a.screener.engine === 'fPERG' ? -1 : 1;
		});

	const watchlist = stocks
		.filter(s => s.screener?.signal !== 'PASS')
		.sort((a, b) => {
			const order = { REJECTED: 0, FAIL: 1, NO_DATA: 2 };
			const d = (order[a.screener?.signal] ?? 3) - (order[b.screener?.signal] ?? 3);
			return d !== 0 ? d : (a.screener?.score ?? 999) - (b.screener?.score ?? 999);
		});

	const lastUpdated = stocks.reduce((latest, s) =>
		(s.lastUpdated ?? '') > latest ? s.lastUpdated : latest, '').slice(0, 10);

	return {
		signals,
		watchlist,
		lastUpdated,
		counts: {
			total: stocks.length,
			pass: signals.length,
			rejected: watchlist.filter(s => s.screener?.signal === 'REJECTED').length,
			fail: watchlist.filter(s => s.screener?.signal === 'FAIL').length,
			noData: watchlist.filter(s => !s.screener || s.screener.signal === 'NO_DATA').length
		}
	};
}
