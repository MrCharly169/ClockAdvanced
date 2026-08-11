"""Command buttons for Clock Advanced."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from homeassistant.components.button import ButtonEntity
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import ClockAdvancedConfigEntry
from .entity import ClockAdvancedEntity


async def async_setup_entry(
    hass, entry: ClockAdvancedConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    runtime = entry.runtime_data
    async_add_entities(
        [
            ClockButton(runtime, "dismiss", runtime.async_dismiss),
            ClockButton(runtime, "snooze", runtime.async_snooze),
            ClockButton(
                runtime,
                "recalculate",
                runtime.async_recalculate_schedule,
                EntityCategory.CONFIG,
            ),
        ]
    )


class ClockButton(ClockAdvancedEntity, ButtonEntity):
    """Invoke one runtime command."""

    def __init__(
        self,
        runtime,
        key: str,
        handler: Callable[[], Awaitable[None]],
        entity_category: EntityCategory | None = None,
    ) -> None:
        super().__init__(runtime, key)
        self._attr_translation_key = key
        self._handler = handler
        self._attr_entity_category = entity_category

    async def async_press(self) -> None:
        await self._handler()
