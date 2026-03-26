import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { STOCK_RECORDS_DIR } from './infrastructure/paths';
import type { FindingStock } from '$lib/types/dashboard';

const FINDINGS_DIR = STOCK_RECORDS_DIR;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isFindingStock(value: unknown): value is FindingStock {
	return (
		isRecord(value) &&
		typeof value.ticker === 'string' &&
		(value.cagrModel === undefined || isRecord(value.cagrModel)) &&
		(value.screener === undefined || isRecord(value.screener)) &&
		(value.valuation === undefined || isRecord(value.valuation))
	);
}

function parseFindingStock(contents: string): FindingStock | null {
	const parsed: unknown = JSON.parse(contents);
	return isFindingStock(parsed) ? parsed : null;
}

export function loadFindingStocks(dataDir = FINDINGS_DIR): FindingStock[] {
	const fileNames = readdirSync(dataDir).filter((fileName) => fileName.endsWith('.json'));

	return fileNames.flatMap((fileName) => {
		try {
			const parsedStock = parseFindingStock(readFileSync(resolve(dataDir, fileName), 'utf8'));
			return parsedStock ? [parsedStock] : [];
		} catch (error) {
			console.error(`Failed to load stock from ${fileName}:`, error);
			return [];
		}
	});
}
