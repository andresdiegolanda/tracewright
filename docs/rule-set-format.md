# Authoring a rule set

A **rule set** is the external config file that tells tracewright what a particular site's
beacons *should* look like. The engine itself knows nothing site-specific — it only knows
how to apply whatever rule set you hand it. So everything about *your* events lives here, in
data, never in code.

This guide teaches you to write one. The recommended path is **not** to hand-write JSON
Schema — it's to describe your events in plain English and let the
[`make-rule-set` skill](../examples/skills/make-rule-set/SKILL.md) generate the JSON, which
you then audit. We'll do exactly that, step by step.

> Authoritative references: the machine-checked shape lives in
> [`src/rule-set.schema.json`](../src/rule-set.schema.json); the design rationale is in
> [design.md §5](design.md). This document is the friendly tutorial.

---

## The big picture

```
You write:            A Markdown description of your events (plain English)
The skill produces:   A rule-set JSON file (identify matchers + JSON Schema + sequence rules)
You do:               Audit the JSON against your description, then run tracewright with it
```

The skill is an authoring aid that runs in *your* workflow (in Claude / Copilot). It is not
part of the tool. tracewright only ever reads the finished JSON. This keeps the engine
generic and keeps your taxonomy out of the codebase.

---

## What a rule set contains

Three things, top to bottom:

```jsonc
{
  "name": "my-site-checkout",          // an id for this rule set
  "description": "…",                  // one line; optional

  "eventTypes": {                      // WHAT each event must look like
    "<eventId>": {
      "identify": <matcher>,           //   how to recognize this event
      "schema":   <JSON Schema>        //   what fields/values it must have
    }
  },

  "sequence": [ <rule>, … ]            // HOW events must be ordered/counted (optional)
}
```

We'll build each piece from a description.

---

## Step 1 — Describe your events in Markdown

Start with prose. Don't think about JSON yet — think about *what you'd tell a colleague*.
Here is the running example we'll use throughout (a fictional store):

> **Event `addToCart`** — a beacon whose `events` parameter contains `scAdd`.
> It must carry `products` (non-empty) and a currency code `cc` that is one of USD, EUR, GBP.
>
> **Event `purchase`** — a beacon whose `events` contains `purchase`.
> It must carry `products` (non-empty), `cc` (USD/EUR/GBP), and an order id in `v1` that looks
> like `ORD-…`.
>
> **Ordering** — a `purchase` must be preceded by at least one `addToCart`, and there must be
> at most one `purchase` in the capture.

Two things make a good description:

