// 0.9.12: self-test LONG_TEXT must pass FOLD_HUGE; picker/About/connector parity markers.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { FOLD_HUGE } from '../src/api/fold.ts';
const ft = readFileSync('src/featureTest.tsx', 'utf8');
const m = ft.match(/export const LONG_TEXT = (Array\.from[^\n]+);/);
assert.ok(m);
const LONG_TEXT: string = eval(m[1]);
assert.ok(LONG_TEXT.length > FOLD_HUGE.chars, 'LONG_TEXT ' + LONG_TEXT.length);
const conn = readFileSync('src/screens/ToolPages.tsx', 'utf8');
assert.match(conn, /GITHUB_D/); assert.match(conn, /ConnectorMark/);
assert.match(readFileSync('src/store.tsx', 'utf8'), /prefetchUpdate\(c\)/);
const us = readFileSync('src/screens/UsagePage.tsx', 'utf8');
assert.match(us, /maxWidth: 252/); assert.match(us, /left: 0, right: 0/);
assert.match(readFileSync('src/screens/Schedules.tsx', 'utf8'), /KeyboardAvoidingView/);
console.log('batch0914 ok: 6');
