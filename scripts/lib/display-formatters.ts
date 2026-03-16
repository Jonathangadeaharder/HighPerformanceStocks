export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

export function isUpToDate(stock, force = false) {
	return !force && stock.lastUpdated?.slice(0, 10) === todayISO();
}

export function parseNumber(value) {
	if (value == null) return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;

	const match = String(value).match(/-?\d+(?:\.\d+)?/);
	return match ? Number.parseFloat(match[0]) : null;
}

export function fmtPct(value, decimals = 0) {
	if (value == null) return null;
	return `${value.toFixed(decimals)}%`;
}

export function fmtRoundPct(value) {
	if (value == null) return null;
	return `${Math.round(value)}%`;
}

export function fmtApproxPct(value) {
	if (value == null) return null;
	return `~${Math.round(value)}%`;
}

export function fmtMultiple(value, decimals = 1) {
	if (value == null) return null;
	return `${value.toFixed(decimals)}x`;
}

export function fmtPrice(rawPrice, currency) {
	if (rawPrice == null) return null;
	if (currency === 'GBp' || currency === 'GBX') {
		return `£${(rawPrice / 100).toFixed(2)}`;
	}
	if (currency === 'SEK') return `${Math.round(rawPrice)} SEK`;
	if (currency === 'CAD') return `C$${rawPrice % 1 === 0 ? rawPrice : rawPrice.toFixed(2)}`;
	if (currency === 'HKD') return `HK$${rawPrice % 1 === 0 ? rawPrice : rawPrice.toFixed(2)}`;

	const symbol = { USD: '$', EUR: '€' }[currency] ?? `${currency} `;
	return `${symbol}${rawPrice % 1 === 0 ? rawPrice : rawPrice.toFixed(2)}`;
}

export function fmtMarketCap(rawCap, currency) {
	if (!rawCap) return null;

	const billions = (rawCap / 1e9).toFixed(1);
	if (currency === 'GBp' || currency === 'GBX') return `£${(rawCap / 1e9).toFixed(1)}B`;
	if (currency === 'SEK') return `${billions}B SEK`;
	if (currency === 'CAD') return `C$${billions}B`;
	if (currency === 'HKD') return `HK$${billions}B`;

	const symbol = { USD: '$', EUR: '€' }[currency] ?? `${currency} `;
	const suffix = currency === 'USD' ? ' USD' : '';
	return `${symbol}${billions}B${suffix}`;
}
