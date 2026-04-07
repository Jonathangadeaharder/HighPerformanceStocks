import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { STOCK_RECORDS_DIR } from '../src/lib/server/infrastructure/paths.js';

// Repo-relative path for `git show HEAD:<path>` — must be relative to repo root.
const GIT_DIR = relative(process.cwd(), STOCK_RECORDS_DIR).replaceAll('\\', '/');

const files = readdirSync(STOCK_RECORDS_DIR).filter(f => f.endsWith('.json'));

let deployToReject = [];
let rejectToDeploy = [];
let upgrades = [];
let downgrades = [];

console.log('--- Phase 1 & 2 Alpha Decay Analysis ---');

for (const f of files) {
  try {
    const freshRaw = readFileSync(join(STOCK_RECORDS_DIR, f), 'utf-8');
    const freshObj = JSON.parse(freshRaw);

    // Get original from git using the constant — avoids desync with disk reads
    const oldRaw = execFileSync('git', ['show', `HEAD:${GIT_DIR}/${f}`], { encoding: 'utf-8' });
    const oldObj = JSON.parse(oldRaw);

    const freshScreener = freshObj.screener || {};
    const oldScreener = oldObj.screener || {};

    const freshSig = freshScreener.signal;
    const oldSig = oldScreener.signal;
    const freshScore = freshScreener.score;
    const oldScore = oldScreener.score;

    if (freshSig !== oldSig) {
      if (oldSig === 'DEPLOY' && freshSig === 'REJECT') {
        deployToReject.push(`${f.replace('.json','')} (Score: ${oldScore} -> ${freshScore || 'null'} | Notes: ${freshScreener.note})`);
      } else if (oldSig === 'REJECT' && freshSig === 'DEPLOY') {
        rejectToDeploy.push(`${f.replace('.json','')} (Score: ${oldScore} -> ${freshScore} | ${freshScreener.engine})`);
      }
    } else if (freshScore !== oldScore && freshSig === 'DEPLOY') {
        const diff = (freshScore || 0) - (oldScore || 0);
        if (Math.abs(diff) > 0.1) {
            if (diff > 0) upgrades.push(`${f.replace('.json','')} (+${diff.toFixed(2)})`);
            else downgrades.push(`${f.replace('.json','')} (${diff.toFixed(2)})`);
        }
    }
  } catch (e) {
    // some files might not be in git yet
  }
}

console.log(`\n🔴 DEPLOY -> REJECT (${deployToReject.length}):`);
deployToReject.forEach(x => console.log(`  - ${x}`));

console.log(`\n🟢 REJECT -> DEPLOY (${rejectToDeploy.length}):`);
rejectToDeploy.forEach(x => console.log(`  - ${x}`));

console.log(`\n📉 Major Score Downgrades (while still DEPLOY) (${downgrades.length}):`);
downgrades.forEach(x => console.log(`  - ${x}`));

console.log(`\n📈 Major Score Upgrades (${upgrades.length}):`);
upgrades.forEach(x => console.log(`  - ${x}`));

