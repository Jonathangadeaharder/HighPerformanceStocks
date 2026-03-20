import yahooFinance from 'yahoo-finance2';

async function main() {
	const tickers = ['AVGO', 'AAPL', 'MSFT'];

	for (const ticker of tickers) {
		console.log(`\n=== ${ticker} ===`);
		try {
			const quote = await yahooFinance.quote(ticker);
			const summary = await yahooFinance.quoteSummary(ticker, {
				modules: ['defaultKeyStatistics', 'financialData']
			});
			const ks = summary.defaultKeyStatistics || {};
			const fd = summary.financialData || {};

			console.log(`Current Price:       ${quote.regularMarketPrice}`);
			console.log(`Shares Outstanding:  ${ks.sharesOutstanding}`);
			console.log(`Market Cap (Quote):  ${quote.marketCap}`);
			console.log(
				`Calculated Mkt Cap:  ${(quote.regularMarketPrice * ks.sharesOutstanding).toFixed(0)}`
			);

			console.log(`Total Cash:          ${fd.totalCash}`);
			console.log(`Total Debt:          ${fd.totalDebt}`);

			console.log(`Reported EV:         ${ks.enterpriseValue}`);
			// EV = Market Cap + Debt - Cash
			const calcEv = quote.marketCap + (fd.totalDebt || 0) - (fd.totalCash || 0);
			console.log(`Calculated EV:       ${calcEv}`);

			if (ks.enterpriseValue) {
				console.log(`Ratio (Calc/Report): ${(calcEv / ks.enterpriseValue).toFixed(2)}x`);
			}
		} catch (err) {
			console.error(`Error fetching ${ticker}:`, err.message);
		}
	}
}

main().catch(console.error);
