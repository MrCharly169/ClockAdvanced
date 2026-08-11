"""Shared entity base for Clock Advanced."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import DOMAIN, SIGNAL_UPDATE
from .runtime import ClockRuntime


class ClockAdvancedEntity(Entity):
    """Base class for all Clock Advanced entities."""

    _attr_has_entity_name = True

    def __init__(self, runtime: ClockRuntime, key: str) -> None:
        self.runtime = runtime
        self._attr_unique_id = f"{runtime.entry.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, runtime.entry.entry_id)},
            name=runtime.entry.title,
            manufacturer="Clock Advanced",
            model="Advanced Alarm Clock",
        )

    async def async_added_to_hass(self) -> None:
        """Subscribe to runtime updates."""
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                f"{SIGNAL_UPDATE}_{self.runtime.entry.entry_id}",
                self.async_write_ha_state,
            )
        )
