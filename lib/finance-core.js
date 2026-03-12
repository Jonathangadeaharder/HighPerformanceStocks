export const DEFAULT_HORIZON = 5;
export const TERMINAL_GROWTH_PCT = 6;
export const DEFAULT_GROWTH_DECAY = 0.8;

export function parsePercent(value) {
	if (!value) return null;

	const match = String(value).match(/-?\d+(?:\.\d+)?/);
	return match ? Number.parseFloat(match[0]) : null;
}

export function parseDisplayPrice(value) {
	if (!value) return null;

	const parsedNumber = Number.parseFloat(String(value).replace(/[^0-9.]/g, ''));
	if (Number.isNaN(parsedNumber)) return null;
	if (/\d\s*p$/i.test(String(value))) return parsedNumber / 100;
	return parsedNumber;
}

export function calcDecayedCagr({
	price,
	ttmEPS,
	epsGrowthPct,
	exitPE,
	dividendYieldPct = 0,
	horizon = DEFAULT_HORIZON,
	decayFactor = DEFAULT_GROWTH_DECAY
}) {
	let eps = ttmEPS;

	for (let year = 1; year <= horizon; year += 1) {
		const growthPct =
			TERMINAL_GROWTH_PCT + (epsGrowthPct - TERMINAL_GROWTH_PCT) * Math.pow(decayFactor, year);
		eps *= 1 + growthPct / 100;
	}

	const futurePrice = eps * exitPE;
	const priceReturn = Math.pow(futurePrice / price, 1 / horizon) - 1;
	return (priceReturn + dividendYieldPct / 100) * 100;
}
