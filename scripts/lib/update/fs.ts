import { writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Atomically write JSON to a file by writing to a temp file first and renaming.
 */
export function atomicWriteJson(path: string, data: object): void {
	const tempPath = join(
		dirname(path),
		`stock-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp.json`
	);
	try {
		writeFileSync(tempPath, JSON.stringify(data, null, '\t') + '\n');
		renameSync(tempPath, path);
	} catch (error) {
		try {
			// Clean up temp file on failure
			unlinkSync(tempPath);
			 
		} catch {}
		throw error;
	}
}
