# Changelog

## Unreleased

- Replaced the YAML-mode lab with a Home Assistant-managed, fully editable storage dashboard and storage-backed Schedule helper.
- Reduced Card layouts to Compact, Easy, and Advanced; Easy is now the default and old layout values migrate visually without breaking existing dashboards.
- Rebuilt both graphical editors with native Home Assistant form selectors and switched the Badge to the native `ha-badge` element.
- Made Schedule-helper blocks trigger exactly once across entity creation and Home Assistant restarts, including blocks already active at startup.
- Made Recalculate clear a one-time override before returning to the recurring source.
- Matched SmartShading onboarding behavior with retryable, once-only Card and Badge notifications after entity registration.
- Expanded the live guard test to cover Vacation, Allow, Block, and Enabled behavior.
- Added a seven-step EN/DE setup wizard with a final review and explicit confirmation.
- Added a selectable Home Assistant Schedule helper source alongside the internal weekly schedule and one-time override.
- Added reusable allow/block entity-state conditions and optional non-workday blocking.
- Added a bundled graphical custom badge in the classic small round Home Assistant badge geometry, with next-alarm and lifecycle status.
- Added local light/dark integration brand icons and logos, including source SVG artwork.
- Added Schedule-helper, guard-condition, brand and badge coverage to the Docker Desktop lab.
- Added a loopback-only Docker Desktop lab pinned to Home Assistant 2026.8.1.
- Added a reproducible Lovelace dashboard covering the supported Card layouts.
- Added a non-destructive live HA smoke test for configuration, entities, guards, controls, and the served Card resource.
- Validated real start, repeat, escalation, snooze, dismiss, confirmation, vacation, and skip behavior against Home Assistant 2026.8.1.
- Realigned the Card with the original SmartShading-inspired design: full-width Sections sizing, compact 24-hour clock, status pill, lifecycle tracks, weekday tiles, action chips, and an expandable information block.

## 2026.8.0b0 - 2026-08-10

- Replaced the personal grouped-time prototype with a generic seven-day schedule.
- Added deterministic pre-alarm, ringing, repeat, escalation, snooze, dismiss, skip and timeout behavior.
- Added eight configurable native Home Assistant action phases and a versioned phase event.
- Added the bundled responsive Clock Advanced Card with EN/DE editor and permanent resource URL.
- Added migration, diagnostics, packaging, regression documentation and release validation.
