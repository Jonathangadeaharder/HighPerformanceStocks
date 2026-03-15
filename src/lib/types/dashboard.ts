export type ScenarioKey = 'bear' | 'base' | 'bull';
export type DeploymentStatus = 'DEPLOY' | 'WAIT' | 'REJECT' | 'FAIL' | 'OVERPRICED' | 'NO_DATA';
export type ScreenerSignal = 'PASS' | 'WAIT' | 'REJECTED' | 'FAIL' | 'NO_DATA';
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
	method: 'composite' | 'urth_fallback';
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

export interface ScreenerRealityChecks {
	stabilization?: StabilizationRealityCheck;
	revisions?: RevisionsRealityCheck;
}

export interface ScreenerData {
	engine?: string;
	signal?: ScreenerSignal;
	score?: number;
	note?: string;
	inputs?: ScreenerInputs;
	realityChecks?: ScreenerRealityChecks;
}

export interface CagrModel {
	horizon?: number;
	epsGrowth?: string;
	dividendYield?: string;
	exitPE?: Partial<Record<ScenarioKey, number>>;
	scenarios?: Partial<Record<ScenarioKey, string>>;
	basis?: string;
}

export interface DeploymentInfo {
	status: DeploymentStatus;
	reason: string;
}

export interface FindingStock {
	ticker: string;
	name?: string;
	group?: string;
	currentPrice?: string;
	targetPrice?: string;
	lastUpdated?: string;
	expectedCAGR?: string;
	expectedVolatility?: string;
	bullCase?: string;
	bearCase?: string;
	cagrModel?: CagrModel;
	screener?: ScreenerData;
	upside?: number | null;
	baseCagr?: number | null;
	bearCagr?: number | null;
	bullCagr?: number | null;
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
