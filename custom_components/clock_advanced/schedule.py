"""Home-Assistant-independent scheduling logic for Clock Advanced."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta


@dataclass(frozen=True, slots=True)
class DaySchedule:
    """One weekday in a weekly schedule."""

    enabled: bool
    alarm_time: time


@dataclass(frozen=True, slots=True)
class WeeklySchedule:
    """A fully generic seven-day schedule."""

    days: tuple[DaySchedule, ...]
    holiday_enabled: bool = True
    holiday_time: time = time(7, 30)
    holiday_weekend_time: time = time(9, 0)
    non_workday_enabled: bool = True
    non_workday_time: time = time(9, 0)

    def __post_init__(self) -> None:
        if len(self.days) != 7:
            raise ValueError("WeeklySchedule requires exactly seven days")


def parse_time(value: str | time) -> time:
    """Parse a Home Assistant time-selector value."""
    if isinstance(value, time):
        return value.replace(tzinfo=None)
    return time.fromisoformat(value)


def time_for_date(
    target_date: date,
    schedule: WeeklySchedule,
    *,
    holiday_mode: bool = False,
    non_workday: bool = False,
) -> time | None:
    """Return the effective alarm time, or None when that day is disabled."""
    day = schedule.days[target_date.weekday()]
    if not day.enabled:
        return None
    if holiday_mode and schedule.holiday_enabled:
        if non_workday or target_date.weekday() >= 5:
            return schedule.holiday_weekend_time
        return schedule.holiday_time
    if non_workday and target_date.weekday() < 5 and schedule.non_workday_enabled:
        return schedule.non_workday_time
    return day.alarm_time


def next_alarm_after(
    now: datetime,
    schedule: WeeklySchedule,
    *,
    enabled: bool = True,
    vacation: bool = False,
    holiday_mode: bool = False,
    non_workday: bool = False,
    manual_alarm: datetime | None = None,
) -> datetime | None:
    """Calculate the next future alarm in Home Assistant's local timezone."""
    if not enabled or vacation:
        return None
    if manual_alarm is not None and manual_alarm > now:
        return manual_alarm

    for day_offset in range(8):
        candidate_date = now.date() + timedelta(days=day_offset)
        alarm_time = time_for_date(
            candidate_date,
            schedule,
            holiday_mode=holiday_mode,
            non_workday=non_workday and day_offset == 0,
        )
        if alarm_time is None:
            continue
        candidate = datetime.combine(candidate_date, alarm_time, tzinfo=now.tzinfo)
        if candidate > now:
            return candidate
    return None
