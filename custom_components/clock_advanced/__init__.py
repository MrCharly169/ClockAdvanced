"""Clock Advanced integration and bundled frontend delivery."""

from __future__ import annotations

from pathlib import Path

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later

from .const import (
    CARD_RESOURCE,
    CONF_ALLOW_STATE,
    CONF_BLOCK_NON_WORKDAYS,
    CONF_BLOCK_STATE,
    CONF_ESCALATE_AFTER_SNOOZES,
    CONF_HOLIDAY_TIME,
    CONF_HOLIDAY_WEEKEND_TIME,
    CONF_NON_WORKDAY_TIME,
    CONF_SCHEDULE_SOURCE,
    CONF_START_CONDITIONS,
    DEFAULT_ALLOW_STATE,
    DEFAULT_BLOCK_STATE,
    DEFAULT_ESCALATE_AFTER_SNOOZES,
    DEFAULT_HOLIDAY_WEEKEND_TIME,
    DEFAULT_SCHEDULE_SOURCE,
    DOMAIN,
    PLATFORMS,
    SERVICE_SET_HOLIDAY_TIME,
    SERVICE_SET_WEEKDAY_ALARM,
    SCHEDULE_SOURCE_WEEKLY,
    WEEKDAYS,
    day_enabled_key,
    day_time_key,
)
from .runtime import ClockRuntime

