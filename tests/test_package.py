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
        self.assertIn("type: custom:clock-advanced-badge", init)
        self.assertIn("async_mark_card_notification_sent", runtime)
        self.assertIn("schedule_event_token", runtime)
        self.assertIn("async_recalculate_schedule", runtime)
        self.assertIn('"badge_yaml"', sensor)
        self.assertIn("<ha-form>", frontend)
        self.assertIn("<ha-badge", frontend)
        self.assertIn('class="clock-symbol" icon="mdi:alarm"', frontend)
        self.assertIn('class="state-marker"', frontend)
        self.assertIn('data-mode="${esc(details.mode)}"', frontend)
        self.assertIn("_lastRenderSignature", frontend)
        self.assertIn('new CustomEvent("hass-more-info"', frontend)
        self.assertIn('mode: "easy"', frontend)
        self.assertIn("mode: storage", dev_config)
        self.assertNotIn("mode: yaml", dev_config)

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


if __name__ == "__main__":
    unittest.main()
