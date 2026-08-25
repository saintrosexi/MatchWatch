-- MatchWatch: профиль пользователя, идентичности и профиль вкуса.
--
-- Внутренний user_id — это auth.users.id (uuid). Способ входа к нему не
-- привязан: telegram-id и email живут в таблице identities и указывают
-- на один и тот же профиль. Связать два входа = вставить строку.

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  photo_url         text,
  locale            text not null default 'ru',
  primary_provider  text,
  -- Уровень доступа заложен сразу: платные фичи не потребуют миграции.
  access_tier       text not null default 'free' check (access_tier in ('free', 'plus')),
  access_stars      integer not null default 0 check (access_stars >= 0),
  access_since      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now()
);

comment on table public.profiles is 'Профиль зрителя. Уровень доступа меняет только сервер.';

create table public.identities (
  provider      text not null check (provider in ('telegram', 'email')),
  external_key  text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  linked_at     timestamptz not null default now(),
  primary key (provider, external_key)
);

create index identities_user_idx on public.identities (user_id);

-- Профиль вкуса: веса тегов и 5D-вектор настроения.
create table public.taste_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  version      integer not null default 4,
  tag_weights  jsonb not null default '{}'::jsonb,
  moods        jsonb not null default
    '{"energy":50,"darkness":50,"intellect":50,"emotion":50,"dynamism":50}'::jsonb,
  mood_mass    double precision not null default 0,
  counts       jsonb not null default
    '{"like":0,"dislike":0,"favorite":0,"watched":0,"match":0,"inspect":0}'::jsonb,
  signals      integer not null default 0,
  updated_at   timestamptz not null default now()
);

-- История реакций: что уже показано и чего больше показывать не надо.
create table public.title_history (
  user_id    uuid not null references auth.users(id) on delete cascade,
  title_id   text not null,
  action     text not null check (action in ('like', 'dislike', 'favorite', 'watched', 'match')),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create index title_history_user_idx on public.title_history (user_id, updated_at desc);

create table public.favorites (
  user_id   uuid not null references auth.users(id) on delete cascade,
  title_id  text not null,
  title     jsonb not null,
  added_at  timestamptz not null default now(),
  primary key (user_id, title_id)
);

create table public.user_matches (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title_id    text not null,
  room_code   text,
  title       jsonb not null,
  partners    text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- Один мэтч на пару «тайтл + комната»; для личных room_code = null.
create unique index user_matches_unique_idx
  on public.user_matches (user_id, title_id, coalesce(room_code, 'solo'));

create index user_matches_recent_idx on public.user_matches (user_id, created_at desc);

-- Профиль создаётся автоматически при появлении пользователя в auth.users:
-- так клиент никогда не встретит «пользователь есть, а профиля нет».
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, photo_url, primary_provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'photo_url',
    coalesce(new.raw_user_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do nothing;

  insert into public.taste_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