- **Name each event** and say **how to tell it apart** from the others ("`events` contains
  `scAdd`"). This becomes the *identify matcher*.
- **List the fields** each event must have and any constraints ("non-empty", "one of …",
  "looks like `ORD-…`"). This becomes the *schema*.
- Optionally, **state ordering or counting rules** ("must be preceded by", "at most one").
  This becomes the *sequence*.

---

## Step 2 — Hand it to the skill

Give the Markdown to the `make-rule-set` skill. It maps each sentence to a piece of the rule
set. Understanding that mapping helps you write better descriptions and audit the result, so
let's walk through it.

### 2a. "How to recognize it" → an `identify` matcher

A matcher decides whether a given beacon *is* this event type. The simplest matcher is a
**predicate** on one parameter:

| You wrote…                              | Matcher                                          |
|-----------------------------------------|--------------------------------------------------|
| "`events` contains `scAdd`"             | `{ "param": "events", "contains": "scAdd" }`     |
| "`pageName` is exactly `home`"          | `{ "param": "pageName", "equals": "home" }`      |
| "`pageName` starts with `product:`"     | `{ "param": "pageName", "matches": "^product:" }`|
| "a `v1` is present"                     | `{ "param": "v1", "exists": true }`              |

The four operators are `equals`, `contains`, `matches` (a regular expression), and `exists`.

> **Heads-up on `contains`.** In v1 a parameter value is a raw string, so `contains` is a
> *substring* test. `{ "param": "events", "contains": "scAdd" }` matches `events=scAdd` and
> `events=scAdd,event1` — but it would also match a hypothetical `scAddBundle`. If you need an
> exact token, use `matches` with an anchored pattern.

Need more than one condition? Compose matchers with `all`, `any`, and `not`:

```jsonc
{ "all": [
  { "param": "events", "contains": "scAdd" },
  { "not": { "param": "pageName", "equals": "cart" } }
] }
```

**Make identifiers mutually exclusive.** If one beacon matches two event types, tracewright
reports it as an *authoring error* (an ambiguous beacon). Pick conditions that can't overlap.

### 2b. "What fields it must have" → a JSON Schema

Each event's `schema` is a standard [JSON Schema](https://json-schema.org/) describing the
beacon's parameters. One important v1 fact:

> **v1 validates the raw parameter map, so schemas use raw Adobe codes — not friendly names.**
> Currency is `cc` (not `currencyCode`); the first eVar is `v1` (not `eVar1`); props are
> `c1`…`c75`. And because every value arrives as a **string**, numeric or "non-empty" checks
> are expressed as string constraints.

Common translations:

| You wrote…                          | JSON Schema piece                                   |
|-------------------------------------|-----------------------------------------------------|
| "must carry `products`"             | add `"products"` to `required`                      |
| "`products` non-empty"              | `"products": { "type": "string", "minLength": 1 }`  |
| "`cc` one of USD/EUR/GBP"           | `"cc": { "enum": ["USD", "EUR", "GBP"] }`           |
| "`v1` looks like `ORD-…`"           | `"v1": { "type": "string", "pattern": "^ORD-" }`    |

So "`addToCart` must carry `products` (non-empty) and `cc` (USD/EUR/GBP)" becomes:

```json
{
  "type": "object",
  "required": ["products", "cc"],
  "properties": {
    "products": { "type": "string", "minLength": 1 },
    "cc": { "enum": ["USD", "EUR", "GBP"] }
  }
}
```

### 2c. "Ordering and counting" → `sequence` rules

v1 has exactly two cross-event rule kinds:

| You wrote…                                   | Sequence rule                                                                 |
|----------------------------------------------|-------------------------------------------------------------------------------|
| "purchase must be preceded by an add-to-cart"| `{ "rule": "precedes", "before": "addToCart", "after": "purchase", "message": "…" }` |
| "at most one purchase"                       | `{ "rule": "count", "event": "purchase", "max": 1 }`                          |

`count` accepts `exactly`, `min`, and `max` (combine `min`+`max` for a range). Always carry
your own wording into a rule's `message` — that text is what appears in the report.

---

## Step 3 — The generated rule set

Putting 2a–2c together, the skill produces this (identical to
[`examples/rule-sets/ecommerce-checkout.json`](../examples/rule-sets/ecommerce-checkout.json)):

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

---

## Step 4 — Validate it

A rule set must conform to the meta-schema. Any tracewright run loads and meta-validates the
rule set first, so the quickest check is simply to run it against a capture:

```sh
node src/cli.js --rules my-rules.json examples/captures/checkout.csv
```

If the rule set is malformed you'll get a located error, for example:

```
tracewright: Rule set "my-rules.json" is invalid:
  - (root) must have required property 'eventTypes'
```

To check structure on its own (no capture needed), call the API:

```sh
node --input-type=module -e "import {checkRuleSet} from './src/index.js'; import {readFileSync} from 'node:fs'; const p=checkRuleSet(JSON.parse(readFileSync(process.argv[1]))); console.log(p.length? p : 'valid');" my-rules.json
```

It prints `valid`, or a list of problems.

---

## Step 5 — Audit against your description

This is the step that makes the AI-assisted loop trustworthy. Read the generated JSON next to
your original Markdown and confirm, item by item:

- Every event you described has an `eventTypes` entry, and its `identify` truly recognizes it.
- No two identifiers can match the same beacon.
- Every required field and value constraint from your prose is present in the schema, using
  the correct **raw code** (`cc`, `v1`, …).
- Every ordering/counting sentence became a `sequence` rule, with your wording in `message`.

Then run it against a real (synthetic) capture and read the report. If a beacon you expected
to pass fails — or vice versa — refine the description and regenerate.

---

## Quick reference

**Top level:** `name` (required), `description`, `eventTypes` (required, ≥1), `sequence`.

**Matcher operators:** `equals`, `contains` (substring), `matches` (regex), `exists`;
composites `all`, `any`, `not`.

**Schema:** standard JSON Schema over **raw Adobe codes**; values are strings — use
`minLength`, `enum`, `pattern`, `required`.

**Sequence rules (v1):** `precedes` (`before`, `after`, `message`) and `count` (`event` +
`exactly`/`min`/`max`, `message`).

**Not in v1** (see [design.md §10](design.md)): friendly field names (`currencyCode`),
structured decoding of `events`/`products`, and other sequence kinds (`requires`, `first`, …).
Don't reach for these yet — the meta-schema will reject them.
