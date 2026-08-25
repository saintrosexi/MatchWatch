-- MatchWatch: журнал телеметрии и продуктовая аналитика.
--
-- Три независимых потока, которые часто смешивают:
--   ops_events  — исключения кода И сбои логики (последние обычный
--                 error-трекер не ловит: «комната не найдена», «TMDB пусто»);
--   ops_metrics — продуктовые события для дашборда;
--   ops_signups — когорты, без них retention D1/D7 не из чего считать.

create table public.ops_events (
  id           bigint generated always as identity primary key,
  environment  text not null default 'prod' check (environment in ('dev', 'staging', 'prod')),
  kind         text not null check (kind in ('error', 'business')),
  name         text not null,
  module       text not null,
  level        text not null check (level in ('critical', 'error', 'warning', 'info')),
  user_id      uuid references auth.users(id) on delete set null,
  room_code    text,
  message      text,
  stack        text,
  context      jsonb not null default '{}'::jsonb,
  online       boolean,
  created_at   timestamptz not null default now()
);

create index ops_events_recent_idx on public.ops_events (environment, created_at desc);
create index ops_events_name_idx on public.ops_events (environment, kind, name, created_at desc);

create table public.ops_metrics (
  id           bigint generated always as identity primary key,
  environment  text not null default 'prod',
  name         text not null,
  user_id      uuid references auth.users(id) on delete set null,
  room_code    text,
  value        integer not null default 1,
  context      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index ops_metrics_recent_idx on public.ops_metrics (environment, name, created_at desc);
create index ops_metrics_dau_idx on public.ops_metrics (environment, created_at, user_id);

create table public.ops_signups (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  environment  text not null default 'prod',
  provider     text,
  created_at   timestamptz not null default now()
);

create index ops_signups_cohort_idx on public.ops_signups (environment, created_at);

-- ── Дашборд ──────────────────────────────────────────────────────────
-- Метрики считаются SQL-запросом, а не инкрементом счётчиков вручную:
-- агрегаты выводятся из сырых событий и пересчитываются задним числом.

create or replace view public.ops_daily as
select
  environment,
  date_trunc('day', created_at)::date                                as day,
  count(*) filter (where name = 'swipe')                             as swipes,
  count(*) filter (where name = 'match')                             as matches,
  count(*) filter (where name = 'room_created')                      as rooms_created,
  count(*) filter (where name = 'room_joined')                       as rooms_joined,
  count(*) filter (where name = 'room_invite_sent')                  as invites_sent,
  count(*) filter (where name = 'watchlist_add')                     as watchlist_adds,
  count(*) filter (where name = 'roulette_spin')                     as roulette_spins,
  count(distinct user_id)                                            as dau
from public.ops_metrics
group by environment, day;

comment on view public.ops_daily is 'Суточные продуктовые метрики для дашборда.';

-- Retention D1/D7: доля когорты, вернувшаяся на следующий день и через неделю.
create or replace function public.ops_retention(p_environment text, p_days integer default 14)
returns table (cohort_day date, cohort_size bigint, d1 numeric, d7 numeric)
language sql
stable
security definer
set search_path = public
as $$
  with cohorts as (
    select user_id, date_trunc('day', created_at)::date as cohort_day
    from public.ops_signups
    where environment = p_environment
      and created_at >= now() - make_interval(days => p_days)
  ),
  activity as (
    select distinct user_id, date_trunc('day', created_at)::date as active_day
    from public.ops_metrics
    where environment = p_environment
      and created_at >= now() - make_interval(days => p_days + 8)
  )
  select
    c.cohort_day,
    count(distinct c.user_id) as cohort_size,
    round(100.0 * count(distinct a1.user_id) / nullif(count(distinct c.user_id), 0), 2) as d1,
    round(100.0 * count(distinct a7.user_id) / nullif(count(distinct c.user_id), 0), 2) as d7
  from cohorts c
  left join activity a1 on a1.user_id = c.user_id and a1.active_day = c.cohort_day + 1
  left join activity a7 on a7.user_id = c.user_id and a7.active_day = c.cohort_day + 7
  group by c.cohort_day
  order by c.cohort_day desc;
$$;

-- Топ самых частых ошибок за период — чинить по частоте, а не по ощущениям.
create or replace function public.ops_top_failures(
  p_environment text,
  p_kind text,
  p_days integer default 7,
  p_limit integer default 5
)
returns table (name text, module text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.name, e.module, count(*) as total
  from public.ops_events e
  where e.environment = p_environment
    and e.kind = p_kind
    and e.created_at >= now() - make_interval(days => p_days)
  group by e.name, e.module
  order by total desc
  limit p_limit;
$$;
