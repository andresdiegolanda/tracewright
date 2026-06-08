import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRuleSet, loadRuleSet } from '../src/engine/load-rule-set.js';

const validRuleSet = {
  name: 'example-ecommerce-checkout',
  description: 'Illustrative checkout flow for a fictional store.',
  eventTypes: {
    addToCart: {
      identify: { param: 'events', contains: 'scAdd' },
      schema: {
        type: 'object',
        required: ['products', 'cc'],
        properties: {
          cc: { enum: ['USD', 'EUR', 'GBP'] },
          products: { type: 'string', minLength: 1 }
        }
      }
    }
  },
  sequence: [
    { rule: 'precedes', before: 'addToCart', after: 'purchase' },
    { rule: 'count', event: 'purchase', max: 1 }
  ]
};

test('checkRuleSet accepts a valid rule set', () => {
  assert.deepEqual(checkRuleSet(validRuleSet), []);
});

test('checkRuleSet rejects a missing name', () => {
  const { name, ...noName } = validRuleSet;
  const problems = checkRuleSet(noName);
  assert.ok(problems.length > 0);
  assert.ok(problems.some((p) => /name/.test(p)));
});

test('checkRuleSet rejects an empty eventTypes object', () => {
  const problems = checkRuleSet({ name: 'x', eventTypes: {} });
  assert.ok(problems.length > 0);
});

test('checkRuleSet rejects an event type missing identify or schema', () => {
  const problems = checkRuleSet({
    name: 'x',
    eventTypes: { foo: { schema: { type: 'object' } } }
  });
  assert.ok(problems.some((p) => /identify/.test(p)));
});

test('checkRuleSet rejects a predicate with two operators', () => {
  const problems = checkRuleSet({
    name: 'x',
    eventTypes: { foo: { identify: { param: 'events', equals: 'a', contains: 'b' }, schema: { type: 'object' } } }
  });
  assert.ok(problems.length > 0);
});

test('checkRuleSet accepts composed all/any/not matchers', () => {
  const problems = checkRuleSet({
    name: 'x',
    eventTypes: {
      foo: {
        identify: { all: [{ param: 'events', contains: 'scAdd' }, { not: { param: 'cc', exists: false } }] },
        schema: { type: 'object' }
      }
    }
  });
  assert.deepEqual(problems, []);
});

test('checkRuleSet rejects a count rule with no bound', () => {
  const problems = checkRuleSet({
    name: 'x',
    eventTypes: { foo: { identify: { param: 'events', exists: true }, schema: { type: 'object' } } },
    sequence: [{ rule: 'count', event: 'foo' }]
  });
  assert.ok(problems.length > 0);
});

test('checkRuleSet rejects an unknown sequence rule kind', () => {
  const problems = checkRuleSet({
    name: 'x',
    eventTypes: { foo: { identify: { param: 'events', exists: true }, schema: { type: 'object' } } },
    sequence: [{ rule: 'whenever', event: 'foo' }]
  });
  assert.ok(problems.length > 0);
});

test('loadRuleSet reads and validates a file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-'));
  try {
    const path = join(dir, 'rules.json');
    await writeFile(path, JSON.stringify(validRuleSet));
    const loaded = await loadRuleSet(path);
    assert.equal(loaded.name, 'example-ecommerce-checkout');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadRuleSet throws a clear error on invalid JSON', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tw-'));
  try {
    const path = join(dir, 'bad.json');
    await writeFile(path, '{ not json');
    await assert.rejects(() => loadRuleSet(path), /not valid JSON/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadRuleSet throws a clear error when the file is missing', async () => {
  await assert.rejects(() => loadRuleSet('/no/such/rules.json'), /Cannot read rule set/);
});
