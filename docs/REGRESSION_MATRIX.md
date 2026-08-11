# Regression matrix

| Area | Required behavior | Coverage |
| --- | --- | --- |
| Weekdays | Seven independent enabled/time pairs | `tests/test_schedule.py` |
| Disabled days | Disabled days are skipped even with holiday mode | `tests/test_schedule.py` |
| Workday override | Current-day override does not leak into future dates | `tests/test_schedule.py` |
| One-time alarm | A future one-time value overrides the weekly occurrence | `tests/test_schedule.py` |
| Schedule helper | `next_event` is exposed; a new or startup-active block starts exactly once | `scripts/dev.ps1 schedule-test` |
| Generic guards | Allow mismatch, block match and non-workday block produce `blocked` | Docker live lifecycle test |
| DST | Target date receives the correct local UTC offset | `tests/test_schedule.py` |
| Suppression | Disabled and vacation states arm no alarm | `tests/test_schedule.py` |
| Card contract | Permanent resource, contract and standard control map stay coherent | `tests/test_package.py` |
| Card API | Registration, editor, stub, grid sizing and entity suggestions work | `tests/test_card_runtime.js` |
| Badge API | Registration, editor, stub and Home Assistant picker metadata work | `tests/test_card_runtime.js` |
| Native editing | Storage dashboard, storage Schedule helper and native Card/Badge editors remain UI-editable | Docker browser test |
| Onboarding notification | Entity-aware retry creates one Easy Card and native Badge notification per new clock | `tests/test_package.py`, Docker browser test |
| Brand assets | Required local light/dark icons and logos are packaged and served | `tests/test_package.py`, HA smoke test |
| Setup wizard | Seven steps, source branching, translations and explicit review confirmation | HA config-flow live test |
| Localization | EN and DE contain the same setup/entity surfaces | `tests/test_package.py` |
| Privacy | Diagnostics redact action sequences and linked entities | `tests/test_package.py` |
| Packaging | HACS, manifest, changelog and legacy loader are coherent | `scripts/build_release.py --check` |

Every fixed bug should add a row and an automated regression test where technically possible.
