# CLAUDE.md — tracewright

Operating rules for Claude Code in this repository. Read before any commit or push.

## Project

`tracewright` is a public, MIT-licensed, open-source command-line tool that validates Adobe Analytics beacons (from Omnibug CSV exports) against configurable rule sets. It is a personal project, unrelated to any employer. The engine is generic; all site-specific taxonomy lives in external rule sets.

## Hard rules — never violate

1. **No proprietary or real-world data, anywhere.** No real report suites, internal/real event names, real captured beacons, customer data, internal endpoints, tokens, or any employer-specific taxonomy — not in code, examples, tests, fixtures, commit messages, or the changelog. Everything under `examples/` and `test/fixtures/` is invented from scratch against public Adobe documentation.

2. **Every push updates `CHANGELOG.md`.** No push lands without a corresponding changelog entry. If a change is worth pushing, it is worth recording. A push whose changelog is untouched is not ready.

## Changelog discipline

- Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).
- Day-to-day commits add bullets under the top **`## [Unreleased]`** section, grouped by **Added / Changed / Fixed / Removed**.
- Cutting a release: rename `[Unreleased]` to `## [x.y.z] - YYYY-MM-DD` using the real date the same day; open a fresh empty `[Unreleased]` above it; tag the commit `vx.y.z`.
- Pre-1.0 (current phase): the first cut is `0.1.0`; while below 1.0, breaking changes bump the **minor**.
- Entries say **what changed and why**, in plain prose. Not a dump of file names.

## Commit discipline

- One logical change per commit.
- Imperative subject line — "Add sequence evaluator", not "Added" or "Adds".
- Body: per-area rationale when a commit spans more than one concern.
- Readable history. No `wip`, `fix2`, `stuff`, or empty messages.

## Push discipline — the definition of "ready to push"

A push is ready only when **all three** hold:

1. Tests pass locally.
2. `CHANGELOG.md` reflects the change (under `[Unreleased]`, or as a version cut).
3. The commit message meets the rules above.

Then push to `origin/main`. **Never force-push `main`.** Never commit secrets, tokens, or `.env`.

## Scope guard

Build only what the current scope in `docs/design.md` specifies (v1). Anything listed under "v2 / future" is deferred — do not implement it without being asked, even if it seems quick.

---

## CHANGELOG.md seed (create this file if it does not exist)

```markdown
# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Initial repository scaffold, design document, and synthetic beacon-emitter test-data generator.
```