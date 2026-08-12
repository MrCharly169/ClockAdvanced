"""Deterministic alarm runtime, action phases, and persistence."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers import condition
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_change,
)
from homeassistant.helpers.script import Script, async_validate_actions_config
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    ACTION_PHASES,
    ACTIVE_STATUSES,
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
    CONF_NON_WORKDAY_ENABLED,
    CONF_NON_WORKDAY_TIME,
    CONF_NOTIFICATION_EVENTS,
    CONF_NOTIFICATION_TARGETS,
    CONF_NOTIFICATIONS_ENABLED,
    CONF_REMINDER_DASHBOARD_PATH,
    CONF_REMINDER_ENABLED,
    CONF_REMINDER_TIME,
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
    DEFAULT_NON_WORKDAY_TIME,
    DEFAULT_NOTIFICATION_EVENTS,
    DEFAULT_NOTIFICATIONS_ENABLED,
    DEFAULT_REMINDER_ENABLED,
    DEFAULT_REMINDER_TIME,
    DEFAULT_PRE_ALARM_MINUTES,
    DEFAULT_REPEAT_INTERVAL_MINUTES,
    DEFAULT_SCHEDULE_SOURCE,
    DEFAULT_SNOOZE_MINUTES,
    DEFAULT_TERMINAL_STATE_MINUTES,
    DEFAULT_TIMEOUT_MINUTES,
    DEFAULT_WEEKDAY_TIME,
    DEFAULT_WEEKEND_TIME,
    DOMAIN,
    EVENT_PHASE,
    EVENT_NOTIFICATION_ACTION,
    PHASE_CLEANUP,
    PHASE_DISMISS,
    PHASE_ERROR,
    PHASE_ESCALATE,
    PHASE_PREPARE,
    PHASE_REPEAT,
    PHASE_SKIPPED,
    PHASE_SNOOZE,
    PHASE_START,
    PHASE_TIMEOUT,
    NOTIFICATION_EVENTS,
    SCHEDULE_SOURCE_ENTITY,
    SIGNAL_UPDATE,
    STATUS_DISABLED,
    STATUS_DISMISSED,
    STATUS_ERROR,
    STATUS_BLOCKED,
    STATUS_IDLE,
    STATUS_PRE_ALARM,
    STATUS_RINGING,
    STATUS_SCHEDULED,
    STATUS_SKIPPED,
    STATUS_SNOOZED,
    STATUS_TIMEOUT,
    STATUS_VACATION,
    STORAGE_VERSION,
    WEEKDAYS,
    action_key,
    day_enabled_key,
    day_time_key,
)
from .schedule import DaySchedule, WeeklySchedule, next_alarm_after, parse_time

_LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class ClockState:
    """Minimal restart-safe state."""

    enabled: bool = True
    skip_next: bool = False
    holiday_mode: bool = False
    vacation_mode: bool = False
    status: str = STATUS_IDLE
    manual_alarm: str | None = None
    active_since: str | None = None
    occurrence_alarm: str | None = None
    skipped_alarm: str | None = None
    snooze_until: str | None = None
    repeat_count: int = 0
    snooze_count: int = 0
    escalated: bool = False
    last_phase: str | None = None
    last_reason: str | None = None
    last_error: str | None = None
    schedule_event_token: str | None = None
    card_notification_sent: bool = False
    reminder_sent_for: str | None = None


class ClockRuntime:
    """Own one clock lifecycle and its configurable HA action sequences."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.state = ClockState()
        self.next_alarm: datetime | None = None
        self.pre_alarm_at: datetime | None = None
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}"
        )
        self._scripts: dict[str, Script] = {}
        self._condition_checker: condition.ConditionsChecker | None = None
        self._unsubscribers: list[Callable[[], None]] = []
        self._cancel_alarm: Callable[[], None] | None = None
        self._cancel_pre_alarm: Callable[[], None] | None = None
        self._cancel_repeat: Callable[[], None] | None = None
        self._cancel_timeout: Callable[[], None] | None = None
        self._cancel_status_reset: Callable[[], None] | None = None
        self._cancel_reminder: Callable[[], None] | None = None

    @property
    def config(self) -> dict[str, Any]:
        return {**self.entry.data, **self.entry.options}

    def setting(self, key: str, default: Any) -> Any:
        value = self.config.get(key, default)
        return default if value is None else value

    @property
    def uses_schedule_entity(self) -> bool:
        return (
            self.config.get(CONF_SCHEDULE_SOURCE, DEFAULT_SCHEDULE_SOURCE)
            == SCHEDULE_SOURCE_ENTITY
            and bool(self.config.get(CONF_SCHEDULE_ENTITY))
        )

    @property
    def schedule(self) -> WeeklySchedule:
        config = self.config
        days = []
        for index, day in enumerate(WEEKDAYS):
            default_time = DEFAULT_WEEKDAY_TIME if index < 5 else DEFAULT_WEEKEND_TIME
            days.append(
                DaySchedule(
                    bool(config.get(day_enabled_key(day), True)),
                    parse_time(config.get(day_time_key(day), default_time)),
                )
            )
        return WeeklySchedule(
            tuple(days),
            holiday_enabled=bool(config.get(CONF_HOLIDAY_ENABLED, True)),
            holiday_time=parse_time(config.get(CONF_HOLIDAY_TIME, DEFAULT_HOLIDAY_TIME)),
            non_workday_enabled=bool(config.get(CONF_NON_WORKDAY_ENABLED, True)),
            non_workday_time=parse_time(
                config.get(CONF_NON_WORKDAY_TIME, DEFAULT_NON_WORKDAY_TIME)
            ),
        )

    @property
    def schedule_public(self) -> list[dict[str, Any]]:
        """Return the non-sensitive schedule used by the Card contract."""
        if self.uses_schedule_entity:
            return []
        return [
            {
                "day": day,
                "enabled": item.enabled,
                "time": item.alarm_time.isoformat(),
            }
            for day, item in zip(WEEKDAYS, self.schedule.days, strict=True)
        ]

    @property
    def snooze_available(self) -> bool:
        """Return whether the current ringing session may still be snoozed."""
        maximum = int(self.setting(CONF_MAX_SNOOZES, DEFAULT_MAX_SNOOZES))
        return (
            self.state.status == STATUS_RINGING
            and maximum > 0
            and self.state.snooze_count < maximum
        )

    async def async_start(self) -> None:
        stored = await self._store.async_load()
        if stored:
            allowed = ClockState.__dataclass_fields__.keys()
            self.state = ClockState(
                **{key: value for key, value in stored.items() if key in allowed}
            )
        await self._async_build_scripts()
        self._unsubscribers.extend(
            [
                async_track_time_change(
                    self.hass, self._handle_calendar_refresh, hour=0, minute=0, second=5
                ),
                async_track_time_change(
                    self.hass, self._handle_calendar_refresh, hour=16, minute=0, second=0
                ),
                self.hass.bus.async_listen(
                    EVENT_NOTIFICATION_ACTION, self._handle_notification_action
                ),
            ]
        )
        watched = [
            entity_id
            for entity_id in (
                self.config.get(CONF_WORKDAY_SENSOR),
                self.config.get(CONF_VACATION_ENTITY),
                self.config.get(CONF_CONFIRMATION_SENSOR),
                self.config.get(CONF_ALLOW_ENTITY),
                self.config.get(CONF_BLOCK_ENTITY),
                self.config.get(CONF_SCHEDULE_ENTITY)
                if self.uses_schedule_entity
                else None,
            )
            if entity_id
        ]
        if self._condition_checker is not None:
            self._unsubscribers.append(
                self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._handle_state_change)
            )
            self._unsubscribers.append(
                async_track_time_change(
                    self.hass, self._handle_condition_refresh, second=0
                )
            )
        elif watched:
            self._unsubscribers.append(
                async_track_state_change_event(self.hass, watched, self._handle_state_change)
            )
        if not await self._async_restore_active_session():
            await self.async_refresh_schedule()

    async def async_stop(self) -> None:
        for unsubscribe in self._unsubscribers:
            unsubscribe()
        self._unsubscribers.clear()
        self._cancel_timers()
        for script in self._scripts.values():
            await script.async_unload()
        if self._condition_checker is not None:
            self._condition_checker.async_unload()
            self._condition_checker = None
        await self._store.async_save(asdict(self.state))

    async def _async_build_scripts(self) -> None:
        for phase in ACTION_PHASES:
            sequence = self.config.get(action_key(phase)) or []
            validated = await async_validate_actions_config(self.hass, list(sequence))
            self._scripts[phase] = Script(
                self.hass,
                validated,
                f"{self.entry.title}: {phase}",
                DOMAIN,
                script_mode="parallel",
                max_runs=10,
            )
        raw_conditions = self.config.get(CONF_START_CONDITIONS) or []
        if isinstance(raw_conditions, dict):
            raw_conditions = [raw_conditions]
        if raw_conditions:
            validated = await condition.async_validate_conditions_config(
                self.hass, list(raw_conditions)
            )
            self._condition_checker = await condition.async_conditions_from_config(
                self.hass,
                validated,
                _LOGGER,
                f"{self.entry.title}: alarm start",
            )

    def _state_is_on(self, entity_id: str | None) -> bool:
        return bool(entity_id and self.hass.states.is_state(entity_id, "on"))

    def _state_matches(self, entity_id: str | None, expected: str) -> bool:
        state = self.hass.states.get(entity_id) if entity_id else None
        return state is not None and state.state == expected

    def _guard_block_reason(self) -> str | None:
        config = self.config
        if self.state.vacation_mode or self._state_is_on(
            config.get(CONF_VACATION_ENTITY)
        ):
            return "vacation"
        workday = config.get(CONF_WORKDAY_SENSOR)
        if (
            bool(config.get(CONF_BLOCK_NON_WORKDAYS, False))
            and workday
            and self.hass.states.is_state(workday, "off")
        ):
            return "non_workday"
        allow_entity = config.get(CONF_ALLOW_ENTITY)
        if allow_entity and not self._state_matches(
            allow_entity, str(config.get(CONF_ALLOW_STATE, DEFAULT_ALLOW_STATE))
        ):
            return "allow_condition"
        block_entity = config.get(CONF_BLOCK_ENTITY)
        if block_entity and self._state_matches(
            block_entity, str(config.get(CONF_BLOCK_STATE, DEFAULT_BLOCK_STATE))
        ):
            return "block_condition"
        if self._condition_checker is not None and not self._condition_checker(
            {"clock_advanced": self._event_data()}
        ):
            return "start_conditions"
        return None

    def _parse_datetime(self, value: str | datetime | None) -> datetime | None:
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt_util.now().tzinfo)
        return parsed

    @staticmethod
    def _schedule_event_token(schedule_state) -> str | None:
        """Return a stable identifier for the current Schedule-helper block."""
        if schedule_state is None:
            return None
        changed = schedule_state.last_changed or schedule_state.last_updated
        return changed.isoformat() if changed is not None else None

    async def async_mark_card_notification_sent(self) -> None:
        """Persist that onboarding help was delivered successfully."""
        self.state.card_notification_sent = True
        await self._store.async_save(asdict(self.state))

    async def _async_restore_active_session(self) -> bool:
        if self.state.status not in ACTIVE_STATUSES:
            return False
        now = dt_util.now()
        if self.state.status == STATUS_PRE_ALARM:
            occurrence = self._parse_datetime(self.state.occurrence_alarm)
            if occurrence and occurrence > now:
                self.next_alarm = occurrence
                self._cancel_alarm = async_track_point_in_utc_time(
                    self.hass, self._handle_alarm_due, occurrence.astimezone(UTC)
                )
                self._updated()
                return True
            await self._async_alarm_due("schedule")
            return True
        active_since = self._parse_datetime(self.state.active_since)
        if active_since is None:
            self.state.status = STATUS_ERROR
            self.state.last_error = "active_session_missing_start"
            self.state.active_since = None
            await self.async_refresh_schedule()
            self.state.status = STATUS_ERROR
            self._schedule_status_reset()
            self._updated()
            return True
        timeout_at = active_since + timedelta(
            minutes=int(self.setting(CONF_TIMEOUT_MINUTES, DEFAULT_TIMEOUT_MINUTES))
        )
        if timeout_at <= now:
            await self.async_dismiss("timeout", timed_out=True)
            return True
        self._arm_timeout(timeout_at)
        snooze_until = self._parse_datetime(self.state.snooze_until)
        if self.state.status == STATUS_SNOOZED and snooze_until and snooze_until > now:
            self._cancel_alarm = async_track_point_in_utc_time(
                self.hass, self._handle_snooze_due, snooze_until.astimezone(UTC)
            )
        else:
            self.state.status = STATUS_RINGING
            self.state.snooze_until = None
            self._schedule_repeat()
        self._updated()
        return True

    def _manual_alarm(self) -> datetime | None:
        return self._parse_datetime(self.state.manual_alarm)

    async def async_refresh_schedule(self, *, clear_manual: bool = False) -> None:
        if self.state.status in ACTIVE_STATUSES:
            self._updated()
            return
        previous_status = self.state.status
        previous_reason = self.state.last_reason
        if clear_manual:
            self.state.manual_alarm = None
        now = dt_util.now()
        manual = self._manual_alarm()
        if manual is not None and manual <= now:
            self.state.manual_alarm = None
            manual = None
        block_reason = self._guard_block_reason()
        workday_sensor = self.config.get(CONF_WORKDAY_SENSOR)
        non_workday = bool(
            workday_sensor and self.hass.states.is_state(workday_sensor, "off")
        )
        skipped_alarm = self._parse_datetime(self.state.skipped_alarm)
        if skipped_alarm is not None and skipped_alarm <= now:
            self.state.skipped_alarm = None
            skipped_alarm = None
        self.pre_alarm_at = None
        self._cancel_schedule_timers()
        if not self.state.enabled:
            self.next_alarm = None
            self.state.status = STATUS_DISABLED
        elif block_reason == "vacation":
            self.next_alarm = None
            self.state.status = STATUS_VACATION
            self.state.last_reason = block_reason
        elif block_reason:
            self.next_alarm = None
            self.state.status = STATUS_BLOCKED
            self.state.last_reason = block_reason
        else:
            if manual is not None:
                self.next_alarm = manual
            elif self.uses_schedule_entity:
                schedule_state = self.hass.states.get(
                    self.config.get(CONF_SCHEDULE_ENTITY)
                )
                if schedule_state is not None and schedule_state.state == "on":
                    token = self._schedule_event_token(schedule_state)
                    if token and token != self.state.schedule_event_token:
                        self.state.schedule_event_token = token
                        await self._async_alarm_due(SCHEDULE_SOURCE_ENTITY)
                        return
                    self.next_alarm = None
                else:
                    self.next_alarm = (
                        self._parse_datetime(schedule_state.attributes.get("next_event"))
                        if schedule_state is not None
                        else None
                    )
            else:
                self.next_alarm = next_alarm_after(
                    now,
                    self.schedule,
                    enabled=True,
                    vacation=False,
                    holiday_mode=self.state.holiday_mode,
                    non_workday=non_workday,
                    manual_alarm=None,
                )
                if (
                    skipped_alarm is not None
                    and self.next_alarm is not None
                    and self.next_alarm <= skipped_alarm
                ):
                    self.next_alarm = next_alarm_after(
                        skipped_alarm,
                        self.schedule,
                        enabled=True,
                        vacation=False,
                        holiday_mode=self.state.holiday_mode,
                        non_workday=False,
                    )

            if self.next_alarm is None:
                self.state.status = STATUS_IDLE
            else:
                self.state.status = STATUS_SCHEDULED
                self.state.last_reason = None
                pre_minutes = int(
                    self.setting(CONF_PRE_ALARM_MINUTES, DEFAULT_PRE_ALARM_MINUTES)
                )
                candidate = self.next_alarm - timedelta(minutes=pre_minutes)
                if pre_minutes > 0 and candidate > now:
                    self.pre_alarm_at = candidate
                    self._cancel_pre_alarm = async_track_point_in_utc_time(
                        self.hass, self._handle_pre_alarm_due, candidate.astimezone(UTC)
                    )
                if manual is not None or not self.uses_schedule_entity:
                    self._cancel_alarm = async_track_point_in_utc_time(
                        self.hass, self._handle_alarm_due, self.next_alarm.astimezone(UTC)
                    )
        if (
            self.state.status in {STATUS_BLOCKED, STATUS_VACATION}
            and (previous_status != self.state.status or previous_reason != block_reason)
        ):
            self._launch_notification("blocked", reason=block_reason)
        self._schedule_next_alarm_reminder()
        self._updated()

    async def async_set_enabled(self, enabled: bool) -> None:
        self.state.enabled = enabled
        if not enabled and self.state.status in ACTIVE_STATUSES:
            await self.async_dismiss("disabled")
        else:
            await self.async_refresh_schedule()

    async def async_set_skip_next(self, skip: bool) -> None:
        self.state.skip_next = skip
        if skip and self.state.status == STATUS_PRE_ALARM:
            await self._async_skip_occurrence()
        else:
            self._updated()

    async def async_set_holiday_mode(self, enabled: bool) -> None:
        self.state.holiday_mode = enabled
        await self.async_refresh_schedule()

    async def async_set_vacation_mode(self, enabled: bool) -> None:
        """Enable or disable the integration-owned vacation blocker."""
        self.state.vacation_mode = enabled
        if enabled and self.state.status in ACTIVE_STATUSES:
            await self.async_dismiss("vacation")
        else:
            await self.async_refresh_schedule()

    async def async_set_manual_alarm(self, value: datetime) -> None:
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt_util.now().tzinfo)
        self.state.manual_alarm = value.isoformat()
        await self.async_refresh_schedule()

    async def async_recalculate_schedule(self) -> None:
        """Clear a one-time override and recalculate the recurring source."""
        self.state.skipped_alarm = None
        self.state.skip_next = False
        await self.async_refresh_schedule(clear_manual=True)

    async def async_snooze(self) -> None:
        if self.state.status != STATUS_RINGING:
            return
        maximum = int(self.setting(CONF_MAX_SNOOZES, DEFAULT_MAX_SNOOZES))
        if maximum == 0 or self.state.snooze_count >= maximum:
            return
        self.state.snooze_count += 1
        self.state.status = STATUS_SNOOZED
        self.state.repeat_count = 0
        self._cancel_named("_cancel_repeat")
        snooze_until = dt_util.now() + timedelta(
            minutes=int(self.setting(CONF_SNOOZE_MINUTES, DEFAULT_SNOOZE_MINUTES))
        )
        self.state.snooze_until = snooze_until.isoformat()
        self._cancel_named("_cancel_alarm")
        self._cancel_alarm = async_track_point_in_utc_time(
            self.hass, self._handle_snooze_due, snooze_until.astimezone(UTC)
        )
        self._launch_phase(PHASE_SNOOZE)
        self._updated()

    async def async_dismiss(self, reason: str = "manual", *, timed_out: bool = False) -> None:
        was_active = self.state.status in ACTIVE_STATUSES
        if not was_active:
            return
        self._cancel_timers()
        self.state.status = STATUS_TIMEOUT if timed_out else STATUS_DISMISSED
        self.state.last_reason = reason
        self.state.snooze_until = None
        self.state.manual_alarm = None
        self.state.occurrence_alarm = None
        self.next_alarm = None
        self.pre_alarm_at = None
        if was_active:
            phase = PHASE_TIMEOUT if timed_out else PHASE_DISMISS
            self.hass.async_create_task(self._async_terminal_actions(phase, reason))
        await self.async_refresh_schedule(clear_manual=True)
        self.state.status = STATUS_TIMEOUT if timed_out else STATUS_DISMISSED
        self._schedule_status_reset()
        self._updated()

    async def _async_terminal_actions(self, phase: str, reason: str) -> None:
        self._fire_phase(phase, reason=reason)
        await self._async_run_phase(phase, reason=reason)
        self._fire_phase(PHASE_CLEANUP, reason=reason)
        await self._async_run_phase(PHASE_CLEANUP, reason=reason)
        self._updated()

    @callback
    def _handle_calendar_refresh(self, _now: datetime) -> None:
        self.hass.async_create_task(self.async_refresh_schedule())

    def _schedule_next_alarm_reminder(self) -> None:
        """Arm the customer-facing reminder on the evening before the alarm."""
        self._cancel_named("_cancel_reminder")
        if not bool(self.setting(CONF_REMINDER_ENABLED, DEFAULT_REMINDER_ENABLED)):
            return
        if self.next_alarm is None or self.state.status != STATUS_SCHEDULED:
            return
        alarm = dt_util.as_local(self.next_alarm)
        reminder_clock = parse_time(
            self.setting(CONF_REMINDER_TIME, DEFAULT_REMINDER_TIME)
        )
        reminder_at = datetime.combine(
            alarm.date() - timedelta(days=1),
            reminder_clock,
            tzinfo=alarm.tzinfo,
        )
        token = self.next_alarm.isoformat()
        now = dt_util.now()
        if self.state.reminder_sent_for == token:
            return
        if reminder_at <= now:
            if alarm.date() - now.date() == timedelta(days=1) and alarm > now:
                # Enabling the option after its configured clock time must not
                # silently lose tomorrow's reminder. Mark it before dispatch so
                # rapid entity refreshes cannot enqueue duplicates.
                self.state.reminder_sent_for = token
                self.hass.async_create_task(
                    self._async_send_next_alarm_reminder(token)
                )
            return
        self._cancel_reminder = async_track_point_in_utc_time(
            self.hass,
            self._handle_reminder_due,
            reminder_at.astimezone(UTC),
        )

    @callback
    def _handle_reminder_due(self, _now: datetime) -> None:
        self._cancel_reminder = None
        token = self.next_alarm.isoformat() if self.next_alarm else None
        if token:
            self.hass.async_create_task(self._async_send_next_alarm_reminder(token))

    @callback
    def _handle_notification_action(self, event: Event) -> None:
        """Handle only actions that belong to this clock and exact occurrence."""
        if not bool(self.setting(CONF_REMINDER_ENABLED, DEFAULT_REMINDER_ENABLED)):
            return
        action = str(event.data.get("action") or "")
        prefix = f"CLOCK_ADVANCED:{self.entry.entry_id}:"
        if not action.startswith(prefix):
            return
        parts = action.split(":", 3)
        if len(parts) != 4:
            return
        command, raw_token = parts[2], parts[3]
        try:
            token = int(raw_token)
        except ValueError:
            return
        current = self.next_alarm
        if current is None or int(current.timestamp()) != token:
            return
        if command == "SKIP":
            self.hass.async_create_task(self._async_reminder_skip(token))
        elif command == "CHANGE":
            reply = str(event.data.get("reply_text") or "").strip()
            self.hass.async_create_task(self._async_reminder_change(token, reply))

    async def _async_reminder_skip(self, token: int) -> None:
        if self.next_alarm is None or int(self.next_alarm.timestamp()) != token:
            return
        skipped = dt_util.as_local(self.next_alarm)
        await self._async_skip_occurrence()
        german = (self.hass.config.language or "en").lower().startswith("de")
        time_text = skipped.strftime("%H:%M")
        message = (
            f"Der Wecker um {time_text} wurde ausgelassen."
            if german
            else f"The {time_text} alarm was skipped."
        )
        await self._async_send_reminder_feedback(message)

    async def _async_reminder_change(self, token: int, reply: str) -> None:
        if self.next_alarm is None or int(self.next_alarm.timestamp()) != token:
            return
        german = (self.hass.config.language or "en").lower().startswith("de")
        try:
            new_time = parse_time(reply)
        except (TypeError, ValueError):
            await self._async_send_reminder_feedback(
                "Die Uhrzeit wurde nicht geändert. Bitte HH:MM eingeben."
                if german
                else "The time was not changed. Please enter HH:MM."
            )
            return
        original = self.next_alarm
        replacement = dt_util.as_local(original).replace(
            hour=new_time.hour,
            minute=new_time.minute,
            second=0,
            microsecond=0,
        )
        if replacement <= dt_util.now():
            await self._async_send_reminder_feedback(
                "Die Uhrzeit wurde nicht geändert, weil sie bereits vorbei ist."
                if german
                else "The time was not changed because it is already in the past."
            )
            return
        self.state.skipped_alarm = original.isoformat()
        await self.async_set_manual_alarm(replacement)
        time_text = replacement.strftime("%H:%M")
        await self._async_send_reminder_feedback(
            f"Nur dieser Wecker wurde auf {time_text} geändert. Der Wochenplan bleibt unverändert."
            if german
            else f"Only this alarm was changed to {time_text}. The weekly schedule is unchanged."
        )

    @callback
    def _handle_condition_refresh(self, _now: datetime) -> None:
        """Re-evaluate time/template conditions even without an entity transition."""
        block_reason = self._guard_block_reason()
        if self.state.status in ACTIVE_STATUSES and block_reason:
            self.hass.async_create_task(self.async_dismiss(block_reason))
            return
        guard_state_changed = (
            self.state.status == STATUS_BLOCKED and block_reason is None
        ) or (
            self.state.status not in {STATUS_BLOCKED, STATUS_VACATION}
            and block_reason is not None
        )
        if guard_state_changed:
            self.hass.async_create_task(self.async_refresh_schedule())

    @callback
    def _handle_state_change(self, event: Event[EventStateChangedData]) -> None:
        entity_id = event.data["entity_id"]
        old_state = event.data["old_state"]
        new_state = event.data["new_state"]
        is_on = new_state is not None and new_state.state == "on"
        if entity_id == self.config.get(CONF_SCHEDULE_ENTITY) and self.uses_schedule_entity:
            was_on = old_state is not None and old_state.state == "on"
            manual = self._manual_alarm()
            token = self._schedule_event_token(new_state)
            if (
                is_on
                and not was_on
                and token != self.state.schedule_event_token
                and not (manual and manual > dt_util.now())
                and self.state.status not in {
                    STATUS_RINGING,
                    STATUS_SNOOZED,
                }
            ):
                self.state.schedule_event_token = token
                self.hass.async_create_task(
                    self._async_alarm_due(SCHEDULE_SOURCE_ENTITY)
                )
            elif not is_on:
                self.hass.async_create_task(self.async_refresh_schedule())
            return
        if entity_id == self.config.get(CONF_CONFIRMATION_SENSOR) and is_on:
            if self.state.status in ACTIVE_STATUSES:
                self.hass.async_create_task(self.async_dismiss("confirmation"))
            return
        block_reason = self._guard_block_reason()
        if self.state.status in ACTIVE_STATUSES and block_reason:
            self.hass.async_create_task(self.async_dismiss(block_reason))
            return
        if self._condition_checker is not None:
            guard_state_changed = (
                self.state.status == STATUS_BLOCKED and block_reason is None
            ) or (
                self.state.status not in {STATUS_BLOCKED, STATUS_VACATION}
                and block_reason is not None
            )
            if guard_state_changed:
                self.hass.async_create_task(self.async_refresh_schedule())
                return
        if entity_id in {
            self.config.get(CONF_WORKDAY_SENSOR),
            self.config.get(CONF_VACATION_ENTITY),
            self.config.get(CONF_ALLOW_ENTITY),
            self.config.get(CONF_BLOCK_ENTITY),
        }:
            self.hass.async_create_task(self.async_refresh_schedule())

    @callback
    def _handle_pre_alarm_due(self, _now: datetime) -> None:
        self._cancel_pre_alarm = None
        self.hass.async_create_task(self._async_pre_alarm_due())

    async def _async_pre_alarm_due(self) -> None:
        if self.state.skip_next:
            await self._async_skip_occurrence()
            return
        if not self.state.enabled or self._guard_block_reason():
            await self.async_refresh_schedule(clear_manual=True)
            return
        self.state.status = STATUS_PRE_ALARM
        self.state.occurrence_alarm = (
            self.next_alarm.isoformat() if self.next_alarm else None
        )
        if self._state_is_on(self.config.get(CONF_CONFIRMATION_SENSOR)):
            await self.async_dismiss("confirmation")
            return
        self._launch_phase(PHASE_PREPARE)
        self._updated()

    @callback
    def _handle_alarm_due(self, _now: datetime) -> None:
        self._cancel_alarm = None
        self.hass.async_create_task(self._async_alarm_due("schedule"))

    @callback
    def _handle_snooze_due(self, _now: datetime) -> None:
        self._cancel_alarm = None
        self.hass.async_create_task(self._async_alarm_due("snooze"))

    async def _async_alarm_due(self, trigger_kind: str) -> None:
        if not self.state.enabled or self._guard_block_reason():
            await self.async_refresh_schedule(clear_manual=True)
            return
        if self.state.skip_next and trigger_kind in {"schedule", SCHEDULE_SOURCE_ENTITY}:
            await self._async_skip_occurrence()
            return
        now = dt_util.now()
        if trigger_kind in {"schedule", SCHEDULE_SOURCE_ENTITY}:
            self.state.active_since = now.isoformat()
            self.state.snooze_count = 0
            self.state.repeat_count = 0
            self.state.escalated = False
            self.state.manual_alarm = None
            self._arm_timeout(
                now
                + timedelta(
                    minutes=int(self.setting(CONF_TIMEOUT_MINUTES, DEFAULT_TIMEOUT_MINUTES))
                )
            )
        self.state.status = STATUS_RINGING
        self.state.occurrence_alarm = None
        self.state.snooze_until = None
        self.next_alarm = None
        self.pre_alarm_at = None
        if self._state_is_on(self.config.get(CONF_CONFIRMATION_SENSOR)):
            await self.async_dismiss("confirmation")
            return
        self._launch_phase(PHASE_START, trigger_kind=trigger_kind)
        snooze_threshold = int(
            self.setting(
                CONF_ESCALATE_AFTER_SNOOZES, DEFAULT_ESCALATE_AFTER_SNOOZES
            )
        )
        if (
            trigger_kind == "snooze"
            and snooze_threshold > 0
            and self.state.snooze_count >= snooze_threshold
            and not self.state.escalated
        ):
            self.state.escalated = True
            self._launch_phase(
                PHASE_ESCALATE,
                trigger_kind="snooze",
                snooze_count=self.state.snooze_count,
            )
        self._schedule_repeat()
        self._updated()

    async def _async_skip_occurrence(self) -> None:
        skipped_alarm = self.next_alarm
        self._cancel_timers()
        self.state.skip_next = False
        self.state.status = STATUS_SKIPPED
        self.state.last_reason = "skip_next"
        self.state.manual_alarm = None
        self.state.occurrence_alarm = None
        self.state.skipped_alarm = skipped_alarm.isoformat() if skipped_alarm else None
        self.next_alarm = None
        self.pre_alarm_at = None
        self._fire_phase(PHASE_SKIPPED)
        await self.async_refresh_schedule(clear_manual=True)
        self.state.status = STATUS_SKIPPED
        self._schedule_status_reset()
        self._updated()

    def _schedule_repeat(self) -> None:
        self._cancel_named("_cancel_repeat")
        when = dt_util.now() + timedelta(
            minutes=int(
                self.setting(CONF_REPEAT_INTERVAL_MINUTES, DEFAULT_REPEAT_INTERVAL_MINUTES)
            )
        )
        self._cancel_repeat = async_track_point_in_utc_time(
            self.hass, self._handle_repeat, when.astimezone(UTC)
        )

    @callback
    def _handle_repeat(self, _now: datetime) -> None:
        self._cancel_repeat = None
        if self.state.status != STATUS_RINGING:
            return
        self.state.repeat_count += 1
        self._launch_phase(PHASE_REPEAT)
        threshold = int(
            self.setting(CONF_ESCALATE_AFTER_REPEATS, DEFAULT_ESCALATE_AFTER_REPEATS)
        )
        if threshold > 0 and self.state.repeat_count >= threshold and not self.state.escalated:
            self.state.escalated = True
            self._launch_phase(PHASE_ESCALATE)
        self._schedule_repeat()
        self._updated()

    def _arm_timeout(self, when: datetime) -> None:
        self._cancel_named("_cancel_timeout")
        self._cancel_timeout = async_track_point_in_utc_time(
            self.hass, self._handle_timeout, when.astimezone(UTC)
        )

    @callback
    def _handle_timeout(self, _now: datetime) -> None:
        self._cancel_timeout = None
        self.hass.async_create_task(self.async_dismiss("timeout", timed_out=True))

    def _schedule_status_reset(self) -> None:
        self._cancel_named("_cancel_status_reset")
        when = dt_util.now() + timedelta(
            minutes=int(
                self.setting(CONF_TERMINAL_STATE_MINUTES, DEFAULT_TERMINAL_STATE_MINUTES)
            )
        )
        self._cancel_status_reset = async_track_point_in_utc_time(
            self.hass, self._handle_status_reset, when.astimezone(UTC)
        )

    @callback
    def _handle_status_reset(self, _now: datetime) -> None:
        self._cancel_status_reset = None
        self.state.active_since = None
        self.state.repeat_count = 0
        self.state.snooze_count = 0
        self.state.escalated = False
        self.hass.async_create_task(self.async_refresh_schedule())

    def _launch_phase(self, phase: str, **extra: Any) -> None:
        self._fire_phase(phase, **extra)
        self.hass.async_create_task(self._async_run_phase(phase, **extra))

    def _fire_phase(self, phase: str, **extra: Any) -> None:
        self.state.last_phase = phase
        self.hass.bus.async_fire(EVENT_PHASE, self._event_data(phase=phase, **extra))
        if phase in NOTIFICATION_EVENTS:
            self._launch_notification(phase, **extra)

    def _launch_notification(self, event: str, **extra: Any) -> None:
        """Schedule a configured user notification without delaying the alarm."""
        self.hass.async_create_task(self._async_send_notification(event, **extra))

    def _notification_content(
        self, event: str, extra: dict[str, Any]
    ) -> tuple[str, str]:
        """Return a concise localized title and the reason for a notification."""
        german = (self.hass.config.language or "en").lower().startswith("de")
        event_labels = {
            "prepare": ("Voralarm", "Pre-alarm"),
            "start": ("Wecker gestartet", "Alarm started"),
            "repeat": ("Wecker weiterhin aktiv", "Alarm still active"),
            "escalate": ("Wecker eskaliert", "Alarm escalated"),
            "snooze": ("Schlummern", "Snoozed"),
            "dismiss": ("Wecker beendet", "Alarm dismissed"),
            "timeout": ("Sicherheitsende", "Safety timeout"),
            "skipped": ("Wecker ausgelassen", "Alarm skipped"),
            "blocked": ("Wecker blockiert", "Alarm blocked"),
            "error": ("Fehler", "Error"),
        }
        reason_labels = {
            "manual": ("manuell beendet", "dismissed manually"),
            "confirmation": (
                "durch die Aufstehbestätigung beendet",
                "dismissed by wake confirmation",
            ),
            "vacation": ("Urlaubsmodus ist aktiv", "vacation mode is active"),
            "non_workday": ("heute ist kein Arbeitstag", "today is not a workday"),
            "allow_condition": (
                "die Freigabebedingung ist nicht erfüllt",
                "the allow condition did not pass",
            ),
            "block_condition": (
                "die Sperrbedingung ist erfüllt",
                "the blocking condition matched",
            ),
            "start_conditions": (
                "mindestens eine Startbedingung ist nicht erfüllt",
                "at least one start condition did not pass",
            ),
            "skip_next": (
                "der nächste Termin wurde ausgelassen",
                "the next occurrence was skipped",
            ),
            "timeout": (
                "das eingestellte Sicherheitsende wurde erreicht",
                "the configured safety timeout was reached",
            ),
            "disabled": ("der Wecker wurde deaktiviert", "the alarm clock was disabled"),
        }
        label = event_labels.get(event, (event, event))[0 if german else 1]
        reason = str(extra.get("reason") or self.state.last_reason or "")
        reason_text = reason_labels.get(reason, (reason, reason))[0 if german else 1]
        if event == PHASE_PREPARE:
            minutes = int(self.setting(CONF_PRE_ALARM_MINUTES, DEFAULT_PRE_ALARM_MINUTES))
            message = (
                f"Die Vorbereitung beginnt {minutes} Minuten vor dem Wecker."
                if german
                else f"Preparation starts {minutes} minutes before the alarm."
            )
        elif event == PHASE_START:
            from_snooze = extra.get("trigger_kind") == "snooze"
            message = (
                "Die Schlummerzeit ist vorbei; der Wecker startet erneut."
                if german and from_snooze
                else "Der geplante Wecktermin ist erreicht."
                if german
                else "The snooze period ended; the alarm starts again."
                if from_snooze
                else "The scheduled alarm time has been reached."
            )
        elif event == PHASE_REPEAT:
            message = (
                f"Der Wecker ist noch aktiv (Wiederholung {self.state.repeat_count})."
                if german
                else f"The alarm is still active (repeat {self.state.repeat_count})."
            )
        elif event == PHASE_ESCALATE:
            message = (
                "Die eingestellte Eskalationsgrenze wurde erreicht: "
                f"{self.state.repeat_count} Wiederholungen, "
                f"{self.state.snooze_count}× Schlummern."
                if german
                else "The configured escalation threshold was reached: "
                f"{self.state.repeat_count} repeats, "
                f"{self.state.snooze_count} snoozes."
            )
        elif event == PHASE_SNOOZE:
            until = self._parse_datetime(self.state.snooze_until)
            moment = dt_util.as_local(until).strftime("%H:%M") if until else "–"
            message = (
                f"Schlummern {self.state.snooze_count} von "
                f"{self.setting(CONF_MAX_SNOOZES, DEFAULT_MAX_SNOOZES)} "
                f"bis {moment}."
                if german
                else f"Snooze {self.state.snooze_count} of "
                f"{self.setting(CONF_MAX_SNOOZES, DEFAULT_MAX_SNOOZES)} "
                f"until {moment}."
            )
        elif event in {PHASE_DISMISS, PHASE_TIMEOUT, PHASE_SKIPPED, "blocked"}:
            message = (
                f"Grund: {reason_text or label}."
                if german
                else f"Reason: {reason_text or label}."
            )
        elif event == PHASE_ERROR:
            failed = extra.get("failed_phase") or "unknown"
            message = (
                f"Die Aktion „{failed}“ ist fehlgeschlagen. Details stehen im "
                "Home-Assistant-Protokoll."
                if german
                else f'The "{failed}" action failed. Details are available in the '
                "Home Assistant log."
            )
        else:
            message = label
        return f"{self.entry.title}: {label}", message

    async def _async_send_notification(self, event: str, **extra: Any) -> None:
        """Send to selected notify entities or the HA notification inbox."""
        if not bool(
            self.setting(CONF_NOTIFICATIONS_ENABLED, DEFAULT_NOTIFICATIONS_ENABLED)
        ):
            return
        selected = self.setting(CONF_NOTIFICATION_EVENTS, DEFAULT_NOTIFICATION_EVENTS)
        if event not in selected:
            return
        title, message = self._notification_content(event, extra)
        targets = self.config.get(CONF_NOTIFICATION_TARGETS) or []
        if isinstance(targets, str):
            targets = [targets]
        try:
            if targets:
                await self.hass.services.async_call(
                    "notify",
                    "send_message",
                    {"title": title, "message": message},
                    target={"entity_id": list(targets)},
                    blocking=False,
                )
            else:
                await self.hass.services.async_call(
                    "persistent_notification",
                    "create",
                    {
                        "title": title,
                        "message": message,
                        "notification_id": (
                            f"clock_advanced_{self.entry.entry_id}_{event}"
                        ),
                    },
                    blocking=False,
                )
        except Exception:
            _LOGGER.exception("Clock Advanced notification %s failed", event)

    def _dashboard_path(self) -> str:
        path = str(self.config.get(CONF_REMINDER_DASHBOARD_PATH) or "").strip()
        return path if path.startswith("/") else "/config/integrations/integration/clock_advanced"

    async def _async_send_next_alarm_reminder(self, token: str) -> None:
        """Send one actionable reminder for the exact upcoming occurrence."""
        if self.next_alarm is None or self.next_alarm.isoformat() != token:
            return
        alarm = dt_util.as_local(self.next_alarm)
        german = (self.hass.config.language or "en").lower().startswith("de")
        title = (
            f"{self.entry.title}: nächster Wecker"
            if german
            else f"{self.entry.title}: next alarm"
        )
        message = (
            f"Der nächste Wecker ist morgen, {alarm:%d.%m.}, um {alarm:%H:%M} Uhr."
            if german
            else f"The next alarm is tomorrow, {alarm:%d/%m}, at {alarm:%H:%M}."
        )
        reason = self._guard_block_reason()
        if reason:
            reason_text = self._notification_content("blocked", {"reason": reason})[1]
            message = f"{message}\n\n{reason_text}"
        timestamp = int(self.next_alarm.timestamp())
        path = self._dashboard_path()
        actions = [
            {
                "action": f"CLOCK_ADVANCED:{self.entry.entry_id}:SKIP:{timestamp}",
                "title": "Auslassen" if german else "Skip",
                "destructive": True,
            },
            {
                "action": f"CLOCK_ADVANCED:{self.entry.entry_id}:CHANGE:{timestamp}",
                "title": "Zeit ändern" if german else "Change time",
                "behavior": "textInput",
                "textInputButtonTitle": "Ändern" if german else "Change",
                "textInputPlaceholder": "HH:MM",
            },
            {
                "action": "URI",
                "title": "Clock öffnen" if german else "Open Clock",
                "uri": path,
            },
        ]
        await self._async_deliver_reminder(title, message, path, actions)
        self.state.reminder_sent_for = token
        self._updated()

    async def _async_send_reminder_feedback(self, message: str) -> None:
        german = (self.hass.config.language or "en").lower().startswith("de")
        title = (
            f"{self.entry.title}: Wecker aktualisiert"
            if german
            else f"{self.entry.title}: alarm updated"
        )
        await self._async_deliver_reminder(
            title,
            message,
            self._dashboard_path(),
            [],
        )

    async def _async_deliver_reminder(
        self,
        title: str,
        message: str,
        path: str,
        actions: list[dict[str, Any]],
    ) -> None:
        targets = self.config.get(CONF_NOTIFICATION_TARGETS) or []
        if isinstance(targets, str):
            targets = [targets]
        try:
            if targets:
                await self.hass.services.async_call(
                    "notify",
                    "send_message",
                    {
                        "title": title,
                        "message": message,
                        "data": {
                            "url": path,
                            "clickAction": path,
                            "tag": f"clock_advanced_{self.entry.entry_id}_next_alarm",
                            "actions": actions,
                        },
                    },
                    target={"entity_id": list(targets)},
                    blocking=False,
                )
            else:
                await self.hass.services.async_call(
                    "persistent_notification",
                    "create",
                    {
                        "title": title,
                        "message": f"{message}\n\n[Clock öffnen]({path})",
                        "notification_id": (
                            f"clock_advanced_{self.entry.entry_id}_next_alarm"
                        ),
                    },
                    blocking=False,
                )
        except Exception:
            _LOGGER.exception("Clock Advanced next-alarm reminder failed")

    async def _async_run_phase(self, phase: str, **extra: Any) -> None:
        script = self._scripts.get(phase)
        if script is None or not script.sequence:
            return
        try:
            await script.async_run({"clock_advanced": self._event_data(phase=phase, **extra)})
        except Exception as exc:  # Home Assistant logs the full script trace.
            _LOGGER.exception("Clock Advanced action phase %s failed", phase)
            self.state.last_error = f"{phase}: {type(exc).__name__}: {exc}"
            self._fire_phase(PHASE_ERROR, failed_phase=phase)
            self._updated()

    def _event_data(self, **extra: Any) -> dict[str, Any]:
        return {
            "contract_version": 1,
            "config_entry_id": self.entry.entry_id,
            "name": self.entry.title,
            "status": self.state.status,
            "next_alarm": self.next_alarm.isoformat() if self.next_alarm else None,
            "repeat_count": self.state.repeat_count,
            "snooze_count": self.state.snooze_count,
            "escalated": self.state.escalated,
            **extra,
        }

    def _updated(self) -> None:
        self._store.async_delay_save(lambda: asdict(self.state), 1)
        async_dispatcher_send(self.hass, f"{SIGNAL_UPDATE}_{self.entry.entry_id}")

    def _cancel_named(self, attribute: str) -> None:
        cancel = getattr(self, attribute)
        if cancel:
            cancel()
            setattr(self, attribute, None)

    def _cancel_schedule_timers(self) -> None:
        self._cancel_named("_cancel_alarm")
        self._cancel_named("_cancel_pre_alarm")
        self._cancel_named("_cancel_reminder")

    def _cancel_timers(self) -> None:
        for attribute in (
            "_cancel_alarm",
            "_cancel_pre_alarm",
            "_cancel_repeat",
            "_cancel_timeout",
            "_cancel_status_reset",
            "_cancel_reminder",
        ):
            self._cancel_named(attribute)
