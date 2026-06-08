import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseCsv, readExport } from '../src/read.js';

const HEADER = '"Event Type","Provider","Account","Request ID","Request URL","POST Data","Timestamp","Notes"';
const beacon = (qs) => `https://h.sc.omtrdc.net/b/ss/rs/1/s1?${qs}`;

test('parseCsv handles quoted fields, embedded commas, and escaped quotes', () => {
  const rows = parseCsv('"a","b,c","d""e"\n"f","g","h"');
  assert.deepEqual(rows, [['a', 'b,c', 'd"e'], ['f', 'g', 'h']]);
});

test('parseCsv handles CRLF line endings and a trailing newline', () => {
  const rows = parseCsv('"a","b"\r\n"c","d"\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['c', 'd']]);
});

test('readExport skips the metadata line and maps by the header row', () => {
  const csv = [
    '"Omnibug v2.1.0","Exported Mon Jun 08 2026"',
    HEADER,
    `"Page View","Adobe Analytics","rs","100","${beacon('events=scAdd&cc=USD&products=%3BW%3B1%3B9.99')}","","ts1"`
  ].join('\n');
  const { events, skipped } = readExport(csv);
  assert.equal(events.length, 1);
  assert.equal(skipped, 0);
  assert.equal(events[0].requestId, '100');
  assert.equal(events[0].params.events, 'scAdd');
  assert.equal(events[0].params.cc, 'USD');
  assert.equal(events[0].params.products, ';W;1;9.99');
  assert.equal(events[0].index, 0);
});

test('readExport skips and counts non-Adobe rows (Navigation, other providers)', () => {
  const csv = [
    '"Omnibug v2.1.0","Exported ..."',
    HEADER,
    '"Navigation","","","","file:///x.html","","ts"',
    `"Page View","Adobe Analytics","rs","100","${beacon('events=scAdd&cc=USD&products=%3BW')}","","ts"`,
    '"Page View","Other Provider","acct","101","https://other/track?x=1","","ts"',
    `"Page View","Adobe Analytics","rs","102","${beacon('events=purchase&cc=USD&products=%3BW&v1=ORD-1')}","","ts","a note"`
  ].join('\n');
  const { events, skipped } = readExport(csv);
  assert.equal(events.length, 2); // two Adobe rows
  assert.equal(skipped, 2); // Navigation + Other Provider
  assert.deepEqual(events.map((e) => e.index), [0, 1]);
  assert.equal(events[1].params.v1, 'ORD-1');
});

test('readExport tolerates rows shorter than the header (missing trailing Notes)', () => {
  const csv = [
    HEADER,
    // 7 fields — no trailing Notes column
    `"Page View","Adobe Analytics","rs","100","${beacon('events=scAdd&cc=USD&products=%3BW')}","","ts"`
  ].join('\n');
  const { events } = readExport(csv);
  assert.equal(events.length, 1);
  assert.equal(events[0].params.events, 'scAdd');
});

test('readExport merges POST data when present', () => {
  const csv = [
    HEADER,
    `"Page View","Adobe Analytics","rs","100","${beacon('events=scAdd')}","cc=EUR&v1=ORD-9","ts"`
  ].join('\n');
  const { events } = readExport(csv);
  assert.equal(events[0].params.cc, 'EUR');
  assert.equal(events[0].params.v1, 'ORD-9');
});

test('readExport throws when there is no Omnibug header row', () => {
  assert.throws(() => readExport('"just","some","csv"\n"1","2","3"'), /Not an Omnibug CSV export/);
});

test('readExport reads the synthetic beacon-emitter session fixture', async () => {
  const path = fileURLToPath(new URL('../examples/captures/beacon-emitter-session.csv', import.meta.url));
  const { events, skipped } = readExport(await readFile(path, 'utf8'));
  assert.equal(events.length, 6); // six Adobe beacons
  assert.equal(skipped, 1); // one Navigation row
  assert.equal(events[0].params.pageName, 'home');
  assert.deepEqual(events[0].reportSuites, ['fictionalstore-prod']);
  // the two later add-to-carts deliberately omit cc
  assert.equal('cc' in events[4].params, false);
  assert.equal('cc' in events[5].params, false);
});
