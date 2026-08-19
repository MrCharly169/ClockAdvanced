# Contributing to Clock Advanced

Keep each change focused. Every user-visible change must update regression coverage, `CHANGELOG.md → Unreleased`, and the relevant documentation. Describe migration impact explicitly.

The only technical version source is `custom_components/clock_advanced/manifest.json`. Never add versions to the canonical frontend file, resource URL, README headings, or status documents.

Canonical frontend: `custom_components/clock_advanced/frontend/clock-advanced-card.js`

Canonical resource: `/clock_advanced/clock-advanced-card.js`

Required validation:

```bash
python -m unittest discover -s tests -v
python scripts/check_source_syntax.py
node tests/test_card_runtime.js
python scripts/build_release.py --check
```

Beta versions use `YYYY.M.PATCHbN`; stable versions use `YYYY.M.PATCH`. `PATCH` identifies one coherent customer outcome or problem bundle. A new bundle increments `PATCH` and starts at `b0`; only corrections to that same bundle increment `N`. Promote a completed bundle to `YYYY.M.PATCH` before starting the next one. Beta candidates are capped at `b9`; reaching the cap requires closing or rescoping the bundle rather than creating `b10`. A new calendar month starts at patch `.0b0`. Release preparation and publication remain separate maintainer actions. Review version, changelog, documentation, tests and migration impact before tagging.
