import { resolve } from 'node:path';

/**
 * Shared project paths.
 */
export const PROJECT_ROOT = resolve(process.cwd());
export const DATA_DIR = resolve(PROJECT_ROOT, 'data');
export const STOCK_RECORDS_DIR = resolve(DATA_DIR, 'stock-records');
