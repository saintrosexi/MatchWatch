-- MatchWatch: публичный профиль и друзья.
--
-- Ник и отображаемое имя — разные вещи: ник уникален и служит адресом
-- (по нему находят), имя произвольно и служит подписью. Смешивать их
-- значит либо запрещать тёзок, либо ломать поиск.
--
-- Полный текст миграции применён к проекту; здесь он хранится для
-- воспроизведения схемы с нуля. Ключевые решения:
--
--   * уникальность ника без учёта регистра — иначе «Anna» и «anna»
--     открывают дорогу подделкам под чужой адрес;
--   * поиск по нику идёт по началу строки, по почте — только точным
--     совпадением: поиск по части адреса позволил бы вычерпать базу
--     пользователей по буквам;
--   * дружба симметрична: при подтверждении создаются обе строки,
--     поэтому «мои друзья» — простой запрос без OR по двум колонкам;
--   * публичная карточка отдаёт только опубликованное самим человеком —
--     ни почты, ни уровня доступа.

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-zA-Z0-9._]{3,24}$');

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 280);

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username)) where username is not null;

create table if not exists public.friendships (
  user_id      uuid not null references auth.users(id) on delete cascade,
  friend_id    uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friendship_not_self check (user_id <> friend_id)
);

create index if not exists friendships_user_idx on public.friendships (user_id, status);
alter table public.friendships enable row level security;

create policy friendships_select on public.friendships
  for select to authenticated
  using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

grant update (display_name, photo_url, locale, username, bio) on public.profiles to authenticated;

-- Функции public_profile, search_users, username_available, my_friends,
-- request_friend, accept_friend, remove_friend — см. применённую миграцию
-- social_profiles_and_friends в истории Supabase (supabase db pull).
