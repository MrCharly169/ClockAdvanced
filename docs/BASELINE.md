# Supported baseline

## Compatibility contract

- Home Assistant 2026.8.0 or newer
- integration domain `clock_advanced`
- config-entry schema version 4 with migration from earlier Clock Advanced entries
- permanent Card resource `/clock_advanced/clock-advanced-card.js`
- compatibility loader `/clock_advanced/clock-advanced.js`
- Card contract version 1 on the status sensor
- custom Card and custom Badge registered from the same bundled module
- local light/dark integration brand assets through Home Assistant's brand endpoint
- English and German Home Assistant UI

## Behavior contract

- One config entry owns exactly one clock device and its lifecycle.
- Every weekday has its own enabled flag and time.
- Each entry selects either the internal weekly schedule or one Home Assistant `schedule.*` helper.
- A Schedule-helper alarm starts only on a real `off` → `on` transition; its `next_event` is the public next alarm while inactive.
- A future one-time alarm overrides either recurring source.
- Disabled days remain disabled when holiday mode is on.
- The optional workday sensor affects only today's calculation; state changes recalculate immediately.
- Optional exact-state allow and block conditions are generic; no room, person, or helper entity is hard-coded.
- A guard becoming blocking during an active session dismisses the alarm safely.
- Repeat cadence never increments the snooze count. Snooze never increments the repeat count.
- The Start action sequence runs for the initial alarm and after each completed snooze; one Escalate sequence may be triggered by either the configured repeat threshold or snooze threshold.
- Native Home Assistant start conditions are ANDed and checked before pre-alarm and alarm start. A blocker becoming active during a session dismisses it safely.
- The configured timeout bounds the complete active session, including snoozes and restarts.
- `cleanup` follows `dismiss` or `timeout`; action failures remain visible without corrupting the schedule.
- The status sensor exposes only the versioned public Card contract, not configured action payloads.
- The Card calculates its countdown locally and does not create recorder churn.

The executable baseline is indexed in [REGRESSION_MATRIX.md](REGRESSION_MATRIX.md).
