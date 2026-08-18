"""Constants for Clock Advanced."""

from homeassistant.const import Platform

DOMAIN = "clock_advanced"
NAME = "Clock Advanced"
CARD_RESOURCE = "/clock_advanced/clock-advanced-card.js"
LEGACY_CARD_RESOURCE = "/clock_advanced/clock-advanced.js"
CARD_TYPE = "custom:clock-advanced-card"
CARD_CONTRACT_VERSION = 1
STORAGE_VERSION = 1
SERVICE_SET_WEEKDAY_ALARM = "set_weekday_alarm"

PLATFORMS: list[Platform] = [
    Platform.BINARY_SENSOR,
    Platform.BUTTON,
    Platform.DATETIME,
    Platform.SENSOR,
    Platform.SWITCH,
]

CONF_NAME = "name"
CONF_SCHEDULE_SOURCE = "schedule_source"
CONF_SCHEDULE_ENTITY = "schedule_entity"
CONF_WORKDAY_SENSOR = "workday_sensor"
CONF_VACATION_ENTITY = "vacation_entity"
CONF_CONFIRMATION_SENSOR = "confirmation_sensor"
CONF_START_CONDITIONS = "start_conditions"
CONF_ALLOW_ENTITY = "allow_entity"
CONF_ALLOW_STATE = "allow_state"
CONF_BLOCK_ENTITY = "block_entity"
CONF_BLOCK_STATE = "block_state"
CONF_BLOCK_NON_WORKDAYS = "block_non_workdays"
CONF_HOLIDAY_ENABLED = "holiday_enabled"
CONF_HOLIDAY_TIME = "holiday_time"
CONF_HOLIDAY_WEEKEND_TIME = "holiday_weekend_time"
CONF_NON_WORKDAY_ENABLED = "non_workday_enabled"
CONF_NON_WORKDAY_TIME = "non_workday_time"
CONF_PRE_ALARM_MINUTES = "pre_alarm_minutes"
CONF_REPEAT_INTERVAL_MINUTES = "repeat_interval_minutes"
CONF_ESCALATE_AFTER_REPEATS = "escalate_after_repeats"
CONF_ESCALATE_AFTER_SNOOZES = "escalate_after_snoozes"
CONF_SNOOZE_MINUTES = "snooze_minutes"
CONF_MAX_SNOOZES = "max_snoozes"
CONF_TIMEOUT_MINUTES = "timeout_minutes"
CONF_TERMINAL_STATE_MINUTES = "terminal_state_minutes"
CONF_NOTIFICATIONS_ENABLED = "notifications_enabled"
CONF_NOTIFICATION_TARGETS = "notification_targets"
CONF_NOTIFICATION_EVENTS = "notification_events"
CONF_REMINDER_ENABLED = "next_alarm_reminder_enabled"
CONF_REMINDER_TIME = "next_alarm_reminder_time"
CONF_REMINDER_DASHBOARD_PATH = "dashboard_path"

WEEKDAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)

ACTION_PHASES = (
    "prepare",
    "start",
    "repeat",
    "escalate",
    "snooze",
    "dismiss",
    "timeout",
    "cleanup",
)


def day_enabled_key(day: str) -> str:
    """Return the config key for a weekday enable flag."""
    return f"{day}_enabled"


def day_time_key(day: str) -> str:
    """Return the config key for a weekday time."""
    return f"{day}_time"


def action_key(phase: str) -> str:
    """Return the config key for an action phase."""
    return f"actions_{phase}"


DEFAULT_NAME = "Advanced Alarm Clock"
SCHEDULE_SOURCE_WEEKLY = "weekly"
SCHEDULE_SOURCE_ENTITY = "schedule_entity"
DEFAULT_SCHEDULE_SOURCE = SCHEDULE_SOURCE_WEEKLY
DEFAULT_ALLOW_STATE = "on"
DEFAULT_BLOCK_STATE = "on"
DEFAULT_WEEKDAY_TIME = "06:00:00"
DEFAULT_WEEKEND_TIME = "08:00:00"
DEFAULT_HOLIDAY_TIME = "07:30:00"
DEFAULT_HOLIDAY_WEEKEND_TIME = "09:00:00"
DEFAULT_NON_WORKDAY_TIME = "09:00:00"
DEFAULT_PRE_ALARM_MINUTES = 10
DEFAULT_REPEAT_INTERVAL_MINUTES = 4
DEFAULT_ESCALATE_AFTER_REPEATS = 4
DEFAULT_ESCALATE_AFTER_SNOOZES = 0
DEFAULT_SNOOZE_MINUTES = 9
DEFAULT_MAX_SNOOZES = 3
DEFAULT_TIMEOUT_MINUTES = 30
DEFAULT_TERMINAL_STATE_MINUTES = 20
DEFAULT_NOTIFICATIONS_ENABLED = False
DEFAULT_NOTIFICATION_EVENTS = (
    "start",
    "escalate",
    "timeout",
    "blocked",
)
DEFAULT_REMINDER_ENABLED = False
DEFAULT_REMINDER_TIME = "19:00:00"

EVENT_PHASE = f"{DOMAIN}_phase"
EVENT_NOTIFICATION_ACTION = "mobile_app_notification_action"
SIGNAL_UPDATE = f"{DOMAIN}_update"

PHASE_PREPARE = "prepare"
PHASE_START = "start"
PHASE_REPEAT = "repeat"
PHASE_ESCALATE = "escalate"
PHASE_SNOOZE = "snooze"
PHASE_DISMISS = "dismiss"
PHASE_TIMEOUT = "timeout"
PHASE_CLEANUP = "cleanup"
PHASE_SKIPPED = "skipped"
PHASE_ERROR = "error"

NOTIFICATION_EVENTS = (
    PHASE_PREPARE,
    PHASE_START,
    PHASE_REPEAT,
    PHASE_ESCALATE,
    PHASE_SNOOZE,
    PHASE_DISMISS,
    PHASE_TIMEOUT,
    PHASE_SKIPPED,
    "blocked",
    PHASE_ERROR,
)

STATUS_IDLE = "idle"
STATUS_SCHEDULED = "scheduled"
STATUS_DISABLED = "disabled"
STATUS_VACATION = "vacation"
STATUS_PRE_ALARM = "pre_alarm"
STATUS_RINGING = "ringing"
STATUS_SNOOZED = "snoozed"
STATUS_DISMISSED = "dismissed"
STATUS_SKIPPED = "skipped"
STATUS_TIMEOUT = "timeout"
STATUS_ERROR = "error"
STATUS_BLOCKED = "blocked"

ACTIVE_STATUSES = {STATUS_PRE_ALARM, STATUS_RINGING, STATUS_SNOOZED}
TERMINAL_STATUSES = {STATUS_DISMISSED, STATUS_SKIPPED, STATUS_TIMEOUT, STATUS_ERROR}
