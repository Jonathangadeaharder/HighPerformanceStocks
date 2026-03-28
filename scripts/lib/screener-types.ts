export interface EarningsTrendEntry {
	period?: string;
	earningsEstimate?: {
		avg?: number;
		low?: number;
		high?: number;
	};
	epsRevisions?: {
		upLast30days?: number;
		downLast30days?: number;
	};
}

export interface EarningsTrend {
	trend?: EarningsTrendEntry[];
}

export interface EarningsHistoryEntry {
	quarter?: string;
	epsActual?: number;
	epsEstimate?: number;
}

export interface EarningsHistory {
	history?: EarningsHistoryEntry[];
}

export interface YahooSummary {
	earningsTrend?: EarningsTrend;
	earningsHistory?: EarningsHistory;
	financialData?: {
		debtToEquity?: number;
	};
}

export interface HistoricalData {
	price6mAgo?: number;
	price3mAgo?: number;
	price1mAgo?: number;
	low3m?: number;
	exAnteVol?: number;
}

export interface GrowthBranch {
	engine: string;
	multipleType: string;
	multiple?: number | null;
}

export interface ScreenerInputs {
	growth?: number;
	multipleType?: string;
	multiple?: number;
	cvStock?: number;
	riskMultiplier?: number;
	dividendYield?: number;
	earningsYield?: number;
	debtToEquity?: number;
	debtPenalty?: boolean;
	rawReturn?: number;
}

export interface StabilizationCheck {
	pass: boolean;
	price: number;
	price6mAgo: number;
	price1mAgo: number;
	low3m: number;
	return6m: number;
	return1m: number;
	near3mLow: boolean;
}

export interface RevisionsCheck {
	pass: boolean;
	up30d: number;
	down30d: number;
}

export interface EarningsSurpriseCheck {
	surprise: number;
	quarter: string;
}

export interface RealityChecks {
	stabilization?: StabilizationCheck;
	revisions?: RevisionsCheck;
	earningsSurprise?: EarningsSurpriseCheck;
}

export interface ScreenerResult {
	engine: string;
	score?: number | null;
	signal: 'PASS' | 'FAIL' | 'WAIT' | 'REJECTED' | 'NO_DATA';
	inputs?: ScreenerInputs;
	note?: string;
	secondaryEngine?: string;
	secondaryScore?: number | null;
	realityChecks?: RealityChecks;
}

export interface ScreenerStock {
	cagrModel?: {
		ttmEPS?: number;
		epsGrowth?: string;
		dividendYield?: string;
		scenarios?: {
			base?: string;
		};
		basis?: string;
	};
	valuation?: {
		forwardPE?: number;
		evEbitda?: number | null;
		evFcf?: number | null;
		priceToFRE?: number;
	};
	group?: string;
	cyclical?: boolean;
}

type EngineKey = 'fPERG' | 'tPERG' | 'fEVG' | 'fFREG' | 'fANIG' | 'fCFG';

export const ENGINE_THRESHOLDS: Record<EngineKey, number> = {
	fPERG: 1,
	tPERG: 1,
	fEVG: 0.8,
	fFREG: 0.8,
	fANIG: 0.8,
	fCFG: 0.8
};
