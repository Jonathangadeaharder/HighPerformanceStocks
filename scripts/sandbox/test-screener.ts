import { readFileSync } from 'fs';
import { resolve } from 'path';
import { computeScreener } from './scripts/lib/screener';
const stock = JSON.parse(readFileSync(resolve('data/stock-records/CSU.TO.json'), 'utf8'));
const price = parseFloat(stock.currentPrice.replace(/[^0-9.]/g, ''));
console.log('price:', price);
console.log(computeScreener(stock, null, price, price, undefined));
