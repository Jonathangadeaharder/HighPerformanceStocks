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
		targetMeanPrice?: number;
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
	// DEPLOY is a manual override stronger than PASS: QCS ≥ 8 + bear CAGR ≥ 20% triggers mandatory deployment.
	signal: 'DEPLOY' | 'FLAG FOR MANUAL REVIEW' | 'PASS' | 'FAIL' | 'WAIT' | 'REJECTED' | 'NO_DATA';
	inputs?: ScreenerInputs;
	note?: string;
	secondaryEngine?: string;
	secondaryScore?: number | null;
	realityChecks?: RealityChecks;
}

export interface ScreenerStock {
	cagrModel?: {
		ttmEPS?: number | null;
		epsGrowth?: string;
		dividendYield?: string;
		scenarios?: {
			base?: string;
			bear?: string;
		};
		basis?: string;
	};
	valuation?: {
		forwardPE?: number;
		/** Used by the P/E divergence guard in applyRealityChecks */
		trailingPE?: number;
		evEbitda?: number | null;
		evFcf?: number | null;
		priceToFRE?: number;
	};
	/**
	 * Operational metrics used by detectGrowthBranch for automatic engine routing.
	 * - netDebtEbitda: parsed to detect leveraged industrials (→ fEVG when > 1.5x)
	 * - fcfMargin: parsed to detect high-FCF SBC-distorted platforms (→ fCFG when ≥ 25%)
	 */
	metrics?: {
		netDebtEbitda?: string;
		fcfMargin?: string;
		roic?: string | null;
		roe?: string;
		beta?: string;
		interestCoverage?: string;
	};
	group?: string;
	bearCase?: string;
	qcs?: {
		totalScore?: number;
	};
	analystTargets?: {
		mean?: number;
	};
	targetPrice?: string;
}

// EngineKey covers quantitative engines + manual valuation frameworks:
// NAV = Net Asset Value (holding companies, conglomerates like INVE-B.ST)
// P/B = Price-to-Book (financials, insurance with book-value-driven returns)
type EngineKey = 'fPERG' | 'tPERG' | 'fEVG' | 'fFREG' | 'fANIG' | 'fCFG' | 'NAV' | 'P/B' | 'DISQUALIFIED';

export const ENGINE_THRESHOLDS: Record<EngineKey, number> = {
	fPERG: 1,
	tPERG: 1,
	fEVG: 0.8,
	fFREG: 0.8,
	fANIG: 0.8,
	fCFG: 0.8,
	NAV: 1, // NAV-based: score = Price/NAV; pass if at or below NAV
	'P/B': 1, // P/B-based: score = P/B relative to growth-normalized threshold
	DISQUALIFIED: 0
};
