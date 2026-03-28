import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'data', 'stock-records');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let fixedCount = 0;

for (const file of files) {
	const filePath = path.join(dir, file);
	let data;
	try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) { continue; }
	
	const sig = data.screener?.signal;
    const stabPass = data.screener?.realityChecks?.stabilization?.pass;
    const note = data.screener?.note || "";

	if (sig === 'DEPLOY' && stabPass === false && note.includes('DEPLOY override:')) {
        console.log(`Found falsely deployed falling-knife stock: ${file}`);
        
        // Let's degrade it to WAIT
        data.screener.signal = 'WAIT';
        
        // Prepend the justification onto the note
        data.screener.note = note.replace('DEPLOY override:', 'WAIT override (stalled by stabilization):');
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, '\t') + '\n', 'utf-8');
        fixedCount++;
	}
}

console.log(`Successfully fixed ${fixedCount} falsely-deployed override stocks.`);
