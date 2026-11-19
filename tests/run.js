// Çalıştırma: node tests/run.js
const Core = require('../core.js');
const res = require('./cases.js')(Core);
let Seq = null; try { Seq = require('../engine.js'); } catch (e) {}
if (Seq && Seq.selfTest) res.push(...Seq.selfTest());
let bad = 0;
for (const r of res) { if (!r.ok) { bad++; console.log('BAŞARISIZ  ' + r.name + '  →  ' + r.detail); } }
console.log(`${res.length - bad} / ${res.length} test geçti` + (res.perfMs !== undefined ? `  (1 MB çözümleme: ${res.perfMs} ms, ${res.perfParas} paragraf)` : ''));
process.exit(bad ? 1 : 0);
