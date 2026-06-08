/**
 * schema.js — per-event JSON Schema validation via Ajv, with errors mapped to Violations.
 *
 * Each event type's `schema` is a raw JSON Schema authored in the rule set. We compile one
 * validator per event type and run a classified event's raw param map through it. Ajv's
 * errors are translated into the engine's uniform Violation shape so the report layer never
 * has to know about Ajv.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Compile one Ajv validator per event type.
 * @param {{eventTypes: Record<string, {schema: object}>}} ruleSet
 * @returns {Record<string, import('ajv').ValidateFunction>}
 * @throws {Error} if an event type's schema is not a valid JSON Schema
 */
export function compileSchemas(ruleSet) {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validators = {};
  for (const [type, def] of Object.entries(ruleSet.eventTypes)) {
    try {
      validators[type] = ajv.compile(def.schema);
    } catch (err) {
      throw new Error(`Invalid JSON Schema for event type "${type}": ${err.message}`);
    }
  }
  return validators;
}

/**
 * Validate one classified event's params against its type's schema.
 * @param {{index: number, requestId: string|null, params: Record<string,string>}} event
 * @param {string} type
 * @param {Record<string, import('ajv').ValidateFunction>} validators
 * @returns {object[]} Violations (empty when the event satisfies its schema)
 */
export function validateEvent(event, type, validators) {
  const validate = validators[type];
  if (validate(event.params)) return [];
  return validate.errors.map((err) => toViolation(event, type, err));
}

function fieldOf(err) {
  if (err.keyword === 'required') return err.params.missingProperty;
  if (err.instancePath) return err.instancePath.replace(/^\//, '').replace(/\//g, '.');
  return '(root)';
}

function toViolation(event, type, err) {
  const field = fieldOf(err);
  const value = field in event.params ? event.params[field] : null;
  const { message, expected, actual } = describe(err, field, value);
  return {
    code: 'schema',
    beacon: event.index,
    requestId: event.requestId ?? null,
    eventType: type,
    field,
    message,
    expected,
    actual
  };
}

function describe(err, field, value) {
  switch (err.keyword) {
    case 'required':
      return { message: `required field missing: "${field}"`, expected: 'present', actual: null };
    case 'enum':
      return {
        message: `field "${field}" must be one of ${JSON.stringify(err.params.allowedValues)}`,
        expected: err.params.allowedValues,
        actual: value
      };
    case 'minLength':
      return {
        message: err.params.limit === 1
          ? `field "${field}" must not be empty`
          : `field "${field}" must be at least ${err.params.limit} characters`,
        expected: `minLength ${err.params.limit}`,
        actual: value ?? ''
      };
    case 'pattern':
      return {
        message: `field "${field}" does not match required pattern ${err.params.pattern}`,
        expected: err.params.pattern,
        actual: value
      };
    case 'type':
      return { message: `field "${field}" must be of type ${err.params.type}`, expected: err.params.type, actual: value };
    default:
      return { message: `field "${field}" ${err.message}`, expected: null, actual: value };
  }
}
