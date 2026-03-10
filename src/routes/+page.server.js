import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const CAGR_FLOOR = 14; // minimum expected CAGR to beat momentum ETFs

const GROUP_ORDER = [
	'Serial Acquirers',
	'AI & Semiconductors',
	'Healthcare Monopolies',
	'Financials & Alt Assets',
	'Defensive Monopolies',
	'Royalties',
	'Energy Royalties',
	'Emerging Markets',
	'Ruthlessly Cut',
	'Disqualified'
];

function parseCAGRRange(cagr) {
	const nums = [...(cagr?.matchAll(/(-?\d+(?:\.\d+)?)\s*%/g) ?? [])].map(m => parseFloat(m[1]));
	return { lower: nums[0] ?? 0, upper: nums[nums.length - 1] ?? 0 };
}

function parsePrice(str) {
	if (!str) return null;
	const m = str.replace(/[^0-9.]/g, '');
	const n = parseFloat(m);
	if (isNaN(n)) return null;
	// Convert pence to pounds (e.g. "5,634p" → 56.34)
	if (/\d\s*p$/i.test(str)) return n / 100;
	return n;
}

function parsePercent(str) {
	if (!str) return null;
	const m = str.match(/-?\d+(?:\.\d+)?/);
	return m ? parseFloat(m[0]) : null;
}

function deriveConfidence(stock) {
	const model = stock.cagrModel;
	const scenarios = model?.scenarios;

	if (!scenarios?.base) {
		return {
			confidence: 'cut',
			confidenceReason: model?.note || 'No CAGR model available'
		};
	}

	const base = parsePercent(scenarios.base);
	const bear = parsePercent(scenarios.bear);
	const bull = parsePercent(scenarios.bull);

	if (base === null) {
		return { confidence: 'cut', confidenceReason: 'Unable to parse CAGR model' };
	}

	const epsGrowth = parsePercent(model.epsGrowth);
	const exitPE = model.exitPE?.base;
	const currentPE = stock.currentPrice && model.ttmEPS
		? (parsePrice(stock.currentPrice) / model.ttmEPS).toFixed(0)
		: null;
	const dy = parsePercent(model.dividendYield) || 0;

	let confidence, confidenceReason;

	if (base >= 18 && bear !== null && bear >= 10) {
		confidence = 'high';
		const floor = bear !== null ? ` with ${bear}% downside floor` : '';
		const detail = epsGrowth !== null && exitPE
			? ` (EPS growth ${epsGrowth}%, exit PE ${exitPE})`
			: '';
		confidenceReason = `Base CAGR ${base}%${floor}${detail}`;
		if (dy >= 1) confidenceReason += ` + ${dy}% dividend`;
	} else if (base >= 10) {
		confidence = 'medium';
		const bearNote = bear !== null ? `, ${bear}% bear case` : '';
		confidenceReason = `Base CAGR ${base}%${bearNote}`;
		if (epsGrowth !== null) confidenceReason += ` on ${epsGrowth}% EPS growth`;
		if (dy >= 1) confidenceReason += ` + ${dy}% dividend`;
	} else if (base >= 3) {
		confidence = 'low';
		confidenceReason = `Base CAGR only ${base}%`;
		if (currentPE && exitPE) {
			confidenceReason += ` — PE compression from ${currentPE}x to ${exitPE}x`;
		}
		if (epsGrowth !== null) confidenceReason += ` despite ${epsGrowth}% EPS growth`;
	} else {
		confidence = 'cut';
		confidenceReason = `Base CAGR ${base}%`;
		if (currentPE && exitPE) {
			confidenceReason += ` — PE compression from ${currentPE}x to ${exitPE}x overwhelms`;
		}
		if (epsGrowth !== null) confidenceReason += ` ${epsGrowth}% EPS growth`;
	}

	return { confidence, confidenceReason };
}

const confidenceOrder = { high: 0, medium: 1, low: 2, cut: 3 };

export function load() {
	const dir = resolve('data/findings');
	const files = readdirSync(dir).filter(f => f.endsWith('.json'));

	const stocks = files.flatMap(f => {
		try {
			const raw = readFileSync(resolve(dir, f), 'utf-8');
			return [JSON.parse(raw)];
		} catch (err) {
			console.error(`❌ Skipping ${f}: ${err.message}`);
			return [];
		}
	});

	// Tag stocks relative to CAGR floor, compute upside, derive confidence
	for (const s of stocks) {
		const { lower, upper } = parseCAGRRange(s.expectedCAGR);
		s.belowCAGRFloor = upper < CAGR_FLOOR;
		s.cagrRangeLow = lower;
		s.cagrRangeHigh = upper;

		const cur = parsePrice(s.currentPrice);
		const tgt = parsePrice(s.targetPrice);
		s.upside = cur && tgt ? Math.round(((tgt - cur) / cur) * 100) : null;

		// Override manual confidence with model-derived confidence
		const derived = deriveConfidence(s);
		s.confidence = derived.confidence;
		s.confidenceReason = derived.confidenceReason;

		// Staleness detection: days since last update
		s.dataAge = s.lastUpdated
			? Math.floor((Date.now() - new Date(s.lastUpdated).getTime()) / 86400000)
			: null;
	}

	// Sort: confidence tier (derived), then Sharpe descending
	stocks.sort((a, b) => {
		const c = (confidenceOrder[a.confidence] ?? 9) - (confidenceOrder[b.confidence] ?? 9);
		if (c !== 0) return c;
		return (b.sharpeRatio ?? 0) - (a.sharpeRatio ?? 0);
	});

	return { stocks, cagrFloor: CAGR_FLOOR, groups: GROUP_ORDER };
}
