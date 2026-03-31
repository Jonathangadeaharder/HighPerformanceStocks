import { describe, expect, it } from 'vitest';
import {
	hasLikelyValueFloor,
	deploymentForPass,
	deploymentForWait,
	deploymentForFail,
	assignDeployment,
	VALUE_FLOOR_BEAR_RETURN,
	VALUE_FLOOR_BASE_RETURN,
	VALUE_FLOOR_UPSIDE,
	VALUE_FLOOR_MAX_SCORE,
	ETF_HURDLE_RETURN,
	BEAR_FLOOR_RETURN
} from '../src/lib/domain/ranking/rules';
import type { FindingStock } from '../src/lib/types/dashboard';

describe('hasLikelyValueFloor', () => {
	const createMockStock = (overrides: Partial<FindingStock> = {}): FindingStock => {
		const base: FindingStock = {
			ticker: 'TEST',
			bearCagr: 10,
			baseCagr: 30,
			upside: 30,
			screener: {
				score: 0.5,
				realityChecks: {
					stabilization: { near3mLow: true },
					revisions: { pass: true, up30d: 2, down30d: 0 }
				}
			}
		};

		return { ...base, ...overrides };
	};

	it('returns true for a stock meeting all criteria (happy path)', () => {
		const stock = createMockStock();
		expect(hasLikelyValueFloor(stock)).toBe(true);
	});

	it('returns false if stabilization near3mLow is missing or false', () => {
		expect(
			hasLikelyValueFloor(
				createMockStock({
					screener: {
						realityChecks: {
							stabilization: { near3mLow: false },
							revisions: { pass: true, up30d: 2, down30d: 0 }
						}
					}
				})
			)
		).toBe(false);

		expect(
			hasLikelyValueFloor(
				createMockStock({
					screener: {
						realityChecks: {
							revisions: { pass: true, up30d: 2, down30d: 0 }
						}
					}
				})
			)
		).toBe(false);
	});

	it('returns false if revisions did not pass', () => {
		expect(
			hasLikelyValueFloor(
				createMockStock({
					screener: {
						realityChecks: {
							stabilization: { near3mLow: true },
							revisions: { pass: false, up30d: 2, down30d: 0 }
						}
					}
				})
			)
		).toBe(false);
	});

	it('returns false if up revisions are not greater than down revisions', () => {
		expect(
			hasLikelyValueFloor(
				createMockStock({
					screener: {
						realityChecks: {
							stabilization: { near3mLow: true },
							revisions: { pass: true, up30d: 1, down30d: 1 }
						}
					}
				})
			)
		).toBe(false);

		expect(
			hasLikelyValueFloor(
				createMockStock({
					screener: {
						realityChecks: {
							stabilization: { near3mLow: true },
							revisions: { pass: true, up30d: 0, down30d: 1 }
						}
					}
				})
			)
		).toBe(false);
	});

	it('returns false if screener score is too high', () => {
		expect(
			hasLikelyValueFloor(
				createMockStock({
					screener: {
						score: VALUE_FLOOR_MAX_SCORE + 0.1,
						realityChecks: {
							stabilization: { near3mLow: true },
							revisions: { pass: true, up30d: 2, down30d: 0 }
						}
					}
				})
			)
		).toBe(false);
	});

	it('returns false if upside is too low', () => {
		expect(hasLikelyValueFloor(createMockStock({ upside: VALUE_FLOOR_UPSIDE - 1 }))).toBe(false);
	});

	it('returns false if bear CAGR is too low', () => {
		expect(hasLikelyValueFloor(createMockStock({ bearCagr: VALUE_FLOOR_BEAR_RETURN - 1 }))).toBe(
			false
		);
	});

	it('returns false if base CAGR is too low', () => {
		expect(hasLikelyValueFloor(createMockStock({ baseCagr: VALUE_FLOOR_BASE_RETURN - 1 }))).toBe(
			false
		);
	});

	it('handles missing screener or reality checks gracefully', () => {
		expect(hasLikelyValueFloor({ ticker: 'EMPTY' } as FindingStock)).toBe(false);
		expect(hasLikelyValueFloor({ ticker: 'NO_SCREENER', screener: {} } as FindingStock)).toBe(
			false
		);
	});
});