type ClockAdvancedConfigEntry = ConfigEntry[ClockRuntime]


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register the permanent card resource once."""
    key = f"{DOMAIN}_frontend_registered"
    if not hass.data.get(key):
        frontend = Path(__file__).parent / "frontend"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(f"/{DOMAIN}", str(frontend), False)]
        )
        hass.data[key] = True
    service_key = f"{DOMAIN}_services_registered"
    if not hass.data.get(service_key):

        def editable_clock(entity_id: str) -> tuple[ConfigEntry, ClockRuntime]:
            """Resolve one loaded Clock Advanced entry using any of its entities."""
            registry_entry = er.async_get(hass).async_get(entity_id)
            if (
                registry_entry is None
                or registry_entry.platform != DOMAIN
                or not registry_entry.config_entry_id
            ):
                raise HomeAssistantError(
                    f"{entity_id} is not a Clock Advanced entity"
                )
            entry = hass.config_entries.async_get_entry(
                registry_entry.config_entry_id
            )
            if entry is None or entry.domain != DOMAIN or entry.runtime_data is None:
                raise HomeAssistantError("Clock Advanced entry is not loaded")
            runtime = entry.runtime_data
            if (
                runtime.config.get(CONF_SCHEDULE_SOURCE, DEFAULT_SCHEDULE_SOURCE)
                != SCHEDULE_SOURCE_WEEKLY
            ):
                raise HomeAssistantError(
                    "Schedule times can only be edited for the internal weekly schedule"
                )
            return entry, runtime

        async def async_set_weekday_alarm(call: ServiceCall) -> None:
            """Persist one internal weekday and refresh without reloading the entry."""
            entry, runtime = editable_clock(call.data[ATTR_ENTITY_ID])
            day = call.data["day"]
            alarm_time = call.data["time"]
            options = dict(entry.options)
            options[day_time_key(day)] = alarm_time.isoformat()
            if "enabled" in call.data:
                options[day_enabled_key(day)] = call.data["enabled"]
            hass.config_entries.async_update_entry(entry, options=options)
            await runtime.async_refresh_schedule()

        async def async_set_holiday_time(call: ServiceCall) -> None:
            """Persist one Holiday time scope and refresh without reloading the entry."""
            entry, runtime = editable_clock(call.data[ATTR_ENTITY_ID])
            key = (
                CONF_HOLIDAY_WEEKEND_TIME
                if call.data["scope"] == "weekend"
                else CONF_HOLIDAY_TIME
            )
            options = dict(entry.options)
            options[key] = call.data["time"].isoformat()
            hass.config_entries.async_update_entry(entry, options=options)
            await runtime.async_refresh_schedule()

        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEEKDAY_ALARM,
            async_set_weekday_alarm,
            schema=vol.Schema(
                {
                    vol.Required(ATTR_ENTITY_ID): cv.entity_id,
                    vol.Required("day"): vol.In(WEEKDAYS),
                    vol.Required("time"): cv.time,
                    vol.Optional("enabled"): cv.boolean,
                }
            ),
        )
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_HOLIDAY_TIME,
            async_set_holiday_time,
            schema=vol.Schema(
                {
                    vol.Required(ATTR_ENTITY_ID): cv.entity_id,
                    vol.Required("scope"): vol.In(("weekday", "weekend")),
                    vol.Required("time"): cv.time,
                }
            ),
        )
        hass.data[service_key] = True
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ClockAdvancedConfigEntry) -> bool:
    """Set up one clock and all of its standard entities."""
    runtime = ClockRuntime(hass, entry)
    entry.runtime_data = runtime
    await runtime.async_start()
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    def schedule_card_notification(attempt: int = 0) -> None:
        delays = (1, 3, 10, 30)
        if runtime.state.card_notification_sent or attempt >= len(delays):
            return

        async def notify_card(_now) -> None:
            if runtime.state.card_notification_sent:
                return
            registry = er.async_get(hass)
            entity_id = registry.async_get_entity_id(
                "sensor", DOMAIN, f"{entry.entry_id}_status"
            )
            if not entity_id:
                schedule_card_notification(attempt + 1)
                return
            german = (hass.config.language or "en").lower().startswith("de")
            card_yaml = (
                "type: custom:clock-advanced-card\n"
                f"entity: {entity_id}\n"
                "mode: easy\n"
                "language: auto\n"
            )
            badge_yaml = (
                "type: entity\n"
                f"entity: {entity_id}\n"
                "show_name: false\n"
                "show_icon: true\n"
                "show_state: true\n"
                "color: state\n"
            )
            title = (
                f"Clock Advanced – Dashboard für {entry.title}"
                if german
                else f"Clock Advanced – dashboard for {entry.title}"
            )
            if german:
                message = (
                    "Der Wecker wurde erstellt. Die Karte und das Badge lassen sich "
                    "über den grafischen Dashboard-Editor konfigurieren.\n\n"
                    "**Empfohlene Easy-Karte:**\n\n"
                    f"```yaml\n{card_yaml}```\n\n"
                    "**Kleiner runder Home-Assistant-Badge:**\n\n"
                    f"```yaml\n{badge_yaml}```\n\n"
                    "**Einfügen:** Dashboard bearbeiten → Karte beziehungsweise Badge "
                    "hinzufügen → Clock Advanced auswählen. Alternativ unter „Manuell“ "
                    "den Code einfügen.\n\n"
                    f"Falls Clock Advanced im Auswahldialog noch fehlt, unter "
                    f"Einstellungen → Dashboards → Ressourcen `{CARD_RESOURCE}` einmalig "
                    "als JavaScript-Modul registrieren.\n\n"
                    "Hinweis: Der grafische Dashboard-Editor ist nur bei einem von Home "
                    "Assistant verwalteten Dashboard verfügbar, nicht im YAML-Modus.\n\n"
                    f"Status-Entität: `{entity_id}`"
                )
            else:
                message = (
                    "The alarm clock was created. Its card and badge can be configured "
                    "with the graphical dashboard editor.\n\n"
                    "**Recommended Easy card:**\n\n"
                    f"```yaml\n{card_yaml}```\n\n"
                    "**Small round Home Assistant badge:**\n\n"
                    f"```yaml\n{badge_yaml}```\n\n"
                    "**Add it:** Edit dashboard → Add card or badge → select Clock "
                    "Advanced. Alternatively paste the code under Manual.\n\n"
                    f"If Clock Advanced is not available in the picker yet, register "
                    f"`{CARD_RESOURCE}` once as a JavaScript module under Settings → "
                    "Dashboards → Resources.\n\n"
                    "The graphical dashboard editor is available only for dashboards "
                    "managed by Home Assistant, not YAML-mode dashboards.\n\n"
                    f"Status entity: `{entity_id}`"
                )
            try:
                await hass.services.async_call(
                    "persistent_notification",
                    "create",
                    {
                        "title": title,
                        "message": message,
                        "notification_id": f"clock_advanced_card_{entry.entry_id}",
                    },
                    blocking=True,
                )
            except Exception:  # Home Assistant may still be starting its service.
                schedule_card_notification(attempt + 1)
                return
            await runtime.async_mark_card_notification_sent()

        entry.async_on_unload(
            async_call_later(hass, delays[attempt], notify_card)
        )

    schedule_card_notification()
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ClockAdvancedConfigEntry) -> bool:
    """Unload one clock cleanly."""
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    await entry.runtime_data.async_stop()
    return True


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate the grouped prototype schedule to the seven-day schema."""
    if entry.version >= 5:
        return True

    existing = {**entry.data, **entry.options}
    holiday_weekend_time = existing.get(
        CONF_HOLIDAY_WEEKEND_TIME,
        existing.get(CONF_NON_WORKDAY_TIME, DEFAULT_HOLIDAY_WEEKEND_TIME),
    )

    def migrate(values: dict) -> dict:
        result = dict(values)
        if entry.version < 3:
            grouped = (
                result.pop("mon_wed_time", "06:00:00"),
                result.pop("thu_fri_time", "07:00:00"),
                result.pop("weekend_time", "08:00:00"),
            )
            for index, day in enumerate(WEEKDAYS):
                result.setdefault(day_enabled_key(day), True)
                group = 0 if index <= 2 else 1 if index <= 4 else 2
                result.setdefault(day_time_key(day), grouped[group])
        if "occupancy_sensor" in result and "confirmation_sensor" not in result:
            result["confirmation_sensor"] = result.pop("occupancy_sensor")
        result.setdefault(CONF_SCHEDULE_SOURCE, DEFAULT_SCHEDULE_SOURCE)
        result.setdefault(CONF_ALLOW_STATE, DEFAULT_ALLOW_STATE)
        result.setdefault(CONF_BLOCK_STATE, DEFAULT_BLOCK_STATE)
        result.setdefault(CONF_BLOCK_NON_WORKDAYS, False)
        native_conditions = list(result.get(CONF_START_CONDITIONS) or [])
        if allow_entity := result.pop("allow_entity", None):
            native_conditions.append(
                {
                    "condition": "state",
                    "entity_id": allow_entity,
                    "state": result.pop(CONF_ALLOW_STATE, DEFAULT_ALLOW_STATE),
                }
            )
        else:
            result.pop(CONF_ALLOW_STATE, None)
        if block_entity := result.pop("block_entity", None):
            native_conditions.append(
                {
                    "condition": "not",
                    "conditions": [
                        {
                            "condition": "state",
                            "entity_id": block_entity,
                            "state": result.pop(CONF_BLOCK_STATE, DEFAULT_BLOCK_STATE),
                        }
                    ],
                }
            )
        else:
            result.pop(CONF_BLOCK_STATE, None)
        result[CONF_START_CONDITIONS] = native_conditions
        result.setdefault(
            CONF_ESCALATE_AFTER_SNOOZES, DEFAULT_ESCALATE_AFTER_SNOOZES
        )
        result.setdefault(
            CONF_HOLIDAY_WEEKEND_TIME,
            holiday_weekend_time,
        )
        return result

    hass.config_entries.async_update_entry(
        entry,
        data=migrate(dict(entry.data)),
        options=migrate(dict(entry.options)) if entry.options else {},
        version=5,
    )
    return True
