import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ETF_HURDLE_CAGR = 14;
const BEAR_FLOOR_CAGR = 0;

function parsePrice(str) {
	if (!str) return null;
	const n = parseFloat(String(str).replace(/[^0-9.]/g, ''));
	if (isNaN(n)) return null;
	if (/\d\s*p$/i.test(str)) return n / 100;
	return n;
}

function parsePercent(str) {
	if (!str) return null;
	const m = String(str).match(/-?\d+(?:\.\d+)?/);
	return m ? parseFloat(m[0]) : null;
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

		s.baseCagr = parsePercent(s.cagrModel?.scenarios?.base);
		s.bearCagr = parsePercent(s.cagrModel?.scenarios?.bear);
		s.bullCagr = parsePercent(s.cagrModel?.scenarios?.bull);

		const signal = s.screener?.signal ?? 'NO_DATA';
		if (signal === 'PASS') {
			const clearsHurdle = (s.baseCagr ?? -999) >= ETF_HURDLE_CAGR
				&& (s.bearCagr ?? -999) > BEAR_FLOOR_CAGR;
			s.deployment = clearsHurdle
				? { status: 'DEPLOY', reason: 'Valuation, forward return, and stabilization all pass.' }
				: { status: 'FAIL', reason: `Does not clear the ${ETF_HURDLE_CAGR}% ETF hurdle with a positive bear case.` };
		} else if (signal === 'WAIT') {
			s.deployment = { status: 'WAIT', reason: s.screener?.note ?? 'Cheap, but still stabilizing.' };
		} else if (signal === 'REJECTED') {
			s.deployment = { status: 'REJECT', reason: s.screener?.note ?? 'Consensus is deteriorating.' };
		} else if (signal === 'FAIL') {
			s.deployment = { status: 'FAIL', reason: s.screener?.note ?? 'No valuation edge.' };
		} else {
			s.deployment = { status: 'NO_DATA', reason: s.screener?.note ?? 'Insufficient data.' };
		}
	}

	const deployNow = stocks
		.filter(s => s.deployment?.status === 'DEPLOY')
		.sort((a, b) => {
			if (a.screener.engine === b.screener.engine) {
				return a.screener.engine === 'fPERG'
					? a.screener.score - b.screener.score
					: b.screener.score - a.screener.score;
			}
			return a.screener.engine === 'fPERG' ? -1 : 1;
		});

	const cheapWait = stocks
		.filter(s => s.deployment?.status === 'WAIT')
		.sort((a, b) => {
			return (a.screener?.score ?? 999) - (b.screener?.score ?? 999);
		});

	const watchlist = stocks
		.filter(s => !['DEPLOY', 'WAIT'].includes(s.deployment?.status))
		.sort((a, b) => {
			const order = { REJECT: 0, FAIL: 1, NO_DATA: 2 };
			const d = (order[a.deployment?.status] ?? 3) - (order[b.deployment?.status] ?? 3);
			if (d !== 0) return d;
			if (a.screener?.engine === b.screener?.engine) {
				return (a.screener?.score ?? 999) - (b.screener?.score ?? 999);
			}
			return a.screener?.engine === 'fPERG' ? -1 : 1;
		});

	const lastUpdated = stocks.reduce((latest, s) =>
		(s.lastUpdated ?? '') > latest ? s.lastUpdated : latest, '').slice(0, 10);

	return {
		deployNow,
		cheapWait,
		watchlist,
		lastUpdated,
		hurdles: {
			etfCagr: ETF_HURDLE_CAGR,
			bearFloor: BEAR_FLOOR_CAGR
		},
		counts: {
			total: stocks.length,
			deploy: deployNow.length,
			wait: cheapWait.length,
			reject: watchlist.filter(s => s.deployment?.status === 'REJECT').length,
			fail: watchlist.filter(s => s.deployment?.status === 'FAIL').length,
			noData: watchlist.filter(s => s.deployment?.status === 'NO_DATA').length
		}
	};
}
