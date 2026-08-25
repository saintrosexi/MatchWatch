-- MatchWatch: Row Level Security.
--
-- Anon-ключ Supabase публичный по определению — он лежит в бандле клиента.
-- Поэтому единственная настоящая граница доступа проходит здесь.

-- Проверка членства вынесена в SECURITY DEFINER-функцию: если политика
-- room_members будет ссылаться сама на себя, Postgres уйдёт в рекурсию.
create or replace function public.is_room_member(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
     where room_code = p_code and user_id = auth.uid()
  );
$$;

alter table public.profiles         enable row level security;
alter table public.identities       enable row level security;
alter table public.taste_profiles   enable row level security;
alter table public.title_history    enable row level security;
alter table public.favorites        enable row level security;
alter table public.user_matches     enable row level security;
alter table public.rooms            enable row level security;
alter table public.room_members     enable row level security;
alter table public.room_swipes      enable row level security;
alter table public.room_matches     enable row level security;
alter table public.room_watchlist   enable row level security;
alter table public.catalog_titles   enable row level security;
alter table public.catalog_cache    enable row level security;
alter table public.app_config       enable row level security;
alter table public.ops_events       enable row level security;
alter table public.ops_metrics      enable row level security;
alter table public.ops_signups      enable row level security;

-- ── Личные данные: только владелец ──────────────────────────────────
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

/*
 * RLS не умеет разграничивать по колонкам, а уровень доступа и звёзды
 * клиент менять не должен ни при каких условиях. Поэтому право UPDATE
 * выдаётся точечно на три безобидные колонки.
 */
revoke update on public.profiles from authenticated;
grant update (display_name, photo_url, locale) on public.profiles to authenticated;

create policy taste_own on public.taste_profiles
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy history_own on public.title_history
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy favorites_own on public.favorites
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy matches_own on public.user_matches
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- identities: политик нет вовсе — таблица доступна только service_role,
-- то есть серверным функциям. Клиент не должен даже видеть связки.

-- ── Комнаты ─────────────────────────────────────────────────────────
-- Запись идёт через RPC (security definer), клиенту оставлено чтение
-- и ровно одно исключение: свой собственный голос и общий список.

create policy rooms_select_member on public.rooms
  for select to authenticated using (public.is_room_member(code));

create policy room_members_select on public.room_members
  for select to authenticated using (public.is_room_member(room_code));
create policy room_members_update_own on public.room_members
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy room_members_delete_own on public.room_members
  for delete to authenticated using (user_id = (select auth.uid()));

create policy room_swipes_select on public.room_swipes
  for select to authenticated using (public.is_room_member(room_code));
create policy room_swipes_insert_own on public.room_swipes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_room_member(room_code));

create policy room_matches_select on public.room_matches
  for select to authenticated using (public.is_room_member(room_code));

create policy room_watchlist_select on public.room_watchlist
  for select to authenticated using (public.is_room_member(room_code));
create policy room_watchlist_delete on public.room_watchlist
  for delete to authenticated using (public.is_room_member(room_code));

-- ── Каталог и конфиг: читают все вошедшие, пишет только сервер ──────
create policy catalog_titles_read on public.catalog_titles
  for select to authenticated using (true);
create policy catalog_cache_read on public.catalog_cache
  for select to authenticated using (true);
create policy app_config_read on public.app_config
  for select to authenticated using (true);

-- ── Телеметрия: клиент не читает и не пишет напрямую ────────────────
-- Всё идёт через /api/ops/events под service_role, иначе счётчики
-- метрик можно было бы накрутить с любого браузера.
-- Политик нет — значит, доступ закрыт для anon и authenticated.

-- Реалтайм: клиент подписывается на изменения только тех комнат,
-- где он состоит, — RLS применяется и к потоку изменений.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.room_swipes;
alter publication supabase_realtime add table public.room_matches;
alter publication supabase_realtime add table public.room_watchlist;

-- Realtime отдаёт old-record для UPDATE/DELETE только при REPLICA IDENTITY FULL.
alter table public.room_members   replica identity full;
alter table public.room_swipes    replica identity full;
alter table public.room_watchlist replica identity full;