describe('deploymentForPass', () => {
	const createMockStock = (overrides: Partial<FindingStock> = {}): FindingStock => {
		const base: FindingStock = {
			ticker: 'TEST',
			bearCagr: 5,
			baseCagr: 20,
			screener: {
				realityChecks: {
					stabilization: { pass: true }
				}
			}
		};
		return { ...base, ...overrides };
	};

	it('returns DEPLOY when all criteria pass', () => {
		const stock = createMockStock();
		const result = deploymentForPass(stock);
		expect(result.status).toBe('DEPLOY');
	});

	it('returns WAIT when stabilization fails', () => {
		const stock = createMockStock({
			screener: { realityChecks: { stabilization: { pass: false } } }
		});
		const result = deploymentForPass(stock);
		expect(result.status).toBe('WAIT');
		expect(result.reason).toContain('Falling knife');
	});

	it('returns FAIL when base hurdle is missed', () => {
		const stock = createMockStock({ baseCagr: ETF_HURDLE_RETURN - 1 });
		const result = deploymentForPass(stock);
		expect(result.status).toBe('FAIL');
		expect(result.reason).toContain('misses hurdle');
	});

	it('returns FAIL when bear floor is missed', () => {
		const stock = createMockStock({ bearCagr: BEAR_FLOOR_RETURN - 1 });
		const result = deploymentForPass(stock);
		expect(result.status).toBe('FAIL');
		expect(result.reason).toContain('misses hurdle');
	});
});

describe('deploymentForWait', () => {
	it('returns DEPLOY if value floor is found', () => {
		// Mock a stock that meets value floor criteria
		const stock: FindingStock = {
			ticker: 'TEST',
			bearCagr: 10,
			baseCagr: 30,
			upside: 30,
			screener: {
				score: 0.5,
				realityChecks: {
					stabilization: { near3mLow: true },
					revisions: { pass: true, up30d: 2, down30d: 0 }
				}
			}
		};
		const result = deploymentForWait(stock);
		expect(result.status).toBe('DEPLOY');
		expect(result.reason).toContain('Likely value floor');
	});

	it('returns WAIT if no value floor is found', () => {
		const stock: FindingStock = {
			ticker: 'TEST',
			screener: { note: 'Still stabilizing' }
		};
		const result = deploymentForWait(stock);
		expect(result.status).toBe('WAIT');
		expect(result.reason).toBe('Still stabilizing');
	});
});

describe('deploymentForFail', () => {
	it('returns OVERPRICED for high score and high growth', () => {
		const stock: FindingStock = {
			ticker: 'TEST',
			baseCagr: 25,
			screener: { score: 1.6 }
		};
		const result = deploymentForFail(stock);
		expect(result.status).toBe('OVERPRICED');
	});

	it('returns FAIL for moderately high score', () => {
		const stock: FindingStock = {
			ticker: 'TEST',
			screener: { score: 1.2 }
		};
		const result = deploymentForFail(stock);
		expect(result.status).toBe('FAIL');
		expect(result.reason).toContain('above the 1.0 buy threshold');
	});

	it('returns FAIL if base return misses hurdle', () => {
		const stock: FindingStock = {
			ticker: 'TEST',
			baseCagr: 10,
			screener: { score: 0.5 }
		};
		const result = deploymentForFail(stock);
		expect(result.status).toBe('FAIL');
		expect(result.reason).toContain('misses the 15% hurdle');
	});
});

describe('assignDeployment', () => {
	it('assigns deployment based on signal', () => {
		const stock: FindingStock = {
			ticker: 'TEST',
			screener: { signal: 'PASS', realityChecks: { stabilization: { pass: true } }, baseCagr: 20, bearCagr: 5 }
		};
		assignDeployment(stock);
		expect(stock.deployment?.status).toBe('DEPLOY');

		stock.screener!.signal = 'REJECTED';
		stock.screener!.note = 'Bad news';
		assignDeployment(stock);
		expect(stock.deployment?.status).toBe('REJECT');
		expect(stock.deployment?.reason).toBe('Bad news');

		stock.screener!.signal = 'FAIL';
		stock.baseCagr = 10;
		assignDeployment(stock);
		expect(stock.deployment?.status).toBe('FAIL');
	});
});
