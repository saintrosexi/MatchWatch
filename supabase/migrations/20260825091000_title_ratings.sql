-- MatchWatch: личные оценки фильмов.
--
-- Оценка живёт в той же таблице, что и решения: она относится к паре
-- «пользователь + фильм», и отдельная таблица означала бы второй запрос
-- при каждой загрузке состояния ради одного числа.
--
-- Шкала десятибалльная — как у TMDB, чтобы личная оценка и оценка
-- зрителей стояли рядом и читались одинаково.

alter table public.title_history
  add column if not exists rating smallint;

alter table public.title_history
  drop constraint if exists title_history_rating_range;

alter table public.title_history
  add constraint title_history_rating_range
  check (rating is null or (rating >= 1 and rating <= 10));

comment on column public.title_history.rating is
  'Личная оценка 1–10. NULL — фильм не оценивали. Влияет на ленту сильнее свайпа: '
  'это осознанное суждение, а не мгновенная реакция на постер.';

create index if not exists title_history_rated_idx
  on public.title_history (user_id, rating desc nulls last, updated_at desc)
  where rating is not null;
