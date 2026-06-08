---
name: make-rule-set
description: Generate a tracewright rule set from a plain-language Markdown description of a site's Adobe Analytics events. Produces a JSON rule set (eventTypes with identify matchers + JSON Schema, plus precedes/count sequence rules) that validates against the meta-schema. Use when an author describes expected events in prose and wants a rule-set file.
---

# make-rule-set

Turn a natural-language **Markdown spec** of a site's analytics events into a **tracewright
rule-set JSON file**. This is the authoring loop from the design (docs/design.md §5.4):

```
Markdown spec  →  (this skill)  →  rule-set JSON  →  human audits it  →  tracewright uses it
```

This skill lives entirely in the author's workflow. It is **not** part of the engine: the
tool only ever consumes the finished JSON, and the engine stays generic. Never copy real
report suites, internal event names, or captured values into a rule set — invent everything
from the spec, as with everything else in this repo.

## Inputs

A Markdown description of the events to validate. For example:

> **Event `addToCart`** — a beacon whose `events` contains `scAdd`.
> Requires `products` (non-empty) and `cc` (one of USD, EUR, GBP).
>
> **Event `purchase`** — a beacon whose `events` contains `purchase`.
> Requires `products` (non-empty), `cc` (USD/EUR/GBP), and `v1` (an order id like `ORD-…`).
> A purchase must be preceded by at least one add-to-cart, and may occur at most once.

## The rule-set shape you must produce (v1)

A single JSON object:

```jsonc
{
  "name": "<kebab-case id>",
  "description": "<one line; note it is synthetic>",
  "eventTypes": {
    "<eventId>": {
      "identify": <matcher>,     // how to recognize this event among beacons
      "schema": <JSON Schema>    // a raw JSON Schema over the event's raw param map
    }
  },
  "sequence": [ <sequence rule>, ... ]   // optional
}
```

Authoritative reference: the meta-schema at `src/rule-set.schema.json` and §5 of
`docs/design.md`. The rule set must validate against that meta-schema.

### identify matchers

A matcher is a predicate, optionally composed:

- Predicate: `{ "param": "<name>", "<op>": <value> }` where `<op>` is one of
  - `equals` — exact string match
  - `contains` — substring of the raw value (note: `events` is a raw string in v1, so
    `{ "param": "events", "contains": "scAdd" }` is a substring test, not list membership)
  - `matches` — regular expression
  - `exists` — `true`/`false` for param presence
- Composite: `{ "all": [matcher, …] }`, `{ "any": [matcher, …] }`, `{ "not": matcher }`

Pick an identifier that is unique across event types so a beacon never matches two types
(that is reported as an authoring error).

### schema — raw JSON Schema over raw Adobe param codes

In v1 the engine validates the **raw parameter map**, so schemas reference **raw Adobe
codes**, not friendly names:

| Concept            | Raw code(s)        |
|--------------------|--------------------|
| currency code      | `cc`               |
| eVars              | `v1`…`v250`        |
| props              | `c1`…`c75`         |
| events / products / pageName | `events`, `products`, `pageName` |

All param values are **strings**, so:

- non-empty → `{ "type": "string", "minLength": 1 }`
- allowed values → `{ "enum": ["USD", "EUR", "GBP"] }`
- format/number → `{ "type": "string", "pattern": "^ORD-" }`
- required fields → `"required": ["products", "cc"]`

(A friendly-name layer that would let schemas say `currencyCode` instead of `cc` is a v2
item — do not assume it exists.)

### sequence rules (v1 vocabulary — only these two)

- `{ "rule": "precedes", "before": "<a>", "after": "<b>", "message": "<why>" }` — every
  `<b>` must have an earlier `<a>` in the capture.
- `{ "rule": "count", "event": "<x>", "max": 1 }` — occurrence bound; use `exactly`,
  `min`, and/or `max` (combine `min`+`max` for a range).

Do not invent other sequence kinds (`requires`, `first`, etc. are v2).

## Steps

1. For each event in the spec, choose a kebab/camel `eventId` and write an `identify`
   matcher that uniquely recognizes it.
2. Translate each stated field requirement into JSON Schema (`required` + `properties`),
   using raw codes and string-typed checks.
3. Translate ordering/uniqueness sentences into `precedes` / `count` rules, carrying the
   author's wording into each rule's `message`.
4. Write the result to a `.json` file under the author's chosen path
   (e.g. `examples/rule-sets/<name>.json`).
5. **Validate it** — the rule set must pass the meta-schema. Any tracewright run loads and
   meta-validates the rule set, so:

   ```sh
   node src/cli.js --rules <your-rules>.json examples/captures/checkout.csv
   ```

   A meta-schema problem prints `tracewright: Rule set "<path>" is invalid: …`. For a
   structural check without a capture, call the API:

   ```sh
   node --input-type=module -e "import {checkRuleSet} from './src/index.js'; import {readFileSync} from 'node:fs'; const p=checkRuleSet(JSON.parse(readFileSync(process.argv[1]))); console.log(p.length? p : 'valid');" <your-rules>.json
   ```

6. **Hand it back to the human to audit** against the original Markdown spec — confirm every
   field, value, and ordering rule was captured faithfully before trusting the rule set.

## Worked example

The spec at the top of this file produces:

```json
{
  "name": "example-ecommerce-checkout",
  "description": "Illustrative checkout flow for a fictional store (synthetic).",
  "eventTypes": {
    "addToCart": {
      "identify": { "param": "events", "contains": "scAdd" },
      "schema": {
        "type": "object",
        "required": ["products", "cc"],
        "properties": {
          "cc": { "enum": ["USD", "EUR", "GBP"] },
          "products": { "type": "string", "minLength": 1 }
        }
      }
    },
    "purchase": {
      "identify": { "param": "events", "contains": "purchase" },
      "schema": {
        "type": "object",
        "required": ["products", "cc", "v1"],
        "properties": {
          "cc": { "enum": ["USD", "EUR", "GBP"] },
          "products": { "type": "string", "minLength": 1 },
          "v1": { "type": "string", "pattern": "^ORD-" }
        }
      }
    }
  },
  "sequence": [
    { "rule": "precedes", "before": "addToCart", "after": "purchase",
      "message": "A purchase must be preceded by at least one add-to-cart." },
    { "rule": "count", "event": "purchase", "max": 1 }
  ]
}
```

This is exactly the shape of `examples/rule-sets/ecommerce-checkout.json` — use it as a
reference output.
