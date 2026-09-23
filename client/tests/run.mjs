/* يشغّل كل مجموعات الاختبار ويخرج بحالة فشل إن سقطت واحدة */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(here).filter(f => f.endsWith('.test.mjs')).sort();

let failed = 0;

for (const suite of suites) {
    const run = spawnSync(process.execPath, [join(here, suite)], { encoding: 'utf8' });
    const tail = (run.stdout || '').trim().split('\n').pop() || '';

    if (run.status === 0) {
        console.log(`✓ ${suite.padEnd(26)} ${tail}`);
    } else {
        failed++;
        console.log(`✗ ${suite}\n${run.stdout}${run.stderr}`);
    }
}

console.log(`\n${suites.length - failed}/${suites.length} مجموعة نجحت`);
process.exit(failed ? 1 : 0);
