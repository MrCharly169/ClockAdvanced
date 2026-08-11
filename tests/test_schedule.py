"""Tests for Clock Advanced's pure schedule contract."""

from datetime import datetime, time
import importlib.util
from pathlib import Path
import sys
import unittest
from zoneinfo import ZoneInfo

MODULE_PATH = Path(__file__).parents[1] / "custom_components" / "clock_advanced" / "schedule.py"
SPEC = importlib.util.spec_from_file_location("clock_advanced_schedule", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
schedule_module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = schedule_module
SPEC.loader.exec_module(schedule_module)

DaySchedule = schedule_module.DaySchedule
WeeklySchedule = schedule_module.WeeklySchedule
next_alarm_after = schedule_module.next_alarm_after
time_for_date = schedule_module.time_for_date


class ScheduleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.schedule = WeeklySchedule(
            days=(
                DaySchedule(True, time(6, 0)),
                DaySchedule(True, time(6, 15)),
                DaySchedule(True, time(6, 30)),
                DaySchedule(True, time(7, 0)),
                DaySchedule(True, time(7, 15)),
                DaySchedule(False, time(8, 0)),
                DaySchedule(True, time(8, 30)),
            ),
            holiday_enabled=True,
            holiday_time=time(7, 30),
            non_workday_enabled=True,
            non_workday_time=time(9, 0),
        )

    def test_each_weekday_is_independent(self) -> None:
        monday = datetime(2026, 8, 10).date()
        tuesday = datetime(2026, 8, 11).date()
        self.assertEqual(time_for_date(monday, self.schedule), time(6, 0))
        self.assertEqual(time_for_date(tuesday, self.schedule), time(6, 15))

    def test_disabled_day_is_skipped(self) -> None:
        now = datetime.fromisoformat("2026-08-14T23:00:00+02:00")
        self.assertEqual(
            next_alarm_after(now, self.schedule),
            datetime.fromisoformat("2026-08-16T08:30:00+02:00"),
        )

    def test_holiday_override_respects_disabled_day(self) -> None:
        saturday = datetime(2026, 8, 15).date()
        sunday = datetime(2026, 8, 16).date()
        self.assertIsNone(time_for_date(saturday, self.schedule, holiday_mode=True))
        self.assertEqual(
            time_for_date(sunday, self.schedule, holiday_mode=True), time(7, 30)
        )

    def test_non_workday_override_is_only_applied_to_today(self) -> None:
        now = datetime.fromisoformat("2026-08-10T08:00:00+02:00")
        self.assertEqual(
            next_alarm_after(now, self.schedule, non_workday=True),
            datetime.fromisoformat("2026-08-10T09:00:00+02:00"),
        )
        late = datetime.fromisoformat("2026-08-10T10:00:00+02:00")
        self.assertEqual(
            next_alarm_after(late, self.schedule, non_workday=True),
            datetime.fromisoformat("2026-08-11T06:15:00+02:00"),
        )

    def test_manual_alarm_overrides_weekly_occurrence(self) -> None:
        now = datetime.fromisoformat("2026-08-10T05:00:00+02:00")
        manual = datetime.fromisoformat("2026-08-10T05:15:00+02:00")
        self.assertEqual(next_alarm_after(now, self.schedule, manual_alarm=manual), manual)

    def test_vacation_and_disabled_have_no_alarm(self) -> None:
        now = datetime.fromisoformat("2026-08-10T05:00:00+02:00")
        self.assertIsNone(next_alarm_after(now, self.schedule, vacation=True))
        self.assertIsNone(next_alarm_after(now, self.schedule, enabled=False))

    def test_all_days_disabled_has_no_alarm(self) -> None:
        schedule = WeeklySchedule(tuple(DaySchedule(False, time(6)) for _ in range(7)))
        self.assertIsNone(next_alarm_after(datetime.now().astimezone(), schedule))

    def test_next_alarm_uses_target_date_dst_offset(self) -> None:
        zone = ZoneInfo("Europe/Luxembourg")
        now = datetime(2026, 10, 24, 9, 0, tzinfo=zone)
        result = next_alarm_after(now, self.schedule)
        assert result is not None
        self.assertEqual(result, datetime(2026, 10, 25, 8, 30, tzinfo=zone))
        self.assertEqual(result.utcoffset().total_seconds(), 3600)


if __name__ == "__main__":
    unittest.main()
