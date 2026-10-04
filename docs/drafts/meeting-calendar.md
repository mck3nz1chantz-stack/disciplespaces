# Meeting calendar (2026-10-04)

One `Session` row is still one meeting. No new table. No fifth tab.

| Field | Meaning |
| --- | --- |
| `date` | Next day for a weekly plan, or the only day. Existing ISO strings stay. Noon stamps are not a start time. |
| `startTime?` | Local `HH:mm`. Missing means the day with no time. |
| `weekly?` | Same weekday and time. The next date is computed. Passed weeks are not new rows. |
| `heldDates?` | `{ date: yyyy-MM-dd, startTime? }[]`. Frozen when a week passes, before a time or weekly change. Newest 52. |

A day with no time stays under Upcoming until the next local midnight. A timed meeting moves to Past one minute after its start. Changing time or the weekly rule changes Upcoming only. `heldDates` keep the day and time they used.

These fields travel on the shared room and in Save a copy / Open a copy. Private notes stay off the room.

Interface words: Upcoming, Past, “No meeting planned”, Plan a meeting. No “relay”, “DSP1”, or “snapshot”.
