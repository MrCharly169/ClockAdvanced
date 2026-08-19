# Changelog

## Unreleased

## 2026.8.1b9 - 2026-08-19

- Made Dismiss/Timeout and the shared Cleanup sequence one awaited terminal path so Card, mobile button, wake-confirmation sensor, blockers, and safety timeout cannot leave completion actions detached.
- Preserved the terminal reason after schedule recalculation and supplied Home Assistant script contexts for reliable action execution without missing-context warnings.
- Added a real Home Assistant regression that temporarily installs harmless action probes and verifies both manual Dismiss and wake confirmation run Dismiss followed by Cleanup.
- Corrected the HAUS1-ET1 migration example to end the refactored NightTime routine through its helper, restoring daytime automation only after Dismiss instead of calling a trigger-dependent automation directly.
- Fixed evening reminders for modern Notify entities: mobile-app targets now use their interactive `notify.mobile_app_*` service, while every other Notify entity receives a standards-compliant title/message fallback instead of a rejected extended-data payload.
- Clarified in setup and options that the evening reminder has its own enable switch and is not enabled merely by selecting notification recipients.
- Applied Home Assistant's static Script schema before asynchronous action validation so nested template conditions from the native action selector become real Template objects instead of failing at alarm start.

## 2026.8.1b8 - 2026-08-19

- Made the Advanced Card time editor follow the selected day's effective normal, Holiday weekday, or Holiday weekend/public-holiday time as modes and settings change.
- Added direct persistence for Holiday weekday and weekend/public-holiday time edits from the Card without reloading the config entry.
- Highlighted the currently selected weekday in yellow so the active editing context remains unmistakable.

## 2026.8.1b7 - 2026-08-19

- Split Holiday time into separate weekday and weekend/public-holiday times in setup and options, with automatic migration from the existing non-workday time.
- Applied the weekend/public-holiday Holiday time on Saturdays, Sundays, and current weekdays reported as non-workdays, while preserving disabled days and normal weekly times when Holiday mode is off.
- Updated the Advanced Card weekly overview to show both effective Holiday times consistently with the calculated next alarm.
- Contained and centered the native time input on iPhone/Safari so its dark control no longer overflows to the right.

## 2026.8.1b6 - 2026-08-19

- Rebuilt the repository and HACS README as an English product page with a synchronized full German edition, verified installation guidance, exact source/state/lifecycle documentation, real anonymized Card and Badge screenshots, lifecycle/source diagrams, and a 1280 × 640 social preview.
- Added structured bug and feature forms, a pull-request template, security guidance, and a project code of conduct without changing integration, schedule, or runtime behavior.
- Removed the decorative Prepare and Alarm progress bars to make the Card calmer and more compact.
- Let Home Assistant measure Card rows automatically, eliminating the oversized invisible grid area and excess dashboard scrolling.
- Updated the Card surface, state gradients, spacing, controls, and icon alignment to match the Smart Shading Card family.
- Made the Advanced weekly overview show the effective Holiday time on every enabled day while Holiday mode is active, keeping it consistent with the large next-alarm time.

## 2026.8.1b5 - 2026-08-13

- Cleaned up the default Card surface while preserving direct weekday selection, the five-minute slider, exact time input, and day enable control in Advanced mode.
- Moved Skip next, Holiday time, Vacation, and technical condition details into a closed-by-default **Options** submenu for Easy and Advanced Cards.
- Added a compact active-option counter so exceptional states remain visible without exposing every control permanently.
- Implemented the submenu as an internally scrollable overlay that preserves Card height, DOM identity, focus, open state, and dashboard scroll position during Home Assistant updates.
- Reduced the Advanced Sections grid reservation to match the cleaner closed layout while keeping Compact and existing YAML configurations compatible.

## 2026.8.1b4 - 2026-08-13

- Added a compact animated alarm-clock logo to the Card header with distinct motion for scheduled, pre-alarm, ringing, snoozed, vacation, dismissed, skipped, timeout, and error states.
- Kept the logo at a fixed responsive size and preserved its DOM identity across normal Home Assistant updates so the animation cannot introduce dashboard reflow or scroll movement.
- Disabled all logo animation and transitions automatically when the operating system requests reduced motion.

## 2026.8.1b3 - 2026-08-13

