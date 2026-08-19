"""Switch platform for Clock Advanced."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import ClockAdvancedConfigEntry
from .entity import ClockAdvancedEntity


async def async_setup_entry(
    hass, entry: ClockAdvancedConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Set up Clock Advanced switches."""
    runtime = entry.runtime_data
    async_add_entities(
        [
            ClockStateSwitch(runtime, "enabled", "enabled", runtime.async_set_enabled),
            ClockStateSwitch(
                runtime,
                "skip_next",
                "skip_next",
                runtime.async_set_skip_next,
                EntityCategory.CONFIG,
            ),
            ClockStateSwitch(
                runtime,
                "holiday_mode",
                "holiday_mode",
                runtime.async_set_holiday_mode,
                EntityCategory.CONFIG,
            ),
            ClockStateSwitch(
                runtime,
                "vacation_mode",
                "vacation_mode",
                runtime.async_set_vacation_mode,
                EntityCategory.CONFIG,
            ),
        ]
    )


class ClockStateSwitch(ClockAdvancedEntity, SwitchEntity):
    """A persisted Clock Advanced boolean."""

    def __init__(
        self,
        runtime,
        key: str,
        state_attribute: str,
        setter: Callable[[bool], Awaitable[None]],
        entity_category: EntityCategory | None = None,
    ) -> None:
        super().__init__(runtime, key)
        self._attr_translation_key = key
        self._state_attribute = state_attribute
        self._setter = setter
        self._attr_entity_category = entity_category

    @property
    def is_on(self) -> bool:
        return bool(getattr(self.runtime.state, self._state_attribute))

    async def async_turn_on(self, **kwargs) -> None:
        await self._setter(True)

    async def async_turn_off(self, **kwargs) -> None:
        await self._setter(False)
