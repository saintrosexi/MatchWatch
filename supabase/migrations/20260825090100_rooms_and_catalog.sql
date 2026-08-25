-- MatchWatch: совместные комнаты и кэш каталога TMDB.

create table public.rooms (
  code              text primary key check (code ~ '^[A-Z0-9]{4}$'),
  created_by        uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  -- TTL: 4-значных кодов конечное число, без уборки они начнут конфликтовать.
  expires_at        timestamptz not null default now() + interval '6 hours',
  status            text not null default 'open' check (status in ('open', 'closed')),
  filters           jsonb,
  deck              jsonb not null default '[]'::jsonb
);

create index rooms_expiry_idx on public.rooms (expires_at);

comment on table public.rooms is
  'Комната. Код всегда 4 символа в верхнем регистре — ограничение на уровне БД.';

create table public.room_members (
  room_code     text not null references public.rooms(code) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text,
  photo_url     text,
  is_host       boolean not null default false,
  online        boolean not null default true,
  -- Компактный профиль вкуса для расчёта компромисса комнаты.
  taste         jsonb,
  joined_at     timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  primary key (room_code, user_id)
);

create index room_members_user_idx on public.room_members (user_id);

create table public.room_swipes (
  room_code   text not null references public.rooms(code) on delete cascade,
  title_id    text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null check (action in ('like', 'pass')),
  created_at  timestamptz not null default now(),
  primary key (room_code, title_id, user_id)
);

comment on table public.room_swipes is
  'Голос участника. Первичный ключ делает повторный свайп идемпотентным, '
  'а одновременный свайп двоих — двумя независимыми строками без гонки.';

create table public.room_matches (
  room_code     text not null references public.rooms(code) on delete cascade,
  title_id      text not null,
  title         jsonb not null,
  participants  uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  primary key (room_code, title_id)
);

create table public.room_watchlist (
  room_code   text not null references public.rooms(code) on delete cascade,
  title_id    text not null,
  title       jsonb not null,
  added_by    uuid references auth.users(id) on delete set null,
  from_match  boolean not null default false,
  watched     boolean not null default false,
  watched_at  timestamptz,
  added_at    timestamptz not null default now(),
  primary key (room_code, title_id)
);

-- ── Кэш каталога TMDB ────────────────────────────────────────────────
-- Пишет только сервер, читают все: ключ TMDB не покидает серверную функцию,
-- а рейт-лимит не зависит от числа свайпов.

create table public.catalog_titles (
  id         text primary key,
  data       jsonb not null,
  enriched   boolean not null default false,
  cached_at  timestamptz not null default now()
);

create index catalog_titles_enriched_idx on public.catalog_titles (enriched, cached_at desc);

create table public.catalog_cache (
  key         text primary key,
  value       jsonb not null,
  fetched_at  timestamptz not null default now()
);

create index catalog_cache_fetched_idx on public.catalog_cache (fetched_at);

-- ── Рантайм-конфиг рекомендаций ──────────────────────────────────────
-- Веса и пороги можно менять без релиза; A/B-вариант выбирается по user_id.

create table public.app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into public.app_config (key, value)
values ('recommendation', '{"base": {}, "variants": {}}'::jsonb);
