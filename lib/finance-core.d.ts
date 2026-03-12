export const DEFAULT_HORIZON: number;
export const TERMINAL_GROWTH_PCT: number;
export const DEFAULT_GROWTH_DECAY: number;

export function parsePercent(value: string | number | null | undefined): number | null;
export function parseDisplayPrice(value: string | number | null | undefined): number | null;
export function calcDecayedCagr(input: {
	price: number;
	ttmEPS: number;
	epsGrowthPct: number;
	exitPE: number;
	dividendYieldPct?: number;
	horizon?: number;
	decayFactor?: number;
}): number;
