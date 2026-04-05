export type ScenarioKey = 'bear' | 'base' | 'bull';
export type DeploymentStatus = 'DEPLOY' | 'WAIT' | 'REJECT' | 'FAIL' | 'OVERPRICED' | 'NO_DATA' | 'FLAG FOR MANUAL REVIEW';
export type ScreenerSignal = 'FLAG FOR MANUAL REVIEW' | 'PASS' | 'WAIT' | 'REJECTED' | 'FAIL' | 'NO_DATA';
export type VolTone = 'buy' | 'hold' | 'sell';

export interface VolComponent {
	label: string;
	symbol: string;
	weight: number;
	value: number | null;
	marketTime: string | null;
	fresh?: boolean;
	reason?: string | null;
}

export interface AvailableWorldVolSignal {
	available: true;
	method: 'composite';
	source: string;
	impliedVol: number;
	action: string;
	band: string;
	tone: VolTone;
	note: string;
	expiry?: string | null;
	daysToExpiry?: number;
	symbol?: string;
	underlyingPrice?: number | null;
	sampleSize?: number;
	primarySource?: string;
	components?: VolComponent[];
}

export interface UnavailableWorldVolSignal {
	available: false;
	source: string;
	reason: string;
}

export type WorldVolSignal = AvailableWorldVolSignal | UnavailableWorldVolSignal;

export interface ScreenerInputs {
	multipleType?: string;
	multiple?: number;
	growth?: number;
	dividendYield?: number;
	debtPenalty?: boolean;
	cvStock?: number;
	riskMultiplier?: number;
	forwardPE?: number;
	trailingPE?: number;
	evEbitda?: number;
	fcfYield?: number;
	freYield?: number;
	aniYield?: number;
	priceToBook?: number;
}

export interface StabilizationRealityCheck {
	pass?: boolean;
	price?: number;
	price6mAgo?: number;
	price1mAgo?: number;
	low3m?: number;
	return6m?: number;
	return1m?: number;
	near3mLow?: boolean;
}

export interface RevisionsRealityCheck {
	pass?: boolean;
	up30d?: number;
	down30d?: number;
}

export interface EarningsSurpriseCheck {
	surprise: number;
	quarter: string;
}

export interface ScreenerRealityChecks {
	stabilization?: StabilizationRealityCheck;
	revisions?: RevisionsRealityCheck;
	earningsSurprise?: EarningsSurpriseCheck;
}

export interface ScreenerData {
	engine?: string;
	signal?: ScreenerSignal;
	score?: number;
	note?: string;
	inputs?: ScreenerInputs;
	realityChecks?: ScreenerRealityChecks;
	secondaryEngine?: string;
	secondaryScore?: number;
}

export interface AnalystTargets {
	low: number;
	mean: number;
	high: number;
}

export type ForwardEstimates = Record<
	string,
	{
		high: number;
		low: number;
		average: number;
	}
>;

export interface CagrModel {
	ttmEPS?: number;
	epsGrowth?: string;
	epsGrowthSource?: 'auto' | 'manual';
	dividendYield?: string;
	scenarios?: Partial<Record<ScenarioKey, string>>;
	basis?: string;
}

export interface StockMetrics {
	roe?: string;
	fcfMargin?: string;
	fcfYield?: string;
	roic?: string | null;
	netDebtEbitda?: string;
	ruleOf40?: string;
	grossMargin?: string;
	operatingMargin?: string;
	ebitdaMargin?: string;
	beta?: string;
	revenueGrowth?: string;
	interestCoverage?: string;
}

export interface StockValuation {
	trailingPE?: number;
	forwardPE?: number;
	pegRatio?: number | null;
	evEbitda?: number | null;
	evFcf?: number;
	priceToFRE?: number;
}

export interface DeploymentInfo {
	status: DeploymentStatus;
	reason: string;
}

export interface IntrinsicValue {
	dcf: number;
	date: string;
	discount: number | null;
}

export interface QuantitativeConviction {
	earningsScore: number;
	flowScore: number;
	revisionsScore: number;
	totalScore: number;
	raw: {
		avgSurprisePct: number;
		netInsiderShares: number;
		instFlowTrend: string;
		upRevisions: number;
		downRevisions: number;
		totalAnalysts: number;
	};
}

export interface StockConsensus {
	tipranks?: string;
	yahoo?: string;
	stockanalysis?: string;
}

export interface FindingStock {
	ticker: string;
	name?: string;
	description?: string;
	group?: string;
	currentPrice?: string;
	targetPrice?: string;
	lastUpdated?: string;
	expectedCAGR?: string;
	expectedVolatility?: string;
	bullCase?: string;
	bearCase?: string;
	analystTargets?: AnalystTargets;
	forwardEstimates?: ForwardEstimates;
	cagrModel?: CagrModel;
	screener?: ScreenerData;
	intrinsicValue?: IntrinsicValue;
	metrics?: StockMetrics;
	valuation?: StockValuation;
	confidence?: string;
	confidenceReason?: string;
	consensus?: StockConsensus;
	qcs?: QuantitativeConviction;
	sharpeRatio?: number;
	marketCap?: string;
	upside?: number | null;
	baseCagr?: number | null;
	bearCagr?: number | null;
	bullCagr?: number | null;
	sensitivityCagr?: number | null;
	deployment?: DeploymentInfo;
	deploymentRank?: number | null;
	pickLabel?: string;
}

export interface DashboardCounts {
	total: number;
	deploy: number;
	wait: number;
	reject: number;
	fail: number;
	overpriced: number;
	noData: number;
}

export interface DashboardHurdles {
	etfCagr: number;
	bearFloor: number;
}

export interface DashboardData {
	worldVolSignal: WorldVolSignal;
	topPicks: FindingStock[];
	deployNow: FindingStock[];
	cheapWait: FindingStock[];
	watchlist: FindingStock[];
	lastUpdated: string;
	hurdles: DashboardHurdles;
	counts: DashboardCounts;
}
