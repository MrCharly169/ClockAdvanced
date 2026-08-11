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

Beta versions use `YYYY.M.PATCHbN`; stable versions use `YYYY.M.PATCH`. Release preparation and publication remain separate maintainer actions. Review version, changelog, documentation, tests and migration impact before tagging.
