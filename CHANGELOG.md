# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- The CLI's default report format is now **text** (was Markdown); pass `--format markdown` (`-f markdown`) for the Markdown report.
- Moved `beacon-emitter.html` from the repo root into `examples/`, added an on-page "How to use it" walkthrough, and documented it in the README and design doc.

## [0.1.0] - 2026-06-08

First release. A generic engine that validates Adobe Analytics beacons from an Omnibug CSV
export against an external, declarative rule set.

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
- Report renderer with two formats, selectable via `--format` (`-f`): Markdown (default — beacon-grouped violations, a notices section, and a summary table) and plain text (the compact `✗ Beacon … • code message` form with a one-line summary).
- Command-line interface (`tracewright --rules <file> [--format markdown|text] <export.csv>`).
- Synthetic example rule sets and captures, plus a standalone `beacon-emitter.html` test-data generator — all invented against public Adobe documentation, with no real-world data.
- `make-rule-set` example skill (`examples/skills/`) that turns a plain-language Markdown event spec into a rule-set JSON file, documenting the design's authoring loop without adding anything to the engine.
- Documentation: a design document, `docs/rule-set-format.md` (a didactic authoring guide built around the skill), and a README covering install, usage, and how to run the tests.
- Test suite (Node's built-in runner): unit tests per engine module plus end-to-end suites, including a cross-rule-set test that runs two contrasting rule sets against the same captures — executable proof that validation is driven by the rule set, not the engine.

[Unreleased]: https://github.com/andresdiegolanda/tracewright/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/andresdiegolanda/tracewright/releases/tag/v0.1.0
