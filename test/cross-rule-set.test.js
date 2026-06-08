/**
 * Cross-rule-set end-to-end tests — the executable proof that the engine is generic.
 *
 * The same engine and the same captures are run against two contrasting rule sets:
 *   - example-ecommerce-checkout (strict: enums, patterns, required fields, sequence rules)
 *   - minimal-presence           (permissive: presence checks only, no ordering)
 *
 * Captures that fail the strict rules pass under the permissive rules, with no change to any
 * code — behaviour is driven entirely by the rule set. All fixtures are synthetic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadRuleSet } from '../src/engine/load-rule-set.js';
import { readExport } from '../src/read.js';
import { validate } from '../src/engine/validate.js';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const STRICT = at('../examples/rule-sets/ecommerce-checkout.json');
const MINIMAL = at('../examples/rule-sets/minimal-presence.json');

async function run(rulesPath, captureFile) {
  const ruleSet = await loadRuleSet(rulesPath);
  const { events, skipped } = readExport(await readFile(at(`../examples/captures/${captureFile}`), 'utf8'));
  return { events, skipped, report: validate(events, ruleSet) };
}

// Captures that fail under the strict rules but are clean under the permissive ones.
const DIVERGING = [
  'missing-currency.csv',      // strict requires cc
  'bad-currency.csv',          // strict enum on cc
  'bad-order-id.csv',          // strict pattern on v1
  'purchase-without-cart.csv', // strict precedes
  'duplicate-purchase.csv',    // strict count
  'mixed-errors.csv'           // strict: several schema rules
];

for (const file of DIVERGING) {
  test(`${file}: fails the strict rules, passes the permissive rules`, async () => {
    const strict = await run(STRICT, file);
    const minimal = await run(MINIMAL, file);
    assert.ok(strict.report.violations.length > 0, 'expected violations under the strict rule set');
    assert.equal(minimal.report.violations.length, 0, 'expected no violations under the permissive rule set');
    // The same beacons are parsed either way — only the verdict differs.
    assert.equal(minimal.events.length, strict.events.length);
  });
}

test('clean-multi passes under both rule sets', async () => {
  const strict = await run(STRICT, 'clean-multi.csv');
  const minimal = await run(MINIMAL, 'clean-multi.csv');
  assert.deepEqual(strict.report.violations, []);
  assert.deepEqual(minimal.report.violations, []);
});

test('both rule sets classify identically and leave event99 unclassified', async () => {
  const strict = await run(STRICT, 'unclassified.csv');
  const minimal = await run(MINIMAL, 'unclassified.csv');
  assert.equal(strict.report.summary.unclassified, 1);
  assert.equal(minimal.report.summary.unclassified, 1);
});

test('the permissive rule set classifies via regex and substring matchers end to end', async () => {
  const { report } = await run(MINIMAL, 'clean-multi.csv');
  const types = report.classified.map((c) => c.type);
  // pageView (matches ^home$), productView/addToCart (contains), purchase (matches "purchase")
  assert.deepEqual(types, ['pageView', 'productView', 'addToCart', 'addToCart', 'purchase']);
});
