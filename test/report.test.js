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

test('a clean report announces all beacons passed and renders a summary table', () => {
  const text = formatReport(cleanReport);
  assert.match(text, /^# tracewright report$/m);
  assert.match(text, /\*\*Result:\*\* ✅ All 2 beacons passed\./);
  assert.match(text, /\| Beacons checked \| 2 \|/);
  assert.match(text, /\| Violations \| 0 \|/);
});

test('schema violations group under a beacon heading with a got-suffix', () => {
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
  assert.match(text, /\*\*Result:\*\* ❌ 2 violations found\./);
  assert.match(text, /## Beacon #1 — `purchase`/);
  assert.match(text, /> request `r1`/);
  assert.match(text, /- \*\*schema\*\* — required field missing: "cc"/);
  assert.match(text, /- \*\*schema\*\* — field "products" must not be empty \(got: `""`\)/);
  assert.ok(!/missing: "cc" \(got/.test(text)); // required (actual null) has no got-suffix
});

test('sequence violations group under Sequence rules with a precedes locator', () => {
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
  assert.match(text, /## Sequence rules/);
  assert.match(text, /- \*\*precedes\*\* — A purchase must be preceded by an add-to-cart\. \(beacon #0\)/);
  assert.match(text, /- \*\*count\*\* — "purchase" must occur at most 1, got 2/);
  assert.match(text, /\| Violations \| 2 \(1 precedes, 1 count\) \|/);
});

test('unclassified warnings and skipped rows appear as notices', () => {
  const report = {
    ruleSet: 'rs',
    summary: { beacons: 1, ok: 0, unclassified: 1, violations: 0 },
    classified: [{ beacon: 0, requestId: 'r0', type: null }],
    warnings: [{ code: 'unclassified', beacon: 0, requestId: 'r0', message: 'no matching event type' }],
    violations: []
  };
  const text = formatReport(report, { skippedNonAdobe: 2 });
  assert.match(text, /## Notices/);
  assert.match(text, /- ⚠️ Beacon #0 unclassified \(no matching event type\) — request `r0`/);
  assert.match(text, /- ℹ️ 2 non-Adobe rows skipped/);
  assert.match(text, /\| Unclassified \| 1 \|/);
  assert.match(text, /\| Non-Adobe skipped \| 2 \|/);
});
