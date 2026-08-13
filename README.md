# Clock Advanced

<p align="center">
  <img src="custom_components/clock_advanced/brand/logo@2x.png" alt="Clock Advanced" width="420">
</p>

Clock Advanced is a generic Home Assistant alarm-clock integration with a bundled responsive dashboard Card. One config entry represents one independent clock device. Times, guards and actions are configured through the UI; no entity IDs or device behavior are hard-coded.

Deutsch: Clock Advanced ist eine generische Home-Assistant-Weckerintegration mit einer gebündelten responsiven Dashboard-Karte. Ein Konfigurationseintrag entspricht einem eigenständigen Weckergerät. Zeiten, Bedingungen und Aktionen werden vollständig über die Oberfläche eingerichtet; es sind keine installationsspezifischen Entitäten fest eingebaut.

## Core contract / Kernvertrag

- seven independently enabled weekdays / sieben einzeln aktivierbare Wochentage
- distinct Holiday-time and Vacation behavior / getrennte Ferienzeit- und Urlaubslogik
- one-time alarm through a standard `datetime` entity / einmaliger Wecker über eine Standard-`datetime`-Entität
- states `scheduled`, `pre_alarm`, `ringing`, `snoozed`, `dismissed`, `skipped`, `timeout`, and guarded states
- true snooze separate from repeating actions / echtes Schlummern getrennt von Wiederholungsaktionen
- configurable safety timeout across the complete session / konfigurierbare Sicherheitsabschaltung für den gesamten Weckvorgang
- restart-safe runtime and privacy-aware diagnostics / neustartfester Zustand und datensparsame Diagnose
- one versioned `clock_advanced_phase` event and eight optional action sequences
- bilingual English/German setup, options, entity names and Card

## Guided setup / Geführte Einrichtung

The UI wizard deliberately walks through ten small, customer-oriented decisions: name, alarm source, schedule, conditions, preparation/start, alarm response, evening reminder, notifications, finish/safety, and a final review. Every setting remains editable later from the integration options, grouped by the same situations.

Clock Advanced ist eine normale Integration unter **Einstellungen → Geräte & Dienste → Integrationen** – kein Helper. Der UI-Assistent führt in zehn kurzen, kundenorientierten Schritten durch Name, Weckzeit-Quelle, Zeitplan, Bedingungen, Vorbereitung/Start, Reaktion/Schlummern, Vorabend-Erinnerung, Meldungen, Abschluss/Sicherheit und eine abschließende Prüfung. Dieselben Bereiche bleiben danach über **Konfigurieren** änderbar.

### Alarm sources / Weckzeit-Quellen

- **Weekly schedule / Wochenplan:** Clock Advanced stores one enabled time per weekday. This is the simple, self-contained default.
- **Home Assistant schedule entity / Zeitplan-Entität (optional):** Select an existing UI-managed `schedule.*` entity as an external source. The displayed next alarm comes from its `next_event`; every new active block starts exactly one alarm. Clock Advanced itself remains a normal integration and does not create a Helper.
- **One-time override / Einmalige Abweichung:** The generated `datetime` entity temporarily takes priority over either source.

### Conditions / Bedingungen

Conditions are checked before preparation and alarm start, and an active alarm is dismissed safely when a blocker becomes active:

- optional workday sensor and optional blocking on non-workdays
- vacation/absence entity
- wake-confirmation sensor for automatic completion
- native Home Assistant start conditions, including numeric state, state, time, zone, device, template and nested AND/OR/NOT logic
- numeric occupancy example: select **Numeric state**, entity `zone.home`, and **Above** `1`; because the comparison is strict, the alarm starts only when at least two persons are home
- manual skip-next, holiday mode, enabled switch, maximum snoozes, escalation threshold, and safety timeout

Die Bedingungen werden vor Vorbereitung und Weckstart geprüft. Wird während eines laufenden Weckers eine Sperre aktiv, beendet Clock Advanced die Session sicher. Damit lassen sich unter anderem Anwesenheit, Ruhemodus, Arbeitstag, Ferien, Feiertage oder beliebige andere HA-Zustände ohne fest eingebaute Entitätsnamen kombinieren.

**Holiday time / Ferienzeit** and **Vacation / Urlaub** are deliberately different. Holiday time keeps the clock enabled and applies the alternative, usually later time from its schedule. Vacation is a true blocker that disables preparation and alarm output completely. Both controls remain independent.

