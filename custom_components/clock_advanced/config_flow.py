"""Config and options flows for Clock Advanced."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import Platform
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    ACTION_PHASES,
    CONF_ALLOW_ENTITY,
    CONF_ALLOW_STATE,
    CONF_BLOCK_ENTITY,
    CONF_BLOCK_NON_WORKDAYS,
    CONF_BLOCK_STATE,
    CONF_CONFIRMATION_SENSOR,
    CONF_ESCALATE_AFTER_REPEATS,
    CONF_ESCALATE_AFTER_SNOOZES,
    CONF_HOLIDAY_ENABLED,
    CONF_HOLIDAY_TIME,
    CONF_MAX_SNOOZES,
    CONF_NAME,
    CONF_NON_WORKDAY_ENABLED,
    CONF_NON_WORKDAY_TIME,
    CONF_PRE_ALARM_MINUTES,
    CONF_REPEAT_INTERVAL_MINUTES,
    CONF_SCHEDULE_ENTITY,
    CONF_SCHEDULE_SOURCE,
    CONF_SNOOZE_MINUTES,
    CONF_START_CONDITIONS,
    CONF_TERMINAL_STATE_MINUTES,
    CONF_TIMEOUT_MINUTES,
    CONF_VACATION_ENTITY,
    CONF_WORKDAY_SENSOR,
    DEFAULT_ESCALATE_AFTER_REPEATS,
    DEFAULT_ESCALATE_AFTER_SNOOZES,
    DEFAULT_ALLOW_STATE,
    DEFAULT_BLOCK_STATE,
    DEFAULT_HOLIDAY_TIME,
    DEFAULT_MAX_SNOOZES,
    DEFAULT_NAME,
    DEFAULT_NON_WORKDAY_TIME,
    DEFAULT_PRE_ALARM_MINUTES,
    DEFAULT_REPEAT_INTERVAL_MINUTES,
    DEFAULT_SCHEDULE_SOURCE,
    DEFAULT_SNOOZE_MINUTES,
    DEFAULT_TERMINAL_STATE_MINUTES,
    DEFAULT_TIMEOUT_MINUTES,
    DEFAULT_WEEKDAY_TIME,
    DEFAULT_WEEKEND_TIME,
    DOMAIN,
    SCHEDULE_SOURCE_ENTITY,
    SCHEDULE_SOURCE_WEEKLY,
    WEEKDAYS,
    action_key,
    day_enabled_key,
    day_time_key,
)


def _number(minimum: int, maximum: int) -> selector.NumberSelector:
    return selector.NumberSelector(
        selector.NumberSelectorConfig(min=minimum, max=maximum, step=1, mode="box")
    )


def _source_schema() -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(
                CONF_SCHEDULE_SOURCE, default=DEFAULT_SCHEDULE_SOURCE
            ): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=[SCHEDULE_SOURCE_WEEKLY, SCHEDULE_SOURCE_ENTITY],
                    translation_key="schedule_source",
                )
            )
        }
    )


def _helper_schedule_schema() -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_SCHEDULE_ENTITY): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="schedule")
            )
        }
    )


def _source_options_schema() -> vol.Schema:
    fields: dict[Any, Any] = {
        vol.Required(CONF_NAME, default=DEFAULT_NAME): selector.TextSelector()
    }
    fields.update(_source_schema().schema)
    fields[vol.Optional(CONF_SCHEDULE_ENTITY)] = selector.EntitySelector(
        selector.EntitySelectorConfig(domain="schedule")
    )
    return vol.Schema(fields)


def _schedule_schema() -> vol.Schema:
    fields: dict[Any, Any] = {}
    for index, day in enumerate(WEEKDAYS):
        default_time = DEFAULT_WEEKDAY_TIME if index < 5 else DEFAULT_WEEKEND_TIME
        fields[vol.Required(day_enabled_key(day), default=True)] = selector.BooleanSelector()
        fields[vol.Required(day_time_key(day), default=default_time)] = selector.TimeSelector()
    fields.update(
        {
            vol.Required(CONF_HOLIDAY_ENABLED, default=True): selector.BooleanSelector(),
            vol.Required(CONF_HOLIDAY_TIME, default=DEFAULT_HOLIDAY_TIME): selector.TimeSelector(),
            vol.Required(CONF_NON_WORKDAY_ENABLED, default=True): selector.BooleanSelector(),
            vol.Required(
                CONF_NON_WORKDAY_TIME, default=DEFAULT_NON_WORKDAY_TIME
            ): selector.TimeSelector(),
        }
    )
    return vol.Schema(fields)


def _behavior_schema() -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(
                CONF_PRE_ALARM_MINUTES, default=DEFAULT_PRE_ALARM_MINUTES
            ): _number(0, 120),
            vol.Required(
                CONF_REPEAT_INTERVAL_MINUTES,
                default=DEFAULT_REPEAT_INTERVAL_MINUTES,
            ): _number(1, 60),
            vol.Required(
                CONF_ESCALATE_AFTER_REPEATS,
                default=DEFAULT_ESCALATE_AFTER_REPEATS,
            ): _number(0, 20),
            vol.Required(
                CONF_ESCALATE_AFTER_SNOOZES,
                default=DEFAULT_ESCALATE_AFTER_SNOOZES,
            ): _number(0, 20),
            vol.Required(CONF_SNOOZE_MINUTES, default=DEFAULT_SNOOZE_MINUTES): _number(
                1, 120
            ),
            vol.Required(CONF_MAX_SNOOZES, default=DEFAULT_MAX_SNOOZES): _number(0, 20),
            vol.Required(CONF_TIMEOUT_MINUTES, default=DEFAULT_TIMEOUT_MINUTES): _number(
                1, 240
            ),
            vol.Required(
                CONF_TERMINAL_STATE_MINUTES,
                default=DEFAULT_TERMINAL_STATE_MINUTES,
            ): _number(1, 120),
        }
    )


def _guards_schema() -> vol.Schema:
    return vol.Schema(
        {
            vol.Optional(CONF_WORKDAY_SENSOR): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=Platform.BINARY_SENSOR)
            ),
            vol.Optional(CONF_VACATION_ENTITY): selector.EntitySelector(
                selector.EntitySelectorConfig(
                    domain=[Platform.BINARY_SENSOR, Platform.SWITCH, "input_boolean"]
                )
            ),
            vol.Optional(CONF_CONFIRMATION_SENSOR): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=Platform.BINARY_SENSOR)
            ),
            vol.Required(
                CONF_BLOCK_NON_WORKDAYS, default=False
            ): selector.BooleanSelector(),
            vol.Optional(CONF_START_CONDITIONS, default=[]): selector.ConditionSelector(),
        }
    )


def _actions_schema() -> vol.Schema:
    return vol.Schema(
        {
            vol.Optional(action_key(phase), default=[]): selector.ActionSelector()
            for phase in ACTION_PHASES
        }
    )


class ClockAdvancedConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Create a generic advanced clock through a guided wizard."""

    VERSION = 4

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_source()
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {vol.Required(CONF_NAME, default=DEFAULT_NAME): selector.TextSelector()}
            ),
        )

    async def async_step_source(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            self._data.update(user_input)
            if user_input[CONF_SCHEDULE_SOURCE] == SCHEDULE_SOURCE_ENTITY:
                return await self.async_step_helper_schedule()
            return await self.async_step_schedule()
        return self.async_show_form(step_id="source", data_schema=_source_schema())

    async def async_step_helper_schedule(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_guards()
        return self.async_show_form(
            step_id="helper_schedule", data_schema=_helper_schedule_schema()
        )

    async def async_step_schedule(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_guards()
        return self.async_show_form(step_id="schedule", data_schema=_schedule_schema())

    async def async_step_behavior(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_actions()
        return self.async_show_form(step_id="behavior", data_schema=_behavior_schema())

    async def async_step_guards(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_behavior()
        return self.async_show_form(step_id="guards", data_schema=_guards_schema())

    async def async_step_actions(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_review()
        return self.async_show_form(step_id="actions", data_schema=_actions_schema())

    async def async_step_review(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            if user_input.get("confirm"):
                return self.async_create_entry(
                    title=self._data[CONF_NAME], data=self._data
                )
            return self.async_show_form(
                step_id="review",
                data_schema=vol.Schema(
                    {vol.Required("confirm", default=False): selector.BooleanSelector()}
                ),
                errors={"confirm": "confirmation_required"},
                description_placeholders=self._review_placeholders(),
                last_step=True,
            )
        return self.async_show_form(
            step_id="review",
            data_schema=vol.Schema(
                {vol.Required("confirm", default=True): selector.BooleanSelector()}
            ),
            description_placeholders=self._review_placeholders(),
            last_step=True,
        )

    def _review_placeholders(self) -> dict[str, str]:
        """Build the compact final review summary."""
        source = self._data.get(CONF_SCHEDULE_SOURCE, DEFAULT_SCHEDULE_SOURCE)
        source_detail = (
            self._data.get(CONF_SCHEDULE_ENTITY, "schedule.unknown")
            if source == SCHEDULE_SOURCE_ENTITY
            else SCHEDULE_SOURCE_WEEKLY
        )
        guard_keys = (
            CONF_WORKDAY_SENSOR,
            CONF_VACATION_ENTITY,
            CONF_CONFIRMATION_SENSOR,
        )
        guard_count = sum(bool(self._data.get(key)) for key in guard_keys) + len(
            self._data.get(CONF_START_CONDITIONS) or []
        )
        action_count = sum(bool(self._data.get(action_key(phase))) for phase in ACTION_PHASES)
        return {
            "name": str(self._data[CONF_NAME]),
            "source": str(source_detail),
            "guards": str(guard_count),
            "actions": str(action_count),
        }

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        return ClockAdvancedOptionsFlow()


class ClockAdvancedOptionsFlow(config_entries.OptionsFlowWithReload):
    """Edit one integration section at a time and reload the entry."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        return self.async_show_menu(
            step_id="init",
            menu_options=["source", "schedule", "guards", "behavior", "actions"],
        )

    @property
    def _current(self) -> dict[str, Any]:
        return {**self.config_entry.data, **self.config_entry.options}

    def _with_suggestions(self, schema: vol.Schema) -> vol.Schema:
        return self.add_suggested_values_to_schema(schema, self._current)

    def _save(self, values: dict[str, Any], clear: tuple[str, ...] = ()):
        if CONF_NAME in values:
            title = str(values[CONF_NAME]).strip() or DEFAULT_NAME
            values = {**values, CONF_NAME: title}
            self.hass.config_entries.async_update_entry(
                self.config_entry, title=title
            )
        data = dict(self.config_entry.options)
        for key in clear:
            data.pop(key, None)
        data.update(values)
        return self.async_create_entry(data=data)

    async def async_step_source(self, user_input=None):
        keys = (CONF_NAME, CONF_SCHEDULE_SOURCE, CONF_SCHEDULE_ENTITY)
        if user_input is not None:
            if (
                user_input.get(CONF_SCHEDULE_SOURCE) == SCHEDULE_SOURCE_ENTITY
                and not user_input.get(CONF_SCHEDULE_ENTITY)
            ):
                return self.async_show_form(
                    step_id="source",
                    data_schema=self._with_suggestions(_source_options_schema()),
                    errors={CONF_SCHEDULE_ENTITY: "schedule_required"},
                )
            return self._save(user_input, keys)
        return self.async_show_form(
            step_id="source",
            data_schema=self._with_suggestions(_source_options_schema()),
        )

    async def async_step_schedule(self, user_input=None):
        if user_input is not None:
            return self._save(user_input)
        return self.async_show_form(
            step_id="schedule", data_schema=self._with_suggestions(_schedule_schema())
        )

    async def async_step_behavior(self, user_input=None):
        if user_input is not None:
            return self._save(user_input)
        return self.async_show_form(
            step_id="behavior", data_schema=self._with_suggestions(_behavior_schema())
        )

    async def async_step_guards(self, user_input=None):
        keys = (
            CONF_WORKDAY_SENSOR,
            CONF_VACATION_ENTITY,
            CONF_CONFIRMATION_SENSOR,
            CONF_START_CONDITIONS,
            CONF_ALLOW_ENTITY,
            CONF_ALLOW_STATE,
            CONF_BLOCK_ENTITY,
            CONF_BLOCK_STATE,
        )
        if user_input is not None:
            return self._save(user_input, keys)
        return self.async_show_form(
            step_id="guards", data_schema=self._with_suggestions(_guards_schema())
        )

    async def async_step_actions(self, user_input=None):
        keys = tuple(action_key(phase) for phase in ACTION_PHASES)
        if user_input is not None:
            return self._save(user_input, keys)
        return self.async_show_form(
            step_id="actions", data_schema=self._with_suggestions(_actions_schema())
        )
