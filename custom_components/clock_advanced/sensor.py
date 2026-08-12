"""Versioned public Card contract for Clock Advanced."""

from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import ClockAdvancedConfigEntry
from .const import (
    CARD_CONTRACT_VERSION,
    CARD_RESOURCE,
    CARD_TYPE,
    CONF_ALLOW_ENTITY,
    CONF_ALLOW_STATE,
    CONF_BLOCK_ENTITY,
    CONF_BLOCK_NON_WORKDAYS,
    CONF_BLOCK_STATE,
    CONF_CONFIRMATION_SENSOR,
    CONF_ESCALATE_AFTER_SNOOZES,
    CONF_PRE_ALARM_MINUTES,
    CONF_SCHEDULE_ENTITY,
    CONF_SCHEDULE_SOURCE,
    CONF_START_CONDITIONS,
    CONF_TIMEOUT_MINUTES,
    CONF_VACATION_ENTITY,
    CONF_WORKDAY_SENSOR,
    DEFAULT_PRE_ALARM_MINUTES,
    DEFAULT_ESCALATE_AFTER_SNOOZES,
    DEFAULT_ALLOW_STATE,
    DEFAULT_BLOCK_STATE,
    DEFAULT_SCHEDULE_SOURCE,
    DEFAULT_TIMEOUT_MINUTES,
    DOMAIN,
    STATUS_BLOCKED,
    STATUS_DISABLED,
    STATUS_DISMISSED,
    STATUS_ERROR,
    STATUS_IDLE,
    STATUS_PRE_ALARM,
    STATUS_RINGING,
    STATUS_SCHEDULED,
    STATUS_SKIPPED,
    STATUS_SNOOZED,
    STATUS_TIMEOUT,
    STATUS_VACATION,
)
from .entity import ClockAdvancedEntity


async def async_setup_entry(
    hass, entry: ClockAdvancedConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([ClockStatusSensor(entry.runtime_data)])


class ClockStatusSensor(ClockAdvancedEntity, SensorEntity):
    """Expose stable, non-sensitive state for dashboards and automations."""

    _attr_translation_key = "status"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = [
        STATUS_IDLE,
        STATUS_SCHEDULED,
        STATUS_DISABLED,
        STATUS_VACATION,
        STATUS_PRE_ALARM,
        STATUS_RINGING,
        STATUS_SNOOZED,
        STATUS_DISMISSED,
        STATUS_SKIPPED,
        STATUS_TIMEOUT,
        STATUS_ERROR,
        STATUS_BLOCKED,
    ]

    def __init__(self, runtime) -> None:
        super().__init__(runtime, "status")

    @property
    def native_value(self) -> str:
        return self.runtime.state.status

    def _entity(self, platform: str, key: str) -> str | None:
        return er.async_get(self.hass).async_get_entity_id(
            platform, DOMAIN, f"{self.runtime.entry.entry_id}_{key}"
        )

    @property
    def extra_state_attributes(self) -> dict:
        state = self.runtime.state
        controls = {
            "enabled": self._entity("switch", "enabled"),
            "skip_next": self._entity("switch", "skip_next"),
            "holiday_mode": self._entity("switch", "holiday_mode"),
            "vacation_mode": self._entity("switch", "vacation_mode"),
            "next_alarm": self._entity("datetime", "next_alarm"),
            "dismiss": self._entity("button", "dismiss"),
            "snooze": self._entity("button", "snooze"),
        }
        guards = {
            "workday": self.runtime.config.get(CONF_WORKDAY_SENSOR),
            "vacation": self.runtime.config.get(CONF_VACATION_ENTITY),
            "confirmation": self.runtime.config.get(CONF_CONFIRMATION_SENSOR),
            "allow": self.runtime.config.get(CONF_ALLOW_ENTITY),
            "block": self.runtime.config.get(CONF_BLOCK_ENTITY),
            "native_conditions": len(
                self.runtime.config.get(CONF_START_CONDITIONS) or []
            ),
        }
        return {
            "card_contract": CARD_CONTRACT_VERSION,
            "card_type": CARD_TYPE,
            "card_resource": CARD_RESOURCE,
            "card_yaml": (
                f"type: {CARD_TYPE}\nentity: {self.entity_id}\n"
                "mode: easy\nlanguage: auto\n"
            ),
            "badge_yaml": (
                f"type: custom:clock-advanced-badge\nentity: {self.entity_id}\n"
                "language: auto\n"
            ),
            "name": self.runtime.entry.title,
            "next_alarm": (
                self.runtime.next_alarm.isoformat() if self.runtime.next_alarm else None
            ),
            "pre_alarm_at": (
                self.runtime.pre_alarm_at.isoformat()
                if self.runtime.pre_alarm_at
                else None
            ),
            "active_since": state.active_since,
            "snooze_until": state.snooze_until,
            "repeat_count": state.repeat_count,
            "snooze_count": state.snooze_count,
            "snooze_available": self.runtime.snooze_available,
            "escalated": state.escalated,
            "last_phase": state.last_phase,
            "last_reason": state.last_reason,
            "last_error": state.last_error,
            "schedule_source": (
                "one_time"
                if state.manual_alarm
                else self.runtime.config.get(
                    CONF_SCHEDULE_SOURCE, DEFAULT_SCHEDULE_SOURCE
                )
            ),
            "schedule_entity": self.runtime.config.get(CONF_SCHEDULE_ENTITY),
            "schedule": self.runtime.schedule_public,
            "controls": {key: value for key, value in controls.items() if value},
            "guards": {key: value for key, value in guards.items() if value},
            "settings": {
                "pre_alarm_minutes": int(
                    self.runtime.setting(
                        CONF_PRE_ALARM_MINUTES, DEFAULT_PRE_ALARM_MINUTES
                    )
                ),
                "timeout_minutes": int(
                    self.runtime.setting(CONF_TIMEOUT_MINUTES, DEFAULT_TIMEOUT_MINUTES)
                ),
                "escalate_after_snoozes": int(
                    self.runtime.setting(
                        CONF_ESCALATE_AFTER_SNOOZES,
                        DEFAULT_ESCALATE_AFTER_SNOOZES,
                    )
                ),
                "block_non_workdays": bool(
                    self.runtime.config.get(CONF_BLOCK_NON_WORKDAYS, False)
                ),
                "allow_state": str(
                    self.runtime.config.get(CONF_ALLOW_STATE, DEFAULT_ALLOW_STATE)
                ),
                "block_state": str(
                    self.runtime.config.get(CONF_BLOCK_STATE, DEFAULT_BLOCK_STATE)
                ),
            },
        }
