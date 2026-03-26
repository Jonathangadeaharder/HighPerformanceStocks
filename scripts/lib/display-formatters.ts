export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function todayISO(): string {
	return new Date().toISOString().slice(0, 10);
}

export function isUpToDate(stock: { lastUpdated?: string }, force = false): boolean {
	return !force && stock.lastUpdated?.slice(0, 10) === todayISO();
}

export function parseNumber(value: unknown): number | null {
	if (value == null) return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value !== 'string' && typeof value !== 'number') return null;

	const match = /-?\d+(?:\.\d+)?/.exec(String(value));
	return match ? Number.parseFloat(match[0]) : null;
}

export function fmtPct(value: number | null | undefined, decimals = 0): string | null {
	if (value == null) return null;
	return `${value.toFixed(decimals)}%`;
}

export function fmtRoundPct(value: number | null | undefined): string {
	if (value == null) return '0%';
	return `${Math.round(value)}%`;
}

export function fmtApproxPct(value: number | null | undefined): string | null {
	if (value == null) return null;
	return `~${Math.round(value)}%`;
}

export function fmtMultiple(value: number | null | undefined, decimals = 1): string | null {
	if (value == null) return null;
	return `${value.toFixed(decimals)}x`;
}

export function fmtPrice(rawPrice: number | null | undefined, currency: string): string | null {
	if (rawPrice == null) return null;
	if (currency === 'GBp' || currency === 'GBX') {
		return `£${(rawPrice / 100).toFixed(2)}`;
	}
	if (currency === 'SEK') return `${Math.round(rawPrice)} SEK`;
	if (currency === 'CAD') return `C$${rawPrice % 1 === 0 ? rawPrice : rawPrice.toFixed(2)}`;
	if (currency === 'HKD') return `HK$${rawPrice % 1 === 0 ? rawPrice : rawPrice.toFixed(2)}`;

	const symbol: Record<string, string> = { USD: '$', EUR: '€' };
	const sym = symbol[currency] ?? `${currency} `;
	return `${sym}${rawPrice % 1 === 0 ? rawPrice : rawPrice.toFixed(2)}`;
}

export function fmtMarketCap(rawCap: number | null | undefined, currency: string): string | null {
	if (!rawCap) return null;

	const billions = (rawCap / 1e9).toFixed(1);
	if (currency === 'GBp' || currency === 'GBX') return `£${(rawCap / 1e9).toFixed(1)}B`;
	if (currency === 'SEK') return `${billions}B SEK`;
	if (currency === 'CAD') return `C$${billions}B`;
	if (currency === 'HKD') return `HK$${billions}B`;

	const symbolMap: Record<string, string> = { USD: '$', EUR: '€' };
	const sym = symbolMap[currency] ?? `${currency} `;
	const suffix = currency === 'USD' ? ' USD' : '';
	return `${sym}${billions}B${suffix}`;
}
