// This file intercepts legacy sandbox scripts that haven't been migrated to `src/lib/domain/screener/engine`
export { computeScreener, detectGrowthBranch } from '../../src/lib/domain/screener/engine.js';
export type {
	ScreenerInputs,
	ScreenerResult,
	RealityChecks
} from '../../src/lib/domain/screener/types.js';
