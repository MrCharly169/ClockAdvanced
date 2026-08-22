"""Privacy-aware diagnostics for Clock Advanced."""

from __future__ import annotations

from homeassistant.components.diagnostics import async_redact_data

from .const import (
    ACTION_PHASES,
    CONF_ALLOW_ENTITY,
    CONF_BLOCK_ENTITY,
    CONF_CONFIRMATION_SENSOR,
    CONF_NOTIFICATION_TARGETS,
    CONF_NOTIFICATION_BACK_PATH,
    CONF_REMINDER_DASHBOARD_PATH,
    CONF_START_CONDITIONS,
    CONF_VACATION_ENTITY,
    CONF_WORKDAY_SENSOR,
    action_key,
)


async def async_get_config_entry_diagnostics(hass, entry):
    """Return configuration shape and runtime state without action payloads."""
    runtime = entry.runtime_data
    redact = [
        CONF_WORKDAY_SENSOR,
        CONF_VACATION_ENTITY,
        CONF_CONFIRMATION_SENSOR,
        CONF_NOTIFICATION_TARGETS,
        CONF_NOTIFICATION_BACK_PATH,
        CONF_REMINDER_DASHBOARD_PATH,
        CONF_ALLOW_ENTITY,
        CONF_BLOCK_ENTITY,
        CONF_START_CONDITIONS,
        *(action_key(phase) for phase in ACTION_PHASES),
    ]
    return {
        "configuration": async_redact_data(runtime.config, redact),
        "config_entry_version": entry.version,
        "runtime": {
            "status": runtime.state.status,
            "next_alarm": runtime.next_alarm.isoformat() if runtime.next_alarm else None,
            "pre_alarm_at": (
                runtime.pre_alarm_at.isoformat() if runtime.pre_alarm_at else None
            ),
            "enabled": runtime.state.enabled,
            "skip_next": runtime.state.skip_next,
            "holiday_mode": runtime.state.holiday_mode,
            "vacation_mode": runtime.state.vacation_mode,
            "repeat_count": runtime.state.repeat_count,
            "snooze_count": runtime.state.snooze_count,
            "escalated": runtime.state.escalated,
            "last_phase": runtime.state.last_phase,
            "last_reason": runtime.state.last_reason,
            "last_error": runtime.state.last_error,
        },
        "card_contract": 1,
        "schedule": runtime.schedule_public,
    }
