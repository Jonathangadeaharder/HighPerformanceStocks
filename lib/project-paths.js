import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const STOCK_RECORDS_DIR = resolve(projectRoot, 'data', 'stock-records');
