-- 0038_goals_content_published_metric.sql
-- Goals were originally generic ("tasks completed" / "on-time rate"), but
-- the real use case is content volume — e.g. "post 4 Instagram stories
-- this week". Adds a metric that counts tasks of a given content_type
-- published (publish_at) within the goal's period.

-- Run this ALTER TYPE on its own first (Postgres won't let a new enum
-- value be used — even inside a CHECK constraint — in the same
-- transaction that added it).
alter type goal_metric add value if not exists 'content_published';
