-- 0018_anniversary_notification_types.sql
-- Run this file ALONE (separately from 0019) — Postgres does not allow a new
-- enum value to be used in the same transaction that adds it.

alter type notification_type add value if not exists 'birthday';
alter type notification_type add value if not exists 'work_anniversary';
