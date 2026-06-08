/**
 * classify.js — evaluate `identify` matchers to recognize an event's logical type.
 *
 * Because normalized events are generic, the rule set tells the engine how to recognize
 * each logical event type via an `identify` matcher. This module evaluates those matchers
 * against an event's raw param map. It is the only place "which event is this?" is decided,
 * and it knows no event names of its own.
 *
 * A matcher is either a primitive predicate or a composite:
 *   predicate:  { param, equals }   | { param, contains } | { param, matches } | { param, exists }
 *   composite:  { all: [matcher] }  | { any: [matcher] }   | { not: matcher }
 *
 * Predicate semantics (v1, raw string params):
 *   equals    — param value is exactly the given string
 *   contains  — param value contains the given substring
 *   matches   — param value matches the given regular expression
 *   exists    — param is present (true) or absent (false)
 */

/**
 * Test whether a param map satisfies a matcher.
 * @param {Record<string,string>} params
 * @param {object} matcher
 * @returns {boolean}
 */
export function matches(params, matcher) {
  if (matcher.all) return matcher.all.every((m) => matches(params, m));
  if (matcher.any) return matcher.any.some((m) => matches(params, m));
  if (matcher.not) return !matches(params, matcher.not);

  const { param } = matcher;
  const present = Object.prototype.hasOwnProperty.call(params, param);

  if ('exists' in matcher) return matcher.exists ? present : !present;
  if (!present) return false;

  const value = params[param];
  if ('equals' in matcher) return value === matcher.equals;
  if ('contains' in matcher) return value.includes(matcher.contains);
  if ('matches' in matcher) {
    let re;
    try {
      re = new RegExp(matcher.matches);
    } catch (err) {
      throw new Error(`Invalid 'matches' pattern in rule set: ${matcher.matches} (${err.message})`);
    }
    return re.test(value);
  }
  return false;
}

/**
 * Find every event type whose `identify` matcher accepts this event.
 * Returns an array of type ids: 0 = unclassified, 1 = classified, >1 = ambiguous.
 * @param {{params: Record<string,string>}} event
 * @param {{eventTypes: Record<string, {identify: object}>}} ruleSet
 * @returns {string[]}
 */
export function classify(event, ruleSet) {
  const hits = [];
  for (const [type, def] of Object.entries(ruleSet.eventTypes)) {
    if (matches(event.params, def.identify)) hits.push(type);
  }
  return hits;
}
