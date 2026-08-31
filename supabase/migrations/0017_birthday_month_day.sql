-- 0017_birthday_month_day.sql — Muitos aniversários são cadastrados sem
-- saber o ano de nascimento, então a data vira dia+mês em vez de uma
-- coluna `date` completa.

alter table birthdays add column birth_month smallint;
alter table birthdays add column birth_day smallint;

update birthdays
set birth_month = extract(month from birth_date)::smallint,
    birth_day = extract(day from birth_date)::smallint;

alter table birthdays alter column birth_month set not null;
alter table birthdays alter column birth_day set not null;
alter table birthdays add constraint birthdays_month_check check (birth_month between 1 and 12);
alter table birthdays add constraint birthdays_day_check check (birth_day between 1 and 31);

alter table birthdays drop column birth_date;

NOTIFY pgrst, 'reload schema';
