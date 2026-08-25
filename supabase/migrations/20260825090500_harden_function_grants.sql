-- MatchWatch: сужение прав на вызов функций.
--
-- По умолчанию PostgREST публикует все функции схемы public, и SECURITY
-- DEFINER-функция становится доступна даже роли anon — то есть кому угодно
-- с публичным ключом. Раздаём EXECUTE точечно.

-- Представление должно уважать RLS вызывающего, а не создателя:
-- иначе любой вошедший увидит агрегаты по всем пользователям.
alter view public.ops_daily set (security_invoker = on);

-- Фиксируем search_path: без него в SECURITY DEFINER-функцию можно
-- подсунуть свою схему и подменить вызываемые объекты.
create or replace function public.generate_room_code()
returns text
language sql
volatile
set search_path = pg_catalog, public
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
           1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 4);
$$;

revoke execute on function public.handle_new_user()                            from public, anon, authenticated;
revoke execute on function public.generate_room_code()                         from public, anon, authenticated;
revoke execute on function public.is_room_member(text)                         from public, anon;
revoke execute on function public.create_room(jsonb, jsonb, jsonb, text, text) from public, anon;
revoke execute on function public.join_room(text, jsonb, text, text)           from public, anon;
revoke execute on function public.record_swipe(text, text, text, jsonb)        from public, anon;
revoke execute on function public.touch_presence(text, boolean)                from public, anon;
revoke execute on function public.publish_deck(text, jsonb)                    from public, anon;
revoke execute on function public.set_watchlist_item(text, text, jsonb, boolean) from public, anon;

-- Служебные функции — только для сервера (service_role).
revoke execute on function public.gc_rooms(integer)                            from public, anon, authenticated;
revoke execute on function public.ops_retention(text, integer)                 from public, anon, authenticated;
revoke execute on function public.ops_top_failures(text, text, integer, integer) from public, anon, authenticated;

grant execute on function public.gc_rooms(integer)                             to service_role;
grant execute on function public.ops_retention(text, integer)                  to service_role;
grant execute on function public.ops_top_failures(text, text, integer, integer) to service_role;

/*
 * is_room_member остаётся доступной роли authenticated намеренно:
 * выражения RLS-политик выполняются с правами того, кто делает запрос,
 * и без EXECUTE политики комнат просто перестанут работать.
 */
grant execute on function public.is_room_member(text) to authenticated;

grant execute on function public.create_room(jsonb, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.join_room(text, jsonb, text, text)           to authenticated;
grant execute on function public.record_swipe(text, text, text, jsonb)        to authenticated;
grant execute on function public.touch_presence(text, boolean)                to authenticated;
grant execute on function public.publish_deck(text, jsonb)                    to authenticated;
grant execute on function public.set_watchlist_item(text, text, jsonb, boolean) to authenticated;

-- Таблицы телеметрии и связок недоступны клиенту вообще: ни политик,
-- ни грантов. Пишет и читает их только сервер под service_role.
revoke all on public.identities   from anon, authenticated;
revoke all on public.ops_events   from anon, authenticated;
revoke all on public.ops_metrics  from anon, authenticated;
revoke all on public.ops_signups  from anon, authenticated;
