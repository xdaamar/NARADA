const cp = require('child_process');

const suites = [
  { name: 'Sprint 5', cmd: 'node scripts/test-sprint-5-routing.js' },
  { name: 'Sprint 5.1', cmd: 'node scripts/test-sprint-5-1-validation.js' },
  { name: 'Sprint 6', cmd: 'node scripts/test-sprint-6-radar-discovery.js' },
  { name: 'Sprint 6.1', cmd: 'node scripts/test-sprint-6-1-operational.js' },
  { name: 'Sprint 6.2', cmd: 'node scripts/test-sprint-6-2-gdelt.js' },
  { name: 'Sprint 7', cmd: 'node scripts/test-sprint-7-evidence.js' },
  { name: 'Sprint 7:idb', cmd: 'node scripts/test-sprint-7-indexeddb.js' },
  { name: 'Sprint 7:smoke', cmd: 'node scripts/test-sprint-7-electron-smoke.js' },
  { name: 'Sprint 8', cmd: 'node scripts/test-sprint-8-intelligence.js' },
  { name: 'Sprint 8:idb', cmd: 'node scripts/test-sprint-8-indexeddb.js' },
  { name: 'Sprint 8:smoke', cmd: 'node scripts/test-sprint-8-electron-smoke.js' }
];

let tp = 0, te = 0;
for (const s of suites) {
  try {
    const out = cp.execSync(s.cmd, { encoding: 'utf-8', timeout: 45000 });
    let p = 0, t = 0;
    const m1 = out.match(/(\d+)\s*\/\s*(\d+)\s*PASS/i);
    const m2 = out.match(/TOTAL ASSERTIONS SPRINT 5:\s*(\d+)[\s\S]*?PASS:\s*(\d+)/i);
    const m3 = out.match(/SUMMARY:\s*(\d+)\s*\/\s*(\d+)\s*ASSERTIONS PASSED/i);

    if (m1) {
      p = parseInt(m1[1], 10);
      t = parseInt(m1[2], 10);
    } else if (m2) {
      t = parseInt(m2[1], 10);
      p = parseInt(m2[2], 10);
    } else if (m3) {
      p = parseInt(m3[1], 10);
      t = parseInt(m3[2], 10);
    }

    if (t > 0) {
      console.log(s.name.padEnd(16) + ': ' + p + ' / ' + t + ' PASS');
      tp += p; te += t;
    } else {
      console.log(s.name.padEnd(16) + ': NO_MATCH');
    }
  } catch(e) {
    console.log(s.name.padEnd(16) + ': FAIL - ' + e.message);
  }
}
console.log('-----------------------------------------');
console.log('TOTAL REGRESSION: ' + tp + ' / ' + te + ' PASS');
