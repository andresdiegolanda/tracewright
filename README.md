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

(CLI wiring lands later in v1 — see the design doc's scope section.)

## Documentation

- [docs/design.md](docs/design.md) — architecture, rule-set format, engine interface, scope
- [docs/rule-set-format.md](docs/rule-set-format.md) — authoring reference *(planned)*
- [docs/request-format.md](docs/request-format.md) — Adobe/Omnibug request format + citations *(planned)*

## License

[MIT](LICENSE).
