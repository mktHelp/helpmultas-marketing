-- 0025_fix_creatives_fk_name.sql — renaming the table in 0024 did not rename
-- its constraints, so the delivered_by FK is still named
-- project_creatives_delivered_by_fkey. The app queries it by name
-- (creatives_delivered_by_fkey) via PostgREST's embed syntax, so align it.

alter table creatives rename constraint project_creatives_delivered_by_fkey to creatives_delivered_by_fkey;
