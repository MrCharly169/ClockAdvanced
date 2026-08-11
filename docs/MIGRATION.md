# Migration from an automation and helper Card

1. Record the current schedule, guards, notification actions and every physical output.
2. Create one Clock Advanced entry with the same schedule while leaving all action phases empty.
3. Verify `next_alarm`, skip, holiday and vacation behavior for at least one complete cycle.
4. Move actions into `prepare`, `start`, `repeat`, `escalate`, `timeout` and `cleanup` in small groups.
5. Test snooze and confirmation explicitly; they are separate state transitions.
6. Add the bundled Card and verify its control entity map.
7. Disable the old automation only after the regression checklist passes. Keep an export until the new clock has run reliably.

Do not place private entity IDs into integration source, translations, Card code or public diagnostics.
