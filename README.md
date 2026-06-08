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

```
tracewright — all 4 beacons OK

ℹ 1 non-Adobe row skipped

Summary: 0 violations. 4 OK, 0 unclassified, 1 skipped.
```

A capture with problems reports each one under its beacon:

```
✗ Beacon #4  (request 26030)  classified as "addToCart"
  • schema    required field missing: "cc"
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

## Documentation

- [docs/design.md](docs/design.md) — architecture, rule-set format, engine interface, scope
- [docs/rule-set-format.md](docs/rule-set-format.md) — how to author a rule set (with the `make-rule-set` skill)
- [docs/request-format.md](docs/request-format.md) — Adobe/Omnibug request format + citations *(planned)*

## License

[MIT](LICENSE).
