"""Binary sensor platform for Clock Advanced."""

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import ClockAdvancedConfigEntry
from .const import ACTIVE_STATUSES
from .entity import ClockAdvancedEntity


async def async_setup_entry(
    hass, entry: ClockAdvancedConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([ClockAlarmActiveSensor(entry.runtime_data)])


class ClockAlarmActiveSensor(ClockAdvancedEntity, BinarySensorEntity):
    """Indicate an active pre-alarm, ringing, or snooze session."""

    _attr_translation_key = "alarm_active"
    _attr_icon = "mdi:alarm-light"

    def __init__(self, runtime) -> None:
        super().__init__(runtime, "alarm_active")

    @property
    def is_on(self) -> bool:
        return self.runtime.state.status in ACTIVE_STATUSES
