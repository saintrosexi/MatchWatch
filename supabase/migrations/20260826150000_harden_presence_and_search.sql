-- MatchWatch: закрываем две дыры в правах.
--
-- Присутствие продлевало жизнь ЛЮБОЙ комнаты по коду, даже чужой:
-- обновление room_members ограничивалось своим user_id, а обновление
-- rooms — нет. Держать чужую комнату вечно живой мог кто угодно, зная
-- только код.
--
-- Поиск по началу ника с одной буквы позволял перебрать алфавит и
-- выгрузить список всех, кто завёл ник. Клиент требовал два символа, но
-- проверка на клиенте не проверка: запрос уходит напрямую в PostgREST,
-- и обойти её можно голым curl.

create or replace function public.touch_presence(p_code text, p_online boolean default true)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_member boolean;
begin
  select exists (
    select 1 from public.room_members
     where room_code = p_code and user_id = auth.uid()
  ) into v_member;

  if not v_member then
    return;
  end if;

  update public.room_members
     set online = p_online, last_seen = now()
   where room_code = p_code and user_id = auth.uid();

  if p_online then
    update public.rooms
       set last_activity_at = now(), expires_at = now() + interval '6 hours'
     where code = p_code;
  end if;
end;
$function$;

create or replace function public.search_users(p_query text, p_limit integer default 12)
returns table(id uuid, username text, display_name text, photo_url text, bio text)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select p.id, p.username, p.display_name, p.photo_url, p.bio
  from public.profiles p
  join auth.users u on u.id = p.id
  where auth.uid() is not null
    and length(btrim(coalesce(p_query, ''))) >= 3
    and p.id <> auth.uid()
    and p.username is not null
    and (
      lower(p.username) like lower(btrim(p_query)) || '%'
      or lower(u.email) = lower(btrim(p_query))
    )
  order by length(p.username)
  limit least(greatest(p_limit, 1), 30);
$function$;
