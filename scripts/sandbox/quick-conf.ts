import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'data', 'stock-records');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
let count = 0;

for (const file of files) {
	const filePath = path.join(dir, file);
	const content = fs.readFileSync(filePath, 'utf-8');
	let data;
	try {
        data = JSON.parse(content);
    } catch (e) { continue; }
	
	if (data.qcs && data.qcs.totalScore != null) {
		const score = data.qcs.totalScore;
		if (score >= 10) data.confidence = 'high';
		else if (score >= 5) data.confidence = 'medium';
		else if (score >= 0) data.confidence = 'low';
		else data.confidence = 'cut';
		
		fs.writeFileSync(filePath, JSON.stringify(data, null, '\t') + '\n', 'utf-8');
		count++;
	}
}
console.log(`Successfully retro-fitted mathematically derived confidence onto ${count} records.`);