## Action phases / Aktionsphasen

Each optional phase uses the native Home Assistant action editor and receives a `clock_advanced` variable containing the public event data.

Jede optionale Phase verwendet den normalen Home-Assistant-Aktionseditor und erhält die Variable `clock_advanced` mit den öffentlichen Ereignisdaten.

| Phase | Purpose / Zweck |
| --- | --- |
| `prepare` | light sunrise, pre-heating, gentle preparation / Licht-Sonnenaufgang, Vorbereitung |
| `start` | initial output and output after every completed snooze / erster Weckimpuls und erneut nach jedem abgelaufenen Schlummern |
| `repeat` | cadence while ringing / Wiederholung während des Klingelns |
| `escalate` | one-time stronger output after N repeats or N snoozes / einmalige Eskalation nach N Wiederholungen oder N Schlummern |
| `snooze` | pause or lower outputs / Ausgaben pausieren oder reduzieren |
| `dismiss` | confirmed or manual finish / bestätigtes oder manuelles Ende |
| `timeout` | emergency or inactivity notification / Notfall- oder Inaktivitätsmeldung |
| `cleanup` | always turn off media and lights / Medien und Licht zuverlässig ausschalten |

The integration also fires `clock_advanced_phase` for every phase, including `skipped` and `error`. Event data includes `contract_version`, `config_entry_id`, `name`, `status`, `phase`, `next_alarm`, repeat/snooze counts and escalation state.

## Notifications / Benachrichtigungen

The setup wizard separates the evening-before reminder from alarm lifecycle messages. The optional reminder announces tomorrow's exact alarm and can open the configured Card path. Native mobile `notify.*` recipients also get actions to skip that exact occurrence or replace only its time through an `HH:MM` reply. Actions from an older notification are ignored. If no recipient is selected, Home Assistant's notification inbox receives a direct Clock link instead. Lifecycle notifications remain independently selectable.

Der Einrichtungsassistent trennt die Vorabend-Erinnerung von den Meldungen während des Weckablaufs. Die optionale Erinnerung nennt den exakten Wecker für morgen und öffnet den eingestellten Pfad zur Clock-Card. Native mobile `notify.*`-Empfänger erhalten zusätzlich **Auslassen** und **Zeit ändern**; die Texteingabe `HH:MM` ändert nur diesen einen Termin. Veraltete Aktionen werden ignoriert. Ohne Empfänger erscheint die Erinnerung mit direktem Clock-Link im Home-Assistant-Benachrichtigungseingang.

### Example: music, snooze, escalation, motion / Beispiel: Musik, Snooze, Eskalation, Bewegung

In **Alarm lifecycle / Weckablauf**, set Snooze duration to `10`, maximum snoozes to at least `3`, Escalate after snoozes to `3`, and Escalate after repeats to `0` if only snoozes should trigger escalation. In **Action phases / Aktionsphasen**:

- **Start:** call `media_player.play_media` for the first speaker. Clock Advanced runs this sequence initially and after every ten-minute snooze.
- **Snooze:** call `media_player.media_pause` or `media_player.media_stop` for the first speaker.
- **Escalate:** call `media_player.play_media` for the second speaker. It runs once when the third snooze period ends.
- **Cleanup:** stop both speakers.

Select the room's motion `binary_sensor` as **Wake-up confirmation / Aufsteh-Bestätigung**. A detected motion (`on`) while ringing or snoozed dismisses the alarm and runs Dismiss followed by Cleanup.

## Installation / Installation

Requires Home Assistant 2026.8.0 or newer.

1. Add this repository to HACS as a custom **Integration** repository and install Clock Advanced.
2. Restart Home Assistant.
3. Add **Clock Advanced** under **Settings → Devices & services**.
4. Add `/clock_advanced/clock-advanced-card.js` once as a JavaScript module under dashboard resources.
5. Finish the setup flow. Clock Advanced sends one persistent notification containing the exact Card and Badge configuration for the new alarm clock.
6. In a Home Assistant-managed dashboard choose **Edit dashboard → Add card/Badge → Clock Advanced**. Both graphical editors use native Home Assistant selectors. YAML-mode dashboards intentionally do not provide Home Assistant's visual editor.

