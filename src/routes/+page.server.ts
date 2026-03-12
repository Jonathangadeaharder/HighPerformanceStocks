import type { PageServerLoad } from './$types';
import { buildDashboardData } from '$lib/domain/deployment';
import { loadFindingStocks } from '$lib/server/findings';
import { fetchWorldVolSignal } from '$lib/server/world-vol';

export const load: PageServerLoad = async () => {
	const [stocks, worldVolSignal] = await Promise.all([
		Promise.resolve(loadFindingStocks()),
		fetchWorldVolSignal()
	]);

	return buildDashboardData(stocks, worldVolSignal);
};
