# tracewright

A command-line tool that reads a tracking-call capture **exported from the
[Omnibug](https://omnibug.io) browser extension** (CSV), validates the Adobe Analytics /
Experience Cloud beacons in it against a configurable **rule set**, and prints a report.

> **Status:** v1 in progress. See [docs/design.md](docs/design.md) for the full design.

## Why

The **engine is generic**: it contains no hardcoded event names, field requirements, value
rules, or ordering rules. Everything site-specific lives in a **rule set** — an external
JSON config file loaded at runtime. The repo ships only generic, illustrative examples; no
real-world or proprietary taxonomy ever lives in the code.

## What it checks

Given an Omnibug CSV export plus a rule set, the engine validates:

- **Field presence / type / allowed values / patterns** per event (declarative JSON Schema)
- **Sequence and ordering** rules across events (e.g. "A must precede B", "C at most once")

and reports every violation in a clear, human-readable summary.

## Install

```sh
npm install
```

## Usage

```sh
tracewright --rules <rule-set.json> <omnibug-export.csv>
```

Try it against the bundled synthetic example:

```sh
node src/cli.js --rules examples/rule-sets/ecommerce-checkout.json examples/captures/checkout.csv
```

By default the report is plain text:

```
tracewright — all 4 beacons OK

ℹ 1 non-Adobe row skipped

Summary: 0 violations. 4 OK, 0 unclassified, 1 skipped.
```

A capture with problems reports each one under its beacon:

```
✗ Beacon #2  (request 3703, ...)  classified as "addToCart"
  • schema    field "cc" must be one of ["USD","EUR","GBP"] (got: "JPY")
```

Pass `--format markdown` (`-f markdown`) for a Markdown report you can paste straight into a
file — beacon headings, grouped violations, and a summary table:

```markdown
# tracewright report

**Rule set:** `example-ecommerce-checkout`

**Result:** ✅ All 4 beacons passed.

## Summary

| Metric | Count |
| --- | --- |
| Beacons checked | 4 |
| Passed | 4 |
| Non-Adobe skipped | 1 |
| Violations | 0 |
```

To produce your own capture: open `beacon-emitter.html` in a browser, click through the
flow with Omnibug recording, and export Omnibug's capture as CSV.

## Running the tests

The test suite uses Node's built-in test runner (`node:test`) — no test framework to install.

```sh
npm install   # one-time, installs ajv + ajv-formats
npm test      # runs node --test over test/
```

`npm test` discovers every `test/*.test.js` file and exercises the engine modules, the CSV
reader, the report renderer, and an end-to-end run against the bundled synthetic fixtures.
To run a single file:

```sh
node --test test/decode.test.js
```

### End-to-end tests

Three suites run the whole pipeline (read CSV → validate → report) against the bundled
synthetic fixtures:

- `test/e2e.test.js` — runs the example rule set against the clean example capture and
  `test0.csv`, checking both the violations and the rendered report.
- `test/captures.test.js` — runs the example rule set against every example capture,
  asserting the expected outcome for each (clean, schema, sequence, unclassified).
- `test/cross-rule-set.test.js` — runs **two contrasting rule sets** against the same
  captures. Captures that fail the strict `ecommerce-checkout` rules pass under the
  permissive `minimal-presence` rules, with no change to any engine code. This is the
  executable proof of the rules-as-data design: validation behaviour comes from the rule
  set, not the engine.

Run just the end-to-end suites:

```sh
node --test test/e2e.test.js test/captures.test.js test/cross-rule-set.test.js
```

## Documentation

- [docs/design.md](docs/design.md) — architecture, rule-set format, engine interface, scope
- [docs/rule-set-format.md](docs/rule-set-format.md) — how to author a rule set (with the `make-rule-set` skill)
- [docs/request-format.md](docs/request-format.md) — Adobe/Omnibug request format + citations *(planned)*

## License

[MIT](LICENSE).
