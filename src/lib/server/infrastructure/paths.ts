import path from 'node:path';

/**
 * Shared project paths.
 */
export const PROJECT_ROOT = path.resolve(process.cwd());
export const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
export const STOCK_RECORDS_DIR = path.resolve(DATA_DIR, 'stock-records');
