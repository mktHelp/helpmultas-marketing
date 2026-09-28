-- 0047_social_link_slug_roberson.sql
-- Second link_slug for the click-tracking feature added in 0046: the link
-- in @roberson.alvarenga's Instagram bio, redirected through
-- /ig-roberson on the landing site (see src/pages/BioRoberson.tsx there).

update social_accounts set link_slug = 'roberson' where label = 'Roberson Alvarenga (pessoal)';
