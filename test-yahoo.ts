import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();
async function test() {
	const end = new Date();
	const start = new Date();
	start.setFullYear(start.getFullYear() - 1);
	const data = await yf.chart('APP', { period1: start, period2: end, interval: '1d' });
	const history = data.quotes;
	console.log('length:', history.length);
	if (history.length > 0) {
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
		const entry6m = history.find((point) => new Date(point.date) >= sixMonthsAgo);
		console.log('6m:', entry6m);
	}
}
test();
