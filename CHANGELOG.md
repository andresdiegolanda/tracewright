# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- The report is now Markdown — beacon headings, grouped violation lists, a notices section, and a summary table — so it reads more clearly in a terminal and can be pasted straight into a file. The result line now states the total violation count (which also fixes the confusing "0 of N beacons" heading when only a sequence rule failed).

### Added
- Project scaffold: ESM package manifest, MIT license, README, and the `tracewright` design document.
- Generic validation engine, with no hardcoded event taxonomy:
  - Beacon decoder that turns a raw Adobe `/b/ss/` request (query string plus optional POST body) into a normalized event with a raw parameter map.
  - Rule-set loader that meta-validates a rule-set document on load against a published JSON Schema.
  - Event classification via composable `identify` matchers (`equals` / `contains` / `matches` / `exists`, combined with `all` / `any` / `not`).
  - Per-event validation against author-supplied JSON Schema using Ajv.
  - Cross-event sequence rules: `precedes` and `count`.
  - Validation pipeline (classify → schema → sequence) producing a single report; unclassified beacons are reported as warnings, not failures.
- Omnibug CSV export reader: skips the metadata line, maps columns by the header row, tolerates rows shorter than the header, and counts-and-skips non-Adobe rows.
- Human-readable text report and a command-line interface (`tracewright --rules <file> <export.csv>`).
- Synthetic example rule set and capture, plus a standalone `beacon-emitter.html` test-data generator — all invented against public Adobe documentation, with no real-world data.
- README section explaining how to install dependencies and run the test suite.
- `make-rule-set` example skill (`examples/skills/`) that turns a plain-language Markdown event spec into a rule-set JSON file, documenting the design's authoring loop without adding anything to the engine.
- `docs/rule-set-format.md` — a didactic guide to authoring a rule set via the `make-rule-set` skill, mapping plain-English event descriptions to identify matchers, JSON Schema, and sequence rules.
- More synthetic example captures exercising each validation path (missing/invalid currency, bad order id, purchase without a cart, duplicate purchase, an unclassified beacon, and a mixed-error capture), with a data-driven test that runs every capture against the example rule set.
