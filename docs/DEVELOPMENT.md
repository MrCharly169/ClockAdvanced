# Development

Use a disposable Home Assistant 2026.8.x test instance. Never develop or run lifecycle tests against a production clock, speaker, light or notification route.

On Windows with Docker Desktop and WSL 2, the repository includes a persistent disposable lab:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 start
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 logs
```

Open `http://127.0.0.1:18124`, create the disposable owner, then add Clock Advanced under **Settings → Devices & services**. The port is bound to loopback only. After onboarding, the trusted-container-network provider bypasses repeated lab logins while the normal Home Assistant provider remains available. Integration and frontend sources are mounted read-only. Runtime state stays below the ignored `.dev/ha-config` directory. Use `restart`, `status`, or `stop` as the command when needed. `HA_DEV_PORT` and `HA_DEV_IMAGE` override the defaults for one session.

The lab uses Home Assistant storage mode, so **Edit dashboard** and the graphical Card/Badge editors remain available. `scripts/seed_ha_lab.mjs` registers the permanent frontend resource, saves `dev/lovelace-storage.json` through Home Assistant's WebSocket API, and creates the editable storage-backed `schedule.clock_advanced_lab` helper. After onboarding or after recreating the lab, seed it with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 seed
```

Its **Clock Lab** view renders the native Badge, a weekly Advanced card, a Schedule-entity Easy card, and native controls. The **Card modes** view contains only Compact, Easy, and Advanced. **Render stability** places Card and Badge together in a deliberately tall, scrollable Sections view for `scrollTop`, focus, countdown and DOM-identity checks. Run the non-destructive live checks with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 smoke
```

The smoke test validates the full HA configuration, the public Card contract, every referenced control entity, the served Card and Badge module, local brand delivery, vacation handling, native state/NOT/numeric conditions, and the enabled switch. It restores every lab entity it changes. Alarm start, repeat/escalation, snooze, dismiss, confirmation, and skip remain deliberate lifecycle tests because they wait on real scheduler events. For Schedule-entity lifecycle testing, use a one-minute block and verify that only the real `off` → `on` edge starts an alarm.

The repository provides the destructive-to-lab-only lifecycle check below. It temporarily activates the editable Schedule entity, verifies `ringing` and `snoozed`, dismisses the alarm, and restores the original schedule and guard states:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 schedule-test
```

For frontend changes, hard-refresh after loading `/clock_advanced/clock-advanced-card.js`. Python, manifest and translation changes require an integration reload or Home Assistant restart.

Run from the repository root:

```bash
python -m unittest discover -s tests -v
python scripts/check_source_syntax.py
node tests/test_card_runtime.js
python scripts/build_release.py --check
```

Sources of truth:

- version: `custom_components/clock_advanced/manifest.json`
- development changes: `CHANGELOG.md → Unreleased`
- frontend: `custom_components/clock_advanced/frontend/clock-advanced-card.js`
- resource: `/clock_advanced/clock-advanced-card.js`

Suggested branches: `main` for reviewed releases, `develop` for integration, and focused `feature/<topic>` or `fix/<topic>` branches.
