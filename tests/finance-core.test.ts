import { describe, expect, it } from 'vitest';
import {
	calcForwardReturn,
	calcForwardScenarios,
	parseDisplayPrice,
	parsePercent
} from '../lib/finance-core.js';

describe('parsePercent', () => {
	it('extracts number from percentage string', () => {
		expect(parsePercent('25%')).toBe(25);
		expect(parsePercent('-10.5%')).toBe(-10.5);
	});

	it('extracts number from plain number', () => {
		expect(parsePercent('42')).toBe(42);
		expect(parsePercent(15.5)).toBe(15.5);
	});

	it('returns null for invalid input', () => {
		expect(parsePercent(null)).toBeNull();
		expect(parsePercent(undefined)).toBeNull();
		expect(parsePercent('abc')).toBeNull();
	});

	it('handles edge cases', () => {
		expect(parsePercent('0')).toBe(0);
		expect(parsePercent('')).toBeNull();
	});
});

describe('parseDisplayPrice', () => {
	it('parses plain price string', () => {
		expect(parseDisplayPrice('100.50')).toBe(100.5);
		expect(parseDisplayPrice('$45.25')).toBe(45.25);
	});

	it('converts pence to pounds', () => {
		expect(parseDisplayPrice('150p')).toBe(1.5);
		expect(parseDisplayPrice('250.5p')).toBe(2.505);
	});

	it('returns null for invalid input', () => {
		expect(parseDisplayPrice(null)).toBeNull();
		expect(parseDisplayPrice(undefined)).toBeNull();
		expect(parseDisplayPrice('')).toBeNull();
	});

	it('returns null for malformed decimals', () => {
		expect(parseDisplayPrice('1.2.3')).toBeNull();
	});
});

describe('calcForwardReturn', () => {
	it('calculates basic forward return', () => {
		const result = calcForwardReturn({ currentPrice: 100, targetPrice: 120 });
		expect(result).toBe(20);
	});

	it('ignores dividend yield', () => {
		const result = calcForwardReturn({ currentPrice: 100, targetPrice: 110, dividendYieldPct: 3 });
		expect(result).toBe(10);
	});

	it('handles negative price return', () => {
		const result = calcForwardReturn({ currentPrice: 100, targetPrice: 80 });
		expect(result).toBe(-20);
	});

	it('throws for invalid prices', () => {
		expect(() => calcForwardReturn({ currentPrice: 0, targetPrice: 100 })).toThrow();
		expect(() => calcForwardReturn({ currentPrice: 100, targetPrice: 0 })).toThrow();
	});
});

describe('calcForwardScenarios', () => {
	it('calculates bear/base/bull scenarios', () => {
		const result = calcForwardScenarios({
			currentPrice: 100,
			targetLow: 80,
			targetMean: 110,
			targetHigh: 140,
			dividendYieldPct: 2
		});

		expect(result.bear).toBe(-20);
		expect(result.base).toBe(10);
		expect(result.bull).toBe(40);
	});

	it('handles zero dividend yield', () => {
		const result = calcForwardScenarios({
			currentPrice: 50,
			targetLow: 40,
			targetMean: 55,
			targetHigh: 70
		});

		expect(result.bear).toBe(-20);
		expect(result.base).toBe(10);
		expect(result.bull).toBe(40);
	});

	it('throws for invalid current price', () => {
		expect(() =>
			calcForwardScenarios({
				currentPrice: 0,
				targetLow: 80,
				targetMean: 100,
				targetHigh: 120
			})
		).toThrow();
	});
});
