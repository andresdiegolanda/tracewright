import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReport } from '../src/report.js';

const cleanReport = {
  ruleSet: 'rs',
  summary: { beacons: 2, ok: 2, unclassified: 0, violations: 0 },
  classified: [
    { beacon: 0, requestId: 'r0', type: 'addToCart' },
    { beacon: 1, requestId: 'r1', type: 'purchase' }
  ],
  warnings: [],
  violations: []
};

test('a clean report announces all beacons OK', () => {
  const text = formatReport(cleanReport);
  assert.match(text, /all 2 beacons OK/);
  assert.match(text, /Summary: 0 violations\. 2 OK, 0 unclassified\./);
});

test('schema violations group under their beacon with a got-suffix', () => {
  const report = {
    ruleSet: 'rs',
    summary: { beacons: 2, ok: 1, unclassified: 0, violations: 2 },
    classified: [
      { beacon: 0, requestId: 'r0', type: 'addToCart' },
      { beacon: 1, requestId: 'r1', type: 'purchase' }
    ],
    warnings: [],
    violations: [
      { code: 'schema', beacon: 1, requestId: 'r1', eventType: 'purchase', field: 'cc', message: 'required field missing: "cc"', expected: 'present', actual: null },
      { code: 'schema', beacon: 1, requestId: 'r1', eventType: 'purchase', field: 'products', message: 'field "products" must not be empty', expected: 'minLength 1', actual: '' }
    ]
  };
  const text = formatReport(report);
  assert.match(text, /1 of 2 beacons have violations/);
  assert.match(text, /✗ Beacon #1 {2}\(request r1\) {2}classified as "purchase"/);
  assert.match(text, /required field missing: "cc"/);
  assert.match(text, /must not be empty \(got: ""\)/); // value violation shows actual
  assert.ok(!/required field missing: "cc" \(got/.test(text)); // required (actual null) has no got-suffix
});

test('sequence violations group under Sequence with a precedes locator', () => {
  const report = {
    ruleSet: 'rs',
    summary: { beacons: 2, ok: 1, unclassified: 0, violations: 2 },
    classified: [{ beacon: 0, requestId: 'r0', type: 'purchase' }],
    warnings: [],
    violations: [
      { code: 'precedes', beacon: 0, requestId: 'r0', eventType: 'purchase', field: null, message: 'A purchase must be preceded by an add-to-cart.', expected: 'x', actual: 'y' },
      { code: 'count', beacon: null, requestId: null, eventType: 'purchase', field: null, message: '"purchase" must occur at most 1, got 2', expected: 'at most 1', actual: 2 }
    ]
  };
  const text = formatReport(report);
  assert.match(text, /✗ Sequence/);
  assert.match(text, /precedes {2}A purchase must be preceded by an add-to-cart\. {2}\[#0\]/);
  assert.match(text, /count {5}"purchase" must occur at most 1, got 2/);
});

test('unclassified warnings and skipped rows appear as non-failing notices', () => {
  const report = {
    ruleSet: 'rs',
    summary: { beacons: 1, ok: 0, unclassified: 1, violations: 0 },
    classified: [{ beacon: 0, requestId: 'r0', type: null }],
    warnings: [{ code: 'unclassified', beacon: 0, requestId: 'r0', message: 'no matching event type' }],
    violations: []
  };
  const text = formatReport(report, { skippedNonAdobe: 2 });
  assert.match(text, /⚠ Beacon #0 unclassified \(no matching event type\) — request r0/);
  assert.match(text, /ℹ 2 non-Adobe rows skipped/);
  assert.match(text, /0 OK, 1 unclassified, 2 skipped\./);
});
