"""Repository contract tests that do not require Home Assistant."""

import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
COMPONENT = ROOT / "custom_components" / "clock_advanced"


class PackageTests(unittest.TestCase):
    def test_manifest_and_hacs_baseline_match(self) -> None:
        manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
        hacs = json.loads((ROOT / "hacs.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["domain"], "clock_advanced")
        self.assertTrue(manifest["version"].startswith("2026.8."))
        self.assertEqual(manifest["integration_type"], "hub")
        self.assertEqual(hacs["homeassistant"], "2026.8.0")
        self.assertTrue(hacs["hide_default_branch"])

    def test_card_contract_and_resource_are_permanent(self) -> None:
        init = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        sensor = (COMPONENT / "sensor.py").read_text(encoding="utf-8")
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("StaticPathConfig", init)
        self.assertIn("CARD_CONTRACT_VERSION", sensor)
        self.assertIn("/clock_advanced/clock-advanced-card.js", readme)
        self.assertNotIn("/clock_advanced/clock-advanced-card.js?v=", readme)

    def test_legacy_resource_is_only_a_loader(self) -> None:
        legacy = (COMPONENT / "frontend" / "clock-advanced.js").read_text(encoding="utf-8")
        self.assertEqual(legacy.strip(), 'import "./clock-advanced-card.js";')

    def test_brand_and_badge_assets_are_packaged(self) -> None:
        frontend = (COMPONENT / "frontend" / "clock-advanced-card.js").read_text(
            encoding="utf-8"
        )
        for name in (
            "icon.png",
            "icon@2x.png",
            "dark_icon.png",
            "dark_icon@2x.png",
            "logo.png",
            "logo@2x.png",
            "dark_logo.png",
            "dark_logo@2x.png",
        ):
            self.assertGreater((COMPONENT / "brand" / name).stat().st_size, 1000)
        self.assertIn("customElements.define(BADGE_TAG", frontend)
        self.assertIn("window.customBadges", frontend)
        self.assertIn("type: BADGE_TAG", frontend)

    def test_native_dashboard_onboarding_contract(self) -> None:
        init = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        runtime = (COMPONENT / "runtime.py").read_text(encoding="utf-8")
        sensor = (COMPONENT / "sensor.py").read_text(encoding="utf-8")
        frontend = (COMPONENT / "frontend" / "clock-advanced-card.js").read_text(
            encoding="utf-8"
        )
        dev_config = (ROOT / "dev" / "configuration.yaml").read_text(
            encoding="utf-8"
        )
        self.assertIn("card_notification_sent", init)
        self.assertIn("mode: easy", init)
        self.assertIn('"type: custom:clock-advanced-badge\\n"', init)
        self.assertIn('STATUS_RINGING: "mdi:bell-ring"', sensor)
        self.assertIn("async_mark_card_notification_sent", runtime)
        self.assertIn("schedule_event_token", runtime)
        self.assertIn("async_recalculate_schedule", runtime)
        self.assertIn('"badge_yaml"', sensor)
        self.assertIn("<ha-form>", frontend)
        self.assertIn("<ha-badge", frontend)
        self.assertIn('class="clock-symbol" icon="mdi:alarm"', frontend)
        self.assertIn('class="state-marker"', frontend)
        self.assertIn('class="next-time"', frontend)
        self.assertIn('markerContainer.hidden = Boolean(nextRun.short)', frontend)
        self.assertIn("badge.dataset.mode = mode", frontend)
        self.assertIn("_lastRenderSignature", frontend)
        self.assertIn('new CustomEvent("hass-action"', frontend)
        self.assertIn('tap_action: { action: "more-info" }', frontend)
        self.assertIn('mode: "easy"', frontend)
        self.assertIn("mode: storage", dev_config)
        self.assertNotIn("mode: yaml", dev_config)

    def test_card_and_badge_use_stable_runtime_dom(self) -> None:
        frontend = (COMPONENT / "frontend" / "clock-advanced-card.js").read_text(
            encoding="utf-8"
        )
        card = frontend.split("class ClockAdvancedCard extends", 1)[1].split(
            "class ClockAdvancedCardEditor extends", 1
        )[0]
        badge = frontend.split("class ClockAdvancedBadge extends", 1)[1].split(
            "class ClockAdvancedBadgeEditor extends", 1
        )[0]
        self.assertEqual(card.count("shadowRoot.innerHTML"), 1)
        self.assertEqual(badge.count("shadowRoot.innerHTML"), 1)
        self.assertIn("_ensureStructure()", card)
        self.assertIn("_patch()", card)
        self.assertIn("_ensureStructure()", badge)
        self.assertIn("_patch()", badge)
        for forbidden in ("scrollIntoView", "scrollTo(", "window.scroll", ".focus("):
            self.assertNotIn(forbidden, card)
            self.assertNotIn(forbidden, badge)

    def test_localizations_have_matching_top_level_surfaces(self) -> None:
        en = json.loads((COMPONENT / "translations" / "en.json").read_text(encoding="utf-8"))
        de = json.loads((COMPONENT / "translations" / "de.json").read_text(encoding="utf-8"))
        self.assertEqual(set(en), set(de))
        self.assertEqual(set(en["config"]["step"]), set(de["config"]["step"]))
        self.assertEqual(set(en["entity"]), set(de["entity"]))

    def test_diagnostics_redact_actions_and_links(self) -> None:
        diagnostics = (COMPONENT / "diagnostics.py").read_text(encoding="utf-8")
        self.assertIn("ACTION_PHASES", diagnostics)
        self.assertIn("CONF_VACATION_ENTITY", diagnostics)
        self.assertNotIn('"actions": runtime.config', diagnostics)

    def test_native_conditions_and_snooze_escalation_are_shipped(self) -> None:
        config_flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        runtime = (COMPONENT / "runtime.py").read_text(encoding="utf-8")
        diagnostics = (COMPONENT / "diagnostics.py").read_text(encoding="utf-8")
        self.assertIn("selector.ConditionSelector()", config_flow)
        self.assertIn("async_validate_conditions_config", runtime)
        self.assertIn("CONF_ESCALATE_AFTER_SNOOZES", runtime)
        self.assertIn("CONF_START_CONDITIONS", diagnostics)

    def test_setup_wizard_and_sectioned_options_are_shipped(self) -> None:
        config_flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        self.assertIn("class ClockAdvancedConfigFlow", config_flow)
        self.assertIn("class ClockAdvancedOptionsFlow", config_flow)
        self.assertIn("OptionsFlowWithReload", config_flow)
        self.assertIn("async_show_menu", config_flow)
        self.assertIn("CONF_NAME, CONF_SCHEDULE_SOURCE", config_flow)
        self.assertIn("async_update_entry", config_flow)
        self.assertIn("async_step_notifications", config_flow)
        self.assertIn("CONF_NOTIFICATION_TARGETS", config_flow)

    def test_options_can_clear_values_from_original_entry_data(self) -> None:
        config_flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        self.assertIn("entry_data = dict(self.config_entry.data)", config_flow)
        self.assertIn("entry_data.pop(key, None)", config_flow)
        self.assertIn("self.config_entry, data=entry_data", config_flow)
        self.assertNotIn("data[key] = None", config_flow)
        self.assertLess(
            config_flow.index("entry_data.pop(key, None)"),
            config_flow.index("data.update(values)"),
        )

    def test_customer_notification_controls_and_reasons_are_shipped(self) -> None:
        config_flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        runtime = (COMPONENT / "runtime.py").read_text(encoding="utf-8")
        diagnostics = (COMPONENT / "diagnostics.py").read_text(encoding="utf-8")
        for token in (
            "CONF_NOTIFICATIONS_ENABLED",
            "CONF_NOTIFICATION_TARGETS",
            "CONF_NOTIFICATION_EVENTS",
            "CONF_NOTIFICATION_BACK_PATH",
            "CONF_REMINDER_DASHBOARD_PATH",
            "notification_event",
        ):
            self.assertIn(token, config_flow)
        self.assertIn('"persistent_notification"', runtime)
        self.assertIn('"send_message"', runtime)
        self.assertIn("_notification_content", runtime)
        self.assertIn('self._launch_notification("blocked"', runtime)
        self.assertIn("CONF_NOTIFICATION_TARGETS", diagnostics)
        for field in ('"url": path', '"clickAction": path', '"action": "URI"', '"uri": path'):
            self.assertIn(field, runtime)
        self.assertIn("_dashboard_back_path", runtime)
        self.assertIn("CONF_NOTIFICATION_BACK_PATH", diagnostics)

    def test_actionable_evening_reminder_is_occurrence_safe(self) -> None:
        config_flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        runtime = (COMPONENT / "runtime.py").read_text(encoding="utf-8")
        translations = (COMPONENT / "translations" / "de.json").read_text(
            encoding="utf-8"
        )
        for token in (
            "CONF_REMINDER_ENABLED",
            "CONF_REMINDER_TIME",
            "CONF_REMINDER_DASHBOARD_PATH",
            "async_step_reminder",
        ):
            self.assertIn(token, config_flow)
        self.assertIn("EVENT_NOTIFICATION_ACTION", runtime)
        self.assertIn("CLOCK_ADVANCED:{self.entry.entry_id}:SKIP", runtime)
        self.assertIn("CLOCK_ADVANCED:{self.entry.entry_id}:CHANGE", runtime)
        self.assertIn('"behavior": "textInput"', runtime)
        self.assertIn('"action": "URI"', runtime)
        self.assertIn("int(current.timestamp()) != token", runtime)
        self.assertIn("_mobile_app_notify_service", runtime)
        self.assertIn('service = f"mobile_app_{slugify(name)}"', runtime)
        self.assertIn("falling back to notify entity", runtime)
        self.assertIn('"send_message"', runtime)
        self.assertIn("Passing mobile-app data rejects the whole call", runtime)
        self.assertIn("Empfängerauswahl im nächsten Schritt aktiviert", translations)
        self.assertIn("Ferienzeit verschiebt die Uhrzeit", translations)
        self.assertIn('"holiday_mode": { "name": "Ferienzeit" }', translations)

    def test_dismiss_and_confirmation_await_the_same_cleanup_path(self) -> None:
        runtime = (COMPONENT / "runtime.py").read_text(encoding="utf-8")
        dismiss_start = runtime.index("    async def async_dismiss(")
        dismiss_end = runtime.index("    async def _async_terminal_actions(", dismiss_start)
        dismiss = runtime[dismiss_start:dismiss_end]
        state_change_start = runtime.index("    def _handle_state_change(")
        state_change_end = runtime.index(
            "    def _handle_pre_alarm_due(", state_change_start
        )
        state_change = runtime[state_change_start:state_change_end]
        terminal_start = runtime.index("    async def _async_terminal_actions(")
        terminal_end = runtime.index("    @callback", terminal_start)
        terminal = runtime[terminal_start:terminal_end]

        self.assertIn("await self._async_terminal_actions(phase, reason)", dismiss)
        self.assertNotIn("async_create_task(self._async_terminal_actions", dismiss)
        self.assertGreaterEqual(dismiss.count("self.state.last_reason = reason"), 2)
        self.assertIn('self.async_dismiss("confirmation")', state_change)
        self.assertIn("context=context or Context()", runtime)
        self.assertIn("static_validated = cv.SCRIPT_SCHEMA", runtime)
        self.assertLess(
            terminal.index("await self._async_run_phase(phase"),
            terminal.index("PHASE_CLEANUP, context=action_context"),
        )

    def test_card_weekday_editor_and_native_vacation_are_shipped(self) -> None:
        init = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        config_flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        runtime = (COMPONENT / "runtime.py").read_text(encoding="utf-8")
        switch = (COMPONENT / "switch.py").read_text(encoding="utf-8")
        sensor = (COMPONENT / "sensor.py").read_text(encoding="utf-8")
        frontend = (COMPONENT / "frontend" / "clock-advanced-card.js").read_text(
            encoding="utf-8"
        )
        services = (COMPONENT / "services.yaml").read_text(encoding="utf-8")
        self.assertIn("SERVICE_SET_WEEKDAY_ALARM", init)
        self.assertIn("SERVICE_SET_HOLIDAY_TIME", init)
        self.assertIn("async_update_entry", init)
        self.assertIn("await runtime.async_refresh_schedule()", init)
        self.assertIn("set_weekday_alarm:", services)
        self.assertIn("set_holiday_time:", services)
        self.assertIn("async_set_holiday_time", init)
        self.assertIn("async_set_vacation_mode", runtime)
        self.assertIn('"vacation_mode"', switch)
        self.assertIn('"vacation_mode": self._entity', sensor)
        self.assertIn('data-schedule-slider type="range"', frontend)
        self.assertIn('data-schedule-time type="time"', frontend)
        self.assertIn('data-action="toggle-vacation"', frontend)
        self.assertIn('"holiday_time": self.runtime.schedule.holiday_time.isoformat()', sensor)
        self.assertIn('"holiday_weekend_time": (', sensor)
        self.assertIn("CONF_HOLIDAY_WEEKEND_TIME", runtime)
        self.assertIn("version=6", init)
        self.assertIn("VERSION = 6", config_flow)


if __name__ == "__main__":
    unittest.main()
