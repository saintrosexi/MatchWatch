-- MatchWatch: операции с комнатами.
--
-- Вся содержательная логика живёт в SECURITY DEFINER-функциях, а не в
-- клиенте: только так можно гарантировать, что голос засчитан ровно один
-- раз, а мэтч создан ровно один раз, сколько бы участников ни свайпнули
-- одну карточку одновременно.
--
-- Коды ошибок (SQLSTATE) читает клиент:
--   MW400 — некорректный код          MW404 — комната не найдена
--   MW410 — комната истекла           MW409 — комната переполнена
--   MW403 — нет прав (не участник)    MW500 — не удалось подобрать код

-- Алфавит совпадает с shared/model/roomCode.js: без O/0 и I/1/L.
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

create or replace function public.create_room(
  p_deck jsonb default '[]'::jsonb,
  p_filters jsonb default null,
  p_taste jsonb default null,
  p_display_name text default null,
  p_photo_url text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_attempt int := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'MW403';
  end if;

  -- Код занимается вставкой: гонку разрешает уникальность первичного ключа,
  -- а не проверка «свободен ли» перед записью.
  loop
    v_attempt := v_attempt + 1;
    v_code := public.generate_room_code();

    begin
      insert into public.rooms (code, created_by, filters, deck)
      values (v_code, v_user, p_filters, coalesce(p_deck, '[]'::jsonb));
      exit;
    exception when unique_violation then
      if v_attempt >= 8 then
        raise exception 'code_exhausted' using errcode = 'MW500';
      end if;
    end;
  end loop;

  insert into public.room_members (room_code, user_id, display_name, photo_url, is_host, taste)
  values (v_code, v_user, p_display_name, p_photo_url, true, p_taste);

  return v_code;
end;
$$;

create or replace function public.join_room(
  p_code text,
  p_taste jsonb default null,
  p_display_name text default null,
  p_photo_url text default null
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_members int;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'MW403';
  end if;

  if p_code is null or p_code !~ '^[A-Z0-9]{4}$' then
    raise exception 'invalid_code' using errcode = 'MW400';
  end if;

  select * into v_room from public.rooms where code = p_code;

  if not found then
    raise exception 'room_not_found' using errcode = 'MW404';
  end if;

  if v_room.expires_at < now() then
    raise exception 'room_expired' using errcode = 'MW410';
  end if;

  select count(*) into v_members from public.room_members where room_code = p_code;

  if v_members >= 8 and not exists (
    select 1 from public.room_members where room_code = p_code and user_id = v_user
  ) then
    raise exception 'room_full' using errcode = 'MW409';
  end if;

  insert into public.room_members (room_code, user_id, display_name, photo_url, taste, online, last_seen)
  values (p_code, v_user, p_display_name, p_photo_url, p_taste, true, now())
  on conflict (room_code, user_id) do update
    set online = true,
        last_seen = now(),
        taste = coalesce(excluded.taste, public.room_members.taste),
        display_name = coalesce(excluded.display_name, public.room_members.display_name),
        photo_url = coalesce(excluded.photo_url, public.room_members.photo_url);

  update public.rooms
     set last_activity_at = now(),
         expires_at = now() + interval '6 hours'
   where code = p_code
  returning * into v_room;

  return v_room;
end;
$$;

-- Голос + проверка обоюдного лайка одним вызовом.
create or replace function public.record_swipe(
  p_code text,
  p_title_id text,
  p_action text,
  p_title jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_expires timestamptz;
  v_members int;
  v_likes int;
  v_match jsonb;
  v_created boolean := false;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'MW403';
  end if;

  /*
   * Блокировка строки комнаты — не перестраховка.
   * Без неё два последних голоса, поданных одновременно, под READ COMMITTED
   * не видят друг друга: каждый считает лайки без чужой неподтверждённой
   * строки, оба насчитывают меньше кворума, и мэтч не рождается вовсе.
   * Свайпов в комнате единицы в секунду, так что сериализация по комнате
   * ничего не стоит.
   */
  select expires_at into v_expires from public.rooms where code = p_code for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'MW404';
  end if;

  if v_expires < now() then
    raise exception 'room_expired' using errcode = 'MW410';
  end if;

  if not exists (
    select 1 from public.room_members where room_code = p_code and user_id = v_user
  ) then
    raise exception 'not_a_member' using errcode = 'MW403';
  end if;

  insert into public.room_swipes (room_code, title_id, user_id, action)
  values (p_code, p_title_id, v_user, p_action)
  on conflict (room_code, title_id, user_id)
    do update set action = excluded.action, created_at = now();

  update public.rooms
     set last_activity_at = now(),
         expires_at = now() + interval '6 hours'
   where code = p_code;

  if p_action <> 'like' then
    return jsonb_build_object('matched', false);
  end if;

  select count(*) into v_members from public.room_members where room_code = p_code;

  -- Считаем только голоса тех, кто сейчас числится в комнате.
  select count(*) into v_likes
    from public.room_swipes s
    join public.room_members m
      on m.room_code = s.room_code and m.user_id = s.user_id
   where s.room_code = p_code and s.title_id = p_title_id and s.action = 'like';

  if v_members < 2 or v_likes < v_members then
    return jsonb_build_object('matched', false);
  end if;

  insert into public.room_matches (room_code, title_id, title, participants)
  select p_code, p_title_id, p_title, array_agg(m.user_id)
    from public.room_members m
   where m.room_code = p_code
  on conflict (room_code, title_id) do nothing;

  v_created := found;

  -- Мэтч сразу становится пунктом общего списка «к просмотру» — в этом его смысл.
  insert into public.room_watchlist (room_code, title_id, title, added_by, from_match)
  values (p_code, p_title_id, p_title, v_user, true)
  on conflict (room_code, title_id) do nothing;

  select to_jsonb(rm) into v_match
    from public.room_matches rm
   where rm.room_code = p_code and rm.title_id = p_title_id;

  return jsonb_build_object('matched', true, 'created', v_created, 'match', v_match);
end;
$$;

create or replace function public.touch_presence(p_code text, p_online boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.room_members
     set online = p_online, last_seen = now()
   where room_code = p_code and user_id = auth.uid();

  if p_online then
    update public.rooms
       set last_activity_at = now(), expires_at = now() + interval '6 hours'
     where code = p_code;
  end if;
end;
$$;

-- Публикует общую колоду. Пишет только хост, иначе участники затрут друг друга.
create or replace function public.publish_deck(p_code text, p_deck jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.rooms where code = p_code and created_by = auth.uid()
  ) then
    raise exception 'not_host' using errcode = 'MW403';
  end if;

  update public.rooms
     set deck = p_deck, last_activity_at = now()
   where code = p_code;
end;
$$;

create or replace function public.set_watchlist_item(
  p_code text,
  p_title_id text,
  p_title jsonb,
  p_watched boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.room_members where room_code = p_code and user_id = auth.uid()
  ) then
    raise exception 'not_a_member' using errcode = 'MW403';
  end if;

  insert into public.room_watchlist (room_code, title_id, title, added_by, watched, watched_at)
  values (p_code, p_title_id, p_title, auth.uid(), coalesce(p_watched, false),
          case when p_watched then now() end)
  on conflict (room_code, title_id) do update
    set watched = coalesce(p_watched, public.room_watchlist.watched),
        watched_at = case when p_watched then now() else null end;
end;
$$;

-- TTL-уборка: вызывается кроном.
create or replace function public.gc_rooms(p_idle_hours integer default 12)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed integer;
begin
  with dead as (
    delete from public.rooms
     where expires_at < now()
        or last_activity_at < now() - make_interval(hours => p_idle_hours)
    returning code
  )
  select count(*) into v_removed from dead;

  return v_removed;
end;
$$;
