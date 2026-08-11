"""Date/time platform for Clock Advanced."""

from __future__ import annotations

from datetime import datetime

from homeassistant.components.datetime import DateTimeEntity
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import ClockAdvancedConfigEntry
from .entity import ClockAdvancedEntity


async def async_setup_entry(
    hass, entry: ClockAdvancedConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Set up the editable next-alarm entity."""
    async_add_entities([ClockNextAlarmDateTime(entry.runtime_data)])


class ClockNextAlarmDateTime(ClockAdvancedEntity, DateTimeEntity):
    """Show the calculated alarm and accept a one-time override."""

    _attr_translation_key = "next_alarm"
    _attr_icon = "mdi:calendar-clock"

    def __init__(self, runtime) -> None:
        super().__init__(runtime, "next_alarm")

    @property
    def native_value(self) -> datetime | None:
        return self.runtime.next_alarm

    async def async_set_value(self, value: datetime) -> None:
        await self.runtime.async_set_manual_alarm(value)
