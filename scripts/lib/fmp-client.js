const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const FMP_DELAY_MS = 350;

// International exchanges not covered by FMP
const SKIP_SUFFIXES = ['.IL', '.ST', '.TO', '.AS', '.L', '.HK', '.V'];

function isUsStock(ticker) {
	return !SKIP_SUFFIXES.some((suffix) => ticker.endsWith(suffix));
}

export async function fetchDcf(ticker, apiKey) {
	try {
		const url = `${FMP_BASE_URL}/discounted-cash-flow?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
		const response = await fetch(url);
		if (!response.ok) return null;

		const data = await response.json();
		if (!Array.isArray(data) || data.length === 0) return null;

		const { dcf, date } = data[0];
		if (dcf == null || dcf <= 0) return null;

		return { dcf: +dcf.toFixed(2), date };
	} catch {
		return null;
	}
}

export async function fetchAllDcf(tickers) {
	const apiKey = process.env.FMP_API_KEY;
	if (!apiKey) {
		console.log('  ⚠️  FMP_API_KEY not set, skipping intrinsic value fetch');
		return {};
	}

	const usTickers = tickers.filter((ticker) => isUsStock(ticker));
	console.log(`\n📊 Fetching FMP DCF intrinsic values for ${usTickers.length} US stocks...`);

	const results = {};
	for (const ticker of usTickers) {
		const dcfData = await fetchDcf(ticker, apiKey);
		if (dcfData) {
			results[ticker] = dcfData;
		}
		await new Promise((resolve) => setTimeout(resolve, FMP_DELAY_MS));
	}

	const found = Object.keys(results).length;
	console.log(`  ✅ Got DCF data for ${found}/${usTickers.length} US stocks`);
	return results;
}
