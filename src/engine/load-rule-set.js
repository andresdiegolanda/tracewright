/**
 * load-rule-set.js — read a rule-set JSON file and meta-validate it on load.
 *
 * The rule-set document is validated against the published meta-schema
 * (src/rule-set.schema.json) via Ajv, so authors get clear, located errors for a
 * malformed rule set before any beacon is processed. This does NOT compile the per-event
 * JSON Schemas — that is schema.js's job (and surfaces its own errors).
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const require = createRequire(import.meta.url);
const metaSchema = require('../rule-set.schema.json');

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateDoc = ajv.compile(metaSchema);

/**
 * Meta-validate a parsed rule-set document.
 * @param {unknown} doc
 * @returns {string[]} a list of human-readable problems; empty when the document is valid.
 */
export function checkRuleSet(doc) {
  if (validateDoc(doc)) return [];
  return validateDoc.errors.map((err) => {
    const where = err.instancePath || '(root)';
    return `${where} ${err.message}`;
  });
}

/**
 * Read and meta-validate a rule-set file.
 * @param {string} path
 * @returns {Promise<object>} the validated rule-set document
 * @throws {Error} with a clear message if the file is unreadable, not JSON, or invalid
 */
export async function loadRuleSet(path) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read rule set "${path}": ${err.message}`);
  }

  let doc;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    throw new Error(`Rule set "${path}" is not valid JSON: ${err.message}`);
  }

  const problems = checkRuleSet(doc);
  if (problems.length > 0) {
    throw new Error(`Rule set "${path}" is invalid:\n  - ${problems.join('\n  - ')}`);
  }

  return doc;
}