- Split the customer-facing concepts clearly: **Holiday time / Ferienzeit** keeps the alarm enabled at its alternative schedule time, while **Vacation / Urlaub** blocks it completely.
- Reorganized setup into ten short, situation-based steps and replaced the two large action pages with preparation/start, response/snooze, and finish/safety sections. The same structure is available later under Configure.
- Added an optional evening-before reminder with a configurable delivery time and Clock dashboard path.
- Added occurrence-safe mobile actions to skip exactly the announced alarm, change only that occurrence through an `HH:MM` text reply, or open the installed Clock Card. Stale notification actions cannot affect a newer alarm.
- Kept Home Assistant's notification inbox as a recipient-free fallback with a direct Clock link; native mobile Notify entities receive the interactive actions.
- Made Recalculate clear both one-time overrides and a previously skipped occurrence before returning to the recurring source.

## 2026.8.1b2 - 2026-08-13

- Added an inline Advanced Card weekday editor with selectable day tiles, a five-minute day slider, exact native time input, and per-day enable/disable control.
- Added the native persisted Clock Advanced Vacation mode switch and a permanent Vacation button on the Card; an optional external vacation entity remains supported and takes precedence when configured.
- Added `clock_advanced.set_weekday_alarm` to persist internal weekly times in config-entry options and recalculate immediately without reloading the integration or replacing Card DOM nodes.
- Increased Advanced Sections grid sizing to reserve the editor's real height while keeping Compact, Easy, legacy YAML configuration, focus, and scroll behavior compatible.
- Added a dedicated, explained notification step to setup and options: customers choose the recipients and lifecycle events while Clock Advanced generates localized titles and reasons automatically.
- Added Home Assistant notification-inbox fallback when no Notify entity is selected, plus explicit notifications for start, repeat, escalation, snooze, dismissal, timeout, skip, blockers, and action errors.
- Expanded field-level German and English guidance throughout the now eight-step setup wizard, keeping advanced action sequences optional and separate.

## 2026.8.1b1 - 2026-08-12

- Reclassified Clock Advanced as a normal Home Assistant hub integration so it is managed under Devices & services instead of being presented as a Helper.
- Kept the guided seven-step setup wizard and expanded the sectioned options flow so the integration name and alarm source can also be changed later.
- Renamed the optional `schedule.*` source in the UI to distinguish Home Assistant's native schedule entity from Clock Advanced itself.
- Replaced runtime `shadowRoot.innerHTML` rebuilds with one-time Card and Badge structures plus targeted text, class, attribute, visibility, disabled-state, and progress patches.
- Preserved `ha-card`, `ha-badge`, button, focus, and expanded-details identity across status, control, guard, and countdown updates.
- Added simulated and live scroll regressions covering irrelevant assignments, second-by-second countdown changes, rapid guard/control updates, vacation/idle/pre-alarm/ringing/snoozed states, and a real Schedule-entity ringing/snoozed lifecycle.
- Added a scrollable Home Assistant `Render stability` lab view using the permanent `/clock_advanced/clock-advanced-card.js` resource without a cache-busting query parameter.

## 2026.8.1b0 - 2026-08-12

- Stopped Card rerenders caused only by Home Assistant's `last_updated` timestamp; the Card now rebuilds its DOM only when visible data actually changes.
- Reduced Badge rerenders to its visible status, title, and alarm timing instead of comparing the complete entity attribute payload.
- Reserved a stable countdown width and aligned Compact, Easy, and Advanced Sections-grid sizing with their measured rendered heights.
- Added regression coverage proving irrelevant HA updates no longer replace Card or Badge DOM nodes.

## 2026.8.0 - 2026-08-12

- Promoted the tested `2026.8.0b1` feature set to the first stable release on `main`.
- Stable releases and tags on `main` no longer carry a beta suffix; beta tags remain prereleases from development.

## 2026.8.0b1 - 2026-08-12

- Added Home Assistant's native condition editor for alarm start guards, including numeric-state rules such as `zone.home > 1` and nested AND/OR/NOT logic.
- Added independent escalation after a configurable number of snoozes; the Start sequence now has explicit UI guidance that it runs again after each snooze period.
- Clarified motion-based wake confirmation and made an already-active confirmation sensor dismiss the alarm before outputs start.
- Migrated legacy exact-state allow/block guards into editable native Home Assistant conditions.
- Expanded the Advanced Card contract with the native-condition count and the snooze-escalation setting.

- Adopted the latest SmartShading badge logic: the native round Badge now keeps a permanent alarm-clock glyph, overlays a small lifecycle marker, uses semantic HA theme colors, avoids irrelevant rerenders, and opens native entity details by mouse or keyboard.
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
