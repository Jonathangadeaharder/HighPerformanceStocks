import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({
	validation: { logErrors: false },
	suppressNotices: ['yahooSurvey', 'ripHistorical']
});

const YAHOO_TICKER_MAP: Record<string, string> = {
	'BRK.B': 'BRK-B',
	'HEI.A': 'HEI-A',
	'FIH.U.TO': 'FIH-U.TO'
};

export function yahooTicker(ticker: string): string {
	return YAHOO_TICKER_MAP[ticker] ?? ticker;
}

export async function fetchAllQuotes(tickers: string[]): Promise<Record<string, unknown>> {
	const result: Record<string, unknown> = {};
	const chunkSize = 20;

	for (let index = 0; index < tickers.length; index += chunkSize) {
		const chunk = tickers.slice(index, index + chunkSize);
		try {
			const response = await yf.quote(chunk, { return: 'object' });
			Object.assign(result, response);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Chunk quote failed: ${message}`);
		}

		if (index + chunkSize < tickers.length) {
			await new Promise((resolve) => {
				setTimeout(resolve, 1000);
			});
		}
	}

	return result;
}

export async function fetchSummary(ticker: string): Promise<Record<string, unknown>> {
	try {
		return (await yf.quoteSummary(ticker, {
			modules: [
				'summaryDetail',
				'defaultKeyStatistics',
				'financialData',
				'earningsTrend',
				'earningsHistory',
				'institutionOwnership',
				'netSharePurchaseActivity',
				'assetProfile'
			]
		})) as Record<string, unknown>;
	} catch {
		return {};
	}
}

interface HistoricalResult {
	vol: number | null;
	price6mAgo: number | null;
	price1mAgo: number | null;
	low3m: number | null;
}

export async function fetchHistoricalData(ticker: string): Promise<HistoricalResult> {
	try {
		const end = new Date();
		const start = new Date();
		start.setFullYear(start.getFullYear() - 1);

		const chartData = await yf.chart(ticker, {
			period1: start,
			period2: end,
			interval: '1d'
		});
		const history = chartData.quotes;

		if (!history || history.length < 60) {
			return { vol: null, price6mAgo: null, price1mAgo: null, low3m: null };
		}

		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
		const oneMonthAgo = new Date();
		oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

		const entry6m = history.find((point) => new Date(point.date) >= sixMonthsAgo);
		const entry1m = history.find((point) => new Date(point.date) >= oneMonthAgo);
		const trailing3m = history.slice(-63);
		const low3m =
			trailing3m.length > 0
				? Math.min(
						...trailing3m
							.map((point) => point.low ?? point.close)
							.filter((value): value is number => value != null && value > 0)
					)
				: null;

		const logReturns: number[] = [];
		for (let index = 1; index < history.length; index += 1) {
			const prevPoint = history[index - 1];
			const currPoint = history[index];
			if (prevPoint?.close == null || prevPoint.close <= 0) continue;
			if (currPoint?.close == null || currPoint.close <= 0) continue;
			logReturns.push(Math.log(currPoint.close / prevPoint.close));
		}

		if (logReturns.length < 50) {
			return {
				vol: null,
				price6mAgo: entry6m?.close ?? null,
				price1mAgo: entry1m?.close ?? null,
				low3m: low3m ?? null
			};
		}

		const mean = logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length;
		const variance =
			logReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (logReturns.length - 1);

		return {
			vol: Math.round(Math.sqrt(variance) * Math.sqrt(252) * 100),
			price6mAgo: entry6m?.close ?? null,
			price1mAgo: entry1m?.close ?? null,
			low3m
		};
	} catch {
		return { vol: null, price6mAgo: null, price1mAgo: null, low3m: null };
	}
}
