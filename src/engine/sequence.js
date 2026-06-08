/**
 * sequence.js — cross-event ordering / counting rules.
 *
 * JSON Schema is per-document, so ordering and counting across the whole capture live here
 * instead. Each rule kind is a pure evaluator `(classified, rule) -> Violation[]` registered
 * in EVALUATORS; adding a kind is additive. v1 ships two: `precedes` and `count`.
 *
 * `classified` is the capture in order: an array of { event, type }, where `type` is the
 * logical event-type id or null for unclassified beacons.
 */

/**
 * `precedes` — every occurrence of `after` must have some `before` earlier in the capture.
 */
function precedes(classified, rule) {
  const violations = [];
  let seenBefore = false;
  for (const { event, type } of classified) {
    if (type === rule.before) seenBefore = true;
    if (type === rule.after && !seenBefore) {
      violations.push({
        code: 'precedes',
        beacon: event.index,
        requestId: event.requestId ?? null,
        eventType: type,
        field: null,
        message: rule.message || `"${rule.after}" has no preceding "${rule.before}"`,
        expected: `a "${rule.before}" before "${rule.after}"`,
        actual: `"${rule.after}" at #${event.index} with no prior "${rule.before}"`
      });
    }
  }
  return violations;
}

/**
 * `count` — the number of occurrences of `event` must satisfy exactly / min / max bounds.
 * Any combination of bounds present is enforced (so min+max expresses a range).
 */
function count(classified, rule) {
  const n = classified.filter((c) => c.type === rule.event).length;
  const violations = [];
  const make = (expected) => ({
    code: 'count',
    beacon: null,
    requestId: null,
    eventType: rule.event,
    field: null,
    message: rule.message || `"${rule.event}" must occur ${expected}, got ${n}`,
    expected,
    actual: n
  });

  if ('exactly' in rule && n !== rule.exactly) violations.push(make(`exactly ${rule.exactly}`));
  if ('min' in rule && n < rule.min) violations.push(make(`at least ${rule.min}`));
  if ('max' in rule && n > rule.max) violations.push(make(`at most ${rule.max}`));
  return violations;
}

const EVALUATORS = { precedes, count };

/**
 * Run every sequence rule in the rule set over the classified capture.
 * @param {Array<{event: {index: number, requestId?: string|null}, type: string|null}>} classified
 * @param {{sequence?: Array<{rule: string}>}} ruleSet
 * @returns {object[]} Violations
 */
export function evaluateSequence(classified, ruleSet) {
  const violations = [];
  for (const rule of ruleSet.sequence ?? []) {
    const evaluator = EVALUATORS[rule.rule];
    if (evaluator) violations.push(...evaluator(classified, rule));
  }
  return violations;
}
