import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance({ validation: { logErrors: false } });
async function m() {
	const r = await yf.quoteSummary('CSU.TO', { modules: ['financialData', 'defaultKeyStatistics'] });
	console.log(r.financialData?.freeCashflow);
	console.log(r.defaultKeyStatistics?.enterpriseValue);
}
m();
