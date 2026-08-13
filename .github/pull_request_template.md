## Summary

Describe the user-visible problem and the focused solution.

## Validation

- [ ] `python -m unittest discover -s tests -v`
- [ ] `python scripts/check_source_syntax.py`
- [ ] `node tests/test_card_runtime.js`
- [ ] `python scripts/build_release.py --check`
- [ ] Relevant Home Assistant lab checks were run, or the reason they were not is documented.

## Contract and documentation

- [ ] User-visible changes are recorded under `CHANGELOG.md → Unreleased`.
- [ ] English and German surfaces remain aligned where applicable.
- [ ] Migration impact is described explicitly, including “none”.
- [ ] No private entity IDs, notification targets, URLs, credentials, tokens, or production diagnostics are included.
- [ ] The manifest remains the only technical version source.

## Screenshots

Add anonymized real UI screenshots for Card, Badge or config-flow changes. Remove private names, rooms, entity IDs, targets and URLs.
