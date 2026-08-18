# Clock Advanced

**English** · [Deutsch](docs/de/README.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/clock-advanced-logo-dark.png">
    <img src="docs/images/clock-advanced-logo.png" alt="Clock Advanced logo" width="620">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/MrCharly169/ClockAdvanced/actions/workflows/validate.yml"><img alt="Validate status" src="https://img.shields.io/github/actions/workflow/status/MrCharly169/ClockAdvanced/validate.yml?branch=main&amp;style=flat-square&amp;label=Validate"></a>
  <a href="https://github.com/MrCharly169/ClockAdvanced/releases"><img alt="Current GitHub release including prereleases" src="https://img.shields.io/github/v/release/MrCharly169/ClockAdvanced?include_prereleases&amp;style=flat-square&amp;label=Release"></a>
  <a href="https://github.com/MrCharly169/ClockAdvanced"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/MrCharly169/ClockAdvanced?style=flat-square&amp;label=Stars"></a>
  <a href="https://github.com/MrCharly169/ClockAdvanced/releases"><img alt="GitHub Release downloads" src="https://img.shields.io/github/downloads/MrCharly169/ClockAdvanced/total?style=flat-square&amp;label=Release%20downloads"></a>
  <a href="https://hacs.xyz/docs/faq/custom_repositories/"><img alt="HACS Custom Repository" src="https://img.shields.io/badge/HACS-Custom-41BDF5?style=flat-square"></a>
  <a href="#requirements"><img alt="Home Assistant 2026.8.0 or newer" src="https://img.shields.io/badge/Home%20Assistant-%E2%89%A5%202026.8.0-41BDF5?style=flat-square"></a>
  <a href="LICENSE"><img alt="License MIT" src="https://img.shields.io/github/license/MrCharly169/ClockAdvanced?style=flat-square&amp;label=License"></a>
</p>

**A complete, UI-configurable alarm clock for Home Assistant.** Clock Advanced brings the schedule, conditions, actions, snooze behavior, escalation and safe finish of one alarm clock into one integration. It also includes a responsive dashboard Card and a compact Badge.

> **Release channel:** `2026.8.1b7` is the current published beta/prerelease. The latest stable release is `2026.8.0`. Beta releases are intended for testing current features; choose the stable release when you prefer the established baseline.

## More than an alarm time

An alarm time answers only *when*. A dependable wake-up routine also needs to know what to prepare, whether it may start, how often to repeat, what Snooze means, when to escalate, and how every output is stopped.

Clock Advanced models that whole session. One config entry is one independent alarm clock, with its own schedule, conditions, action sequences, state and controls. Planning, conditions and actions are configured through Home Assistant's UI. The result is a traceable lifecycle instead of a single time-triggered automation.

![Clock Advanced lifecycle from evening reminder through cleanup](docs/images/alarm-lifecycle.svg)

## Who it is for

Clock Advanced is useful when you want to:

- wake different rooms or people with independent clocks;
- combine lights, media players, covers, scripts or notifications in one UI-managed routine;
- use a simple weekly plan or an existing Home Assistant `schedule.*` entity;
- wake later during personal Holiday Time but block alarms completely during Vacation;
- repeat an output without treating every repeat as a Snooze;
- escalate once after a chosen number of repeats or completed snoozes;
- finish media and lights predictably after dismissal or a safety timeout.

## What Clock Advanced does — and what it does not do

| Clock Advanced does | Clock Advanced does not |
| --- | --- |
| Create one Home Assistant device and a standard set of entities per config entry | Act as only a dashboard clock or a single Helper |
| Calculate or observe alarm times and run configured Home Assistant action sequences | Provide alarm audio, lights or device behavior by itself |
| Keep Repeat, Snooze and Escalate as separate concepts | Turn every repeated action into a Snooze or escalation |
| Provide a Card, Badge, graphical editors and a public status contract | Require the Card for scheduling or runtime operation |
| Store and restore the active session inside Home Assistant | Add a separate cloud scheduler or account |

The devices and services used by an action remain under your control. For example, a media action can still call a cloud-connected media integration if that is what you configure.

## Screenshots

These screenshots come from the real bundled Card and Badge running in the disposable Home Assistant 2026.8.1 lab with neutral test data.

| Compact | Easy |
| --- | --- |
| <img src="docs/images/card-compact.png" alt="Clock Advanced Compact Card showing the next alarm and scheduled state" width="360"> | <img src="docs/images/card-easy.png" alt="Clock Advanced Easy Card showing the next alarm, lifecycle tracks and Options button" width="520"> |
| **Advanced with weekly schedule** | **Clock Advanced Badge** |
| <img src="docs/images/card-advanced.png" alt="Clock Advanced Advanced Card with seven-day schedule and weekday editor" width="520"> | <img src="docs/images/clock-advanced-badge.png" alt="Clock Advanced round Badge with permanent alarm-clock symbol and scheduled-state marker" width="132"> |

Compact keeps only the immediate alarm context. Easy adds lifecycle progress and exceptional options. Advanced adds direct weekly editing and technical condition details. The Card follows Home Assistant themes; the screenshots above show the tested dark appearance.

## Quick Start

### Requirements

- Home Assistant **2026.8.0 or newer**
- a dashboard managed by Home Assistant if you want the graphical Card or Badge editor
- HACS only when you choose the HACS installation method

### Install with HACS as a custom repository

1. Open **HACS → Integrations**.
2. Open the HACS menu and choose **Custom repositories**.
3. Add `https://github.com/MrCharly169/ClockAdvanced` with category **Integration**.
4. Select **Clock Advanced**, choose the desired release channel, and download it.
5. Restart Home Assistant.

The release workflow publishes one HACS-compatible asset named `clock_advanced.zip`. GitHub's download badge above counts downloads of published GitHub release assets; it is not an installation, active-user or HACS-download count.

### Manual installation

1. Download `clock_advanced.zip` from the desired [GitHub release](https://github.com/MrCharly169/ClockAdvanced/releases).
2. Extract the included `custom_components/clock_advanced` directory to `<config>/custom_components/clock_advanced`.
3. Restart Home Assistant.

Do not rename the integration directory or move the bundled frontend files out of it.

### Add an alarm clock

1. Open **Settings → Devices & services → Integrations**.
2. Select **Add integration** and search for **Clock Advanced**.
3. Complete the setup wizard. Each completed flow creates one independent alarm clock.

### Register the dashboard resource

Register this URL once under **Settings → Dashboards → Resources** as a **JavaScript module**:

```text
/clock_advanced/clock-advanced-card.js
```

The URL is intentionally permanent and has no version query. The integration manifest is the only technical version source. After an update, hard-refresh the browser if it still serves an older Card.

### Add the Card and Badge

For dashboards managed by Home Assistant, choose **Edit dashboard → Add card → Clock Advanced** or **Add badge → Clock Advanced**. YAML-mode dashboards can use the same definitions but do not provide Home Assistant's graphical editor.

Minimal Easy Card:

```yaml
type: custom:clock-advanced-card
entity: sensor.advanced_alarm_clock_status
mode: easy
language: auto
```

Minimal Badge:

```yaml
type: custom:clock-advanced-badge
entity: sensor.advanced_alarm_clock_status
language: auto
```

Use the actual status sensor created for your config entry. The once-only onboarding notification includes both ready-to-copy definitions with the correct entity ID.

## The setup wizard

The wizard follows the customer journey in ten small decisions:

1. **Name** — the room or purpose shown on the device, Card and notifications.
2. **Alarm source** — built-in weekly schedule or an existing Home Assistant Schedule entity.
3. **Schedule** — seven weekdays and alternative times, or the selected `schedule.*` entity.
4. **Conditions and blockers** — Workday, Vacation, wake confirmation and native Home Assistant conditions.
5. **Before and at start** — optional Prepare and Start actions.
6. **Snooze and no response** — cadence, Snooze, escalation, timeout and their actions.
7. **Evening reminder** — optional exact-occurrence reminder and Card path.
8. **Notifications** — recipients and selected lifecycle messages.
9. **Finish and safety** — Dismiss, Timeout and Cleanup actions.
10. **Review** — a final summary and explicit confirmation.

Every section remains editable later through **Settings → Devices & services → Clock Advanced → Configure**. Saving an options section reloads only that config entry. Advanced Card weekday edits use the integration's own service and recalculate without reloading the entry.

## Alarm sources and exact priority

![Clock Advanced time-source priority](docs/images/time-sources.svg)

Clock Advanced resolves the next occurrence in this order:

1. A **future one-time override** in the generated `datetime` entity takes priority.
2. Otherwise, it uses the entry's configured recurring source:
   - the **Clock Advanced weekly schedule**, or
   - one existing **Home Assistant `schedule.*` entity**.

The two recurring sources are alternatives, not stacked priorities. For a Schedule entity, `next_event` is displayed while inactive and each real `off` → `on` block transition starts exactly one alarm. A block already active when Clock Advanced starts is handled once. A future one-time override suppresses Schedule-block starts until that override is no longer pending.

The **Clear override and recalculate** button removes the one-time override, clears Skip next and a stored skipped occurrence, then returns to the recurring source.

## Weekly schedule, Holiday Time and Vacation

The built-in weekly source stores one enabled flag and one time for each weekday. Disabled days stay disabled even when Holiday Time is on.

- **Holiday Time** keeps the clock enabled and replaces normal times with two configurable alternatives: one for Monday–Friday and one for weekends/public holidays. Disabled days remain disabled.
- An optional **Workday sensor** can apply today's non-workday time when it is off. You can instead configure non-workdays as a complete blocker.
- **Vacation** is a blocker. The integration-owned Vacation switch, or an explicitly selected external Vacation entity, prevents preparation and alarm start. Turning Vacation on during an active session dismisses that session and runs the normal finish path.

Holiday Time changes *when* an enabled weekly occurrence happens. Vacation decides that no occurrence may happen.

## Card modes

- **Compact** — time, state and the active alarm context in the smallest layout. It hides the schedule and Options menu.
- **Easy** — the recommended daily view with next-alarm context, Snooze/Dismiss when active, and a closed-by-default Options overlay for Skip next, Holiday Time and Vacation.
- **Advanced** — Easy plus the seven-day schedule, five-minute slider, exact time input, day enable control and technical condition/safety details inside Options.

`easy` is the default. Legacy `auto` and `standard` values render as Easy; legacy `kiosk` renders as Advanced. `language` accepts `auto`, `en` or `de`. The Card is theme-aware, respects reduced-motion preferences, supports Sections grid sizing and uses stable DOM nodes so countdown updates do not intentionally replace controls or request scrolling.

## Clock Advanced Badge

The bundled Badge uses Home Assistant's small native `ha-badge` geometry. The alarm-clock symbol always remains visible; a smaller marker and semantic theme color communicate the current lifecycle state. Its tooltip and accessible name include the state and relevant alarm timing. Mouse, Enter or Space opens the status sensor's normal More info dialog.

## Alarm lifecycle

Eight optional action sequences use Home Assistant's native action editor. Every sequence receives a `clock_advanced` variable containing the public event data.

| Phase | When it runs |
| --- | --- |
| `prepare` | At the configured pre-alarm lead time; a lead time of `0` disables this phase |
| `start` | At the initial alarm start and again after each completed Snooze |
| `repeat` | At the configured cadence while the status remains `ringing` |
| `snooze` | Immediately when Snooze is pressed |
| `escalate` | Once per session after either configured repeat or Snooze threshold |
| `dismiss` | When an active session is dismissed manually, confirmed, disabled or blocked |
| `timeout` | When the complete-session safety limit is reached |
| `cleanup` | After Dismiss or Timeout, as the final shared action sequence |

The integration also fires the versioned `clock_advanced_phase` event for these phases and for `skipped` and `error`. Its public data includes contract version, config-entry ID, clock name, status, phase, next alarm, Repeat/Snooze counts and escalation state. Configured action payloads are not included.

### Repeat, Snooze and Escalate are different

- **Repeat** retriggers its own action on a cadence while ringing and increments only `repeat_count`.
- **Snooze** pauses the ringing session for the configured duration, resets the Repeat count, increments only `snooze_count`, and runs Start again when the pause ends.
- **Escalate** runs at most once in a session. It can be triggered by the Repeat threshold or after the configured number of Snoozes has completed.

### Public states

The status sensor exposes exactly these states:

| State | Meaning |
| --- | --- |
| `idle` | No next alarm is currently available |
| `scheduled` | A next occurrence is armed or exposed |
| `disabled` | The entry's Enabled switch is off |
| `vacation` | Native or external Vacation is active |
| `blocked` | Another configured condition prevents arming |
| `pre_alarm` | Prepare has started before the occurrence |
| `ringing` | The alarm session is actively ringing |
| `snoozed` | The session is waiting for the Snooze period to end |
| `dismissed` | The active session ended through Dismiss or confirmation |
| `skipped` | The selected occurrence was skipped |
| `timeout` | The safety timeout ended the session |
| `error` | An action failed or active-session restoration found invalid state |

`pre_alarm`, `ringing` and `snoozed` are the active-session states. Dismissed, Skipped, Timeout and Error remain visible for the configured terminal-state duration before the schedule is recalculated.

## Conditions and safe shutdown

Conditions are checked before Prepare and again before Start. All native Home Assistant start conditions must pass. The UI supports the condition types provided by Home Assistant's condition selector, including state, numeric state, time, zone, device, template and nested AND/OR/NOT structures.

Additional controls include:

- the entry's Enabled switch;
- an optional Workday sensor and optional complete non-workday block;
- integration-owned or external Vacation;
- a wake-confirmation binary sensor;
- Skip next;
- Snooze and escalation limits;
- the complete-session safety timeout.

If a configured blocker becomes active during `pre_alarm`, `ringing` or `snoozed`, Clock Advanced dismisses the active session and then runs Cleanup. A wake-confirmation sensor turning on also dismisses the session. The safety timeout starts with the alarm session, includes all Snooze periods, survives runtime restoration, and ends with Timeout followed by Cleanup.

Cleanup is a defined finish hook, not a guarantee that every configured device command succeeds. Action failures are logged, exposed as an error phase, and do not replace the calculated recurring schedule.

## Notifications and one-time changes

Lifecycle notifications and the evening reminder are separate options.

For lifecycle notifications, enable the master switch and select any of: Prepare, Start, Repeat, Escalate, Snooze, Dismiss, Timeout, Skipped, Blocked and Error. You can select one or more `notify.*` entities. With no recipient selected, Clock Advanced creates a Home Assistant persistent notification instead. The shipped default event selection is Start, Escalate, Timeout and Blocked when lifecycle notifications are enabled.

The optional evening reminder announces tomorrow's exact occurrence at the configured time and uses the same recipient list. Native mobile Notify recipients receive actions to:

- skip that exact occurrence;
- replace only its time with an `HH:MM` reply;
- open the configured Clock Card path.

The occurrence timestamp is part of each action token, so an action from an older notification cannot change a newer alarm. A one-time change leaves the weekly schedule unchanged. With no recipient selected, the reminder is delivered to Home Assistant's notification inbox with a Clock link.

## Updates and removal

### Update

1. Review the [Changelog](CHANGELOG.md), especially beta notes and migration impact.
2. Install the desired release through HACS, or replace the manual `custom_components/clock_advanced` directory with the matching release asset.
3. Restart Home Assistant.
4. Hard-refresh the browser if the permanent Card resource is still cached.

Config-entry migrations run when required; do not edit stored Home Assistant config-entry data by hand.

### Remove

1. Remove each Clock Advanced integration entry under **Settings → Devices & services**.
2. Remove its Card and Badge definitions from dashboards.
3. When no Clock Advanced entries remain, remove the shared dashboard resource.
4. Uninstall the HACS repository, or delete `<config>/custom_components/clock_advanced` for a manual installation.
5. Restart Home Assistant.

Deleting an entry also removes its entities from active use. Export any schedule or action setup you want to keep before removal.

## Privacy and local processing

Clock Advanced is declared as a calculated Home Assistant integration and has no Python package requirements or Clock Advanced cloud service. Scheduling, persisted runtime state, condition evaluation and action dispatch happen inside your Home Assistant instance.

Your own actions and selected Notify entities may communicate with external services according to those Home Assistant integrations. Clock Advanced does not make those integrations local.

Downloaded diagnostics redact configured action sequences, native conditions, notification targets and linked Workday, Vacation, confirmation and legacy allow/block entity references. Diagnostics still contain operational status, timing and the public weekly schedule, so review every diagnostic file before sharing it.

## FAQ

### Is this a Helper?

No. Clock Advanced is a normal integration under **Devices & services**. It can use an existing Home Assistant Schedule Helper as a source, but it does not become that Helper.

### Do I need one config entry per room or person?

Yes. One config entry owns exactly one clock device and lifecycle. Add another entry for an independently scheduled clock.

### Do actions have to be configured?

No. All eight action sequences are optional. An empty sequence still leaves the schedule, state, Card and controls available.

### Where do I edit an external Schedule source?

Edit it in Home Assistant's native Schedule UI. Clock Advanced shows its `next_event` and responds to new active blocks; the Advanced Card does not edit that external schedule.

### Why is Snooze unavailable?

Snooze is available only while `ringing`, when Maximum snoozes is greater than zero and the configured maximum has not been reached.

### Does Cleanup run after Skip next?

No. A skipped occurrence never becomes an active session. Cleanup follows Dismiss or Timeout. A blocker, Vacation or disabling the clock during an active session uses the Dismiss path and therefore reaches Cleanup.

### How do I remove a one-time alarm?

Press **Clear override and recalculate**. This returns the clock to its recurring source and also clears Skip next and the stored skipped occurrence.

## Troubleshooting and support

### The Card says the clock is unavailable

- Confirm `/clock_advanced/clock-advanced-card.js` is registered once as a JavaScript module.
- Confirm the Card references this entry's enum status sensor.
- Hard-refresh the browser after updating.
- Check the browser console and Home Assistant log for a resource-loading error.

### No alarm is scheduled

- Check Enabled, Vacation, Skip next and the selected conditions.
- For the weekly source, verify that at least one future weekday is enabled.
- For a Schedule source, verify its `next_event` and wait for a real `off` → `on` transition.
- Check whether a future one-time override is intentionally taking priority.

### An alarm did not start or ended immediately

- Review the status sensor's `last_reason` and `last_error` attributes.
- Verify Workday, Vacation, wake confirmation and every native start condition.
- Remember that a blocker becoming active during a session dismisses it deliberately.

For reproducible bugs, use the [bug report form](https://github.com/MrCharly169/ClockAdvanced/issues/new?template=bug_report.yml). For ideas, use the [feature request form](https://github.com/MrCharly169/ClockAdvanced/issues/new?template=feature_request.yml). Do not include credentials, private notification targets or sensitive diagnostics. Security reports belong in [SECURITY.md](SECURITY.md). Contributions are described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Open source, license and support

Clock Advanced is open source under the [MIT License](LICENSE). Private and commercial use are permitted subject to the license, including its copyright and permission-notice requirements and warranty disclaimer. There is no separate commercial license or license fee.

Testing beta releases, reporting reproducible issues, improving compatibility, translating and refining documentation are all valuable voluntary support. They help sustain development, tests, compatibility work and documentation. No verified Buy Me a Coffee or sponsor URL is currently published in this repository, so this page intentionally contains no donation badge or invented link.

## Migration

When replacing an existing alarm automation, create the Clock Advanced entry with empty physical-output actions first. Verify schedule, Holiday Time, Vacation, conditions, Snooze and timeout behavior, then move actions one phase at a time. Disable the old automation only after the new clock passes a complete test cycle.

See the [migration guide](docs/MIGRATION.md), the neutral [occupancy/music/Snooze example](examples/occupancy_music_snooze.yaml) and the detailed [HAUS1-ET1 migration profile](examples/haus1_et1_migration.yaml). The example profile contains migration-specific entity IDs; none are hard-coded into the integration.

## Developer details

The compatibility and behavior contracts are documented in [BASELINE.md](docs/BASELINE.md) and [REGRESSION_MATRIX.md](docs/REGRESSION_MATRIX.md). Development-lab instructions are in [DEVELOPMENT.md](docs/DEVELOPMENT.md).

Run the repository checks from the root:

```powershell
python -m unittest discover -s tests -v
python scripts/check_source_syntax.py
node tests/test_card_runtime.js
python scripts/build_release.py --check
```

The canonical frontend is `custom_components/clock_advanced/frontend/clock-advanced-card.js`; the permanent resource is `/clock_advanced/clock-advanced-card.js`; and `custom_components/clock_advanced/manifest.json` is the only technical version source.
