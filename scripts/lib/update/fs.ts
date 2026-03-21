import { writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Atomically write JSON to a file by writing to a temp file first and renaming.
 */
export function atomicWriteJson(path: string, data: object): void {
	const tempPath = join(
		tmpdir(),
		`stock-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp.json`
	);
	writeFileSync(tempPath, JSON.stringify(data, null, '\t') + '\n');
	renameSync(tempPath, path);
}
