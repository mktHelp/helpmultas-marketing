-- 0048_social_link_clicks_dedup.sql
-- Instagram/Facebook's in-app browser fires the link-in-bio redirect page
-- (and therefore the click beacon) multiple times per real tap — once for
-- its own link-safety/preview check and again for the actual navigation,
-- each hop reporting a different referrer (facebook.com, l.instagram.com,
-- m.facebook.com). Storing the requester IP lets the ingest route collapse
-- those into a single click (see src/app/api/social/link-clicks/route.ts).

alter table social_link_clicks add column ip text;

create index idx_social_link_clicks_account_ip_recent
  on social_link_clicks(account_id, ip, clicked_at desc);
