/// <reference types="node" />
// 0.9.9: schedule date/time pickers (web schedules.js datetime-local / time inputs).
import assert from 'node:assert/strict';
import { clockText, inAnHour, localText, parseLocal } from '../src/api/schedules';
let n = 0; const ok = (m: string) => { n++; console.log('  ✓', m); };
const d = new Date(2026, 0, 5, 7, 3);
assert.equal(localText(d), '2026-01-05 07:03'); assert.equal(clockText(d), '07:03');
ok('picker value → web-shaped text');
assert.equal(parseLocal(localText(d)), d.toISOString()); assert.equal(parseLocal('2026-01-05T07:03'), d.toISOString());
ok('text → ISO payload {kind:at, at} like new Date(datetime-local).toISOString()');
const a = new Date(parseLocal(inAnHour())); assert.equal(a.getMinutes(), 0); assert.ok(a.getTime() > Date.now() && a.getTime() <= Date.now() + 3600_000);
ok('default = next hour, :00');
console.log(`batch099: ${n} passed`);
