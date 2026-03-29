import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchWorldVolSignal } from '../src/lib/server/world-vol.js';
import { yahooFinance } from '../src/lib/server/infrastructure/yahoo.js';

vi.mock('../src/lib/server/infrastructure/yahoo.js', () => {
	return {
		yahooFinance: {
			quote: vi.fn(),
			chart: vi.fn()
		}
	};
});

describe('fetchWorldVolSignal', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns composite signal when both feeds are fresh', async () => {
		vi.mocked(yahooFinance.quote).mockResolvedValue({
			regularMarketPrice: 20,
			regularMarketTime: new Date()
		} as any);

		const result = await fetchWorldVolSignal();
		expect(result.available).toBe(true);
		if (result.available) {
			expect(result.source).toBe('70% VIX + 30% VSTOXX');
		}
	});

	it('falls back gracefully when VSTOXX is stale', async () => {
		// Mock VIX as fresh
		vi.mocked(yahooFinance.quote).mockImplementation(async (symbol: any) => {
			if (symbol === '^VIX') {
				return {
					regularMarketPrice: 20,
					regularMarketTime: new Date()
				} as any;
			}
			// Mock VSTOXX as stale (e.g. 2016)
			return {
				regularMarketPrice: 25,
				regularMarketTime: new Date('2016-06-27T00:00:00Z')
			} as any;
		});

		const result = await fetchWorldVolSignal();
		expect(result.available).toBe(true);
		if (result.available) {
			expect(result.source).toBe('100% VIX');
			expect(result.note).toContain('Degraded fallback to 100% VIX');
		}
	});
});