```yaml
type: custom:clock-advanced-card
entity: sensor.advanced_alarm_clock_status
mode: easy
language: auto
```

For a compact room header, add the bundled custom badge:

```yaml
type: custom:clock-advanced-badge
entity: sensor.advanced_alarm_clock_status
language: auto
```

Das Badge verwendet direkt das native kleine, runde Home-Assistant-Element `ha-badge` und folgt derselben Logik wie der aktuelle SmartShading-Badge: Das große Weckersymbol bleibt als eindeutige Clock-Advanced-Kennung immer erhalten. Eine kleine Zusatzmarkierung und die semantische HA-Themefarbe zeigen Geplant, Voralarm, Wecken, Schlummern, Urlaub, Blockiert, Deaktiviert, Übersprungen, Beendet oder Fehler. Tooltip und Barrierefreiheitsname enthalten Status und den zeitlich passenden Alarmkontext. Maus, Enter oder Leertaste öffnen den normalen Home-Assistant-Mehr-Info-Dialog.

The resource URL is permanent and deliberately has no version query. The manifest is the only technical version source.

Die Ressourcen-URL ist dauerhaft und besitzt bewusst keinen Versionsparameter. Das Manifest ist die einzige technische Versionsquelle.

## Card modes / Card-Modi

- `compact`: time, state and active alarm actions / Uhrzeit, Status und aktive Weckaktionen
- `easy`: recommended daily view with lifecycle and essential controls / empfohlene Alltagsansicht mit Ablauf und wesentlichen Bedienelementen
- `advanced`: complete weekly schedule, conditions and safety details / vollständiger Wochenplan, Bedingungen und Sicherheitsdetails

`easy` is the default. Legacy `auto`/`standard` configurations are shown as Easy and legacy `kiosk` as Advanced. `language` accepts `auto`, `en`, or `de`. The Card is theme-aware, uses semantic state colors, respects reduced-motion preferences, supports the native graphical editor, Sections grid sizing, and Home Assistant's entity suggestion API.

Card and Badge build their runtime Shadow DOM exactly once. Normal Home Assistant updates patch only visible text, semantic classes, attributes, button states, visibility and progress widths; the one-second timer changes only the existing countdown node's `textContent`. Interactive roots are not replaced, so focus and open details survive entity updates and the components never request page scrolling.

The Card header includes a fixed-size animated alarm-clock logo whose motion follows the current lifecycle state—from a quiet scheduled pulse to ringing, snoozed, vacation, completion, and warning animations. It never changes the Card geometry, retains its DOM identity during updates, and becomes static when the device requests reduced motion.

Advanced mode also edits the built-in weekly schedule directly: select a weekday, drag the five-minute time slider, refine the value in the time field, and enable or disable that day. Saving calls the integration's own schedule service and recalculates without an integration reload. The bottom Vacation button controls the integration-owned Vacation mode by default; when an external vacation entity was explicitly configured, the same button controls that shared entity instead.

## Entities / Entitäten

Every clock creates:

- enum sensor: public status and Card contract
- binary sensor: active alarm session
- datetime: one-time next alarm
- switches: enabled, skip next, holiday mode, vacation mode
- buttons: snooze, dismiss, recalculate

## Migration from the original automation

The personal HAUS1-ET1 behavior is provided as a migration profile in [examples/haus1_et1_migration.yaml](examples/haus1_et1_migration.yaml). Copy the relevant actions into the matching UI phases, test the new clock in parallel without physical outputs, then disable the old automation only after every regression case passes.

Der persönliche HAUS1-ET1-Ablauf liegt als Migrationsprofil in [examples/haus1_et1_migration.yaml](examples/haus1_et1_migration.yaml). Übernimm die benötigten Aktionen in die passenden UI-Phasen, teste den neuen Wecker zunächst ohne physische Ausgaben parallel und deaktiviere die alte Automation erst nach erfolgreicher Regression.

## Development / Entwicklung

```powershell
python -m unittest discover -s tests -v
python scripts/check_source_syntax.py
node tests/test_card_runtime.js
python scripts/build_release.py --check
```

The compatibility baseline and required regression coverage live in [docs/BASELINE.md](docs/BASELINE.md) and [docs/REGRESSION_MATRIX.md](docs/REGRESSION_MATRIX.md).
