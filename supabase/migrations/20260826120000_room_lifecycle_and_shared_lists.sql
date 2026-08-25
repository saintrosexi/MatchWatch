-- MatchWatch: жизненный цикл комнаты и общие списки.
--
-- Три вещи, которые до сих пор жили только в голове у пользователя:
--
--   * мэтч был записью комнаты и исчезал вместе с ней. Теперь он сразу
--     ложится в личное «буду смотреть» каждому участнику: смысл мэтча
--     в том, что кино посмотрят, а не в том, что о нём договорились;
--   * комнату нельзя было закрыть. Она просто протухала через шесть
--     часов, и всё это время висела в списке живой;
--   * сверить списки с другом можно было только вслух.

-- ── Мэтч уходит в личные списки ──────────────────────────────────────
--
-- Пишем каждому участнику строку в title_history. Просмотренное не
-- трогаем: человек уже видел фильм, и «буду смотреть» ему не нужно —
-- вернуть его в планы значит соврать в списке.

create or replace function public.record_swipe(p_code text, p_title_id text, p_action text, p_title jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_expires timestamptz;
  v_status text;
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
   */
  select expires_at, status into v_expires, v_status
    from public.rooms where code = p_code for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'MW404';
  end if;

  if v_status = 'closed' then
    raise exception 'room_closed' using errcode = 'MW410';
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

  /*
   * И личным пунктом каждого. Общий список живёт ровно столько, сколько
   * живёт комната, — а договорённость посмотреть кино переживает её.
   */
  insert into public.title_history (user_id, title_id, action, title, updated_at)
  select m.user_id, p_title_id, 'match', p_title, now()
    from public.room_members m
   where m.room_code = p_code
  on conflict (user_id, title_id) do update
     set action = 'match',
         title = coalesce(excluded.title, public.title_history.title),
         updated_at = now()
   where public.title_history.action <> 'watched';

  -- Личная лента мэтчей: она же питает вкладку «Мэтчи».
  insert into public.user_matches (user_id, title_id, room_code, title, partners)
  select m.user_id, p_title_id, p_code, p_title,
         array(
           select coalesce(o.display_name, 'Зритель')
             from public.room_members o
            where o.room_code = p_code and o.user_id <> m.user_id
         )
    from public.room_members m
   where m.room_code = p_code
  on conflict do nothing;

  select to_jsonb(rm) into v_match
    from public.room_matches rm
   where rm.room_code = p_code and rm.title_id = p_title_id;

  return jsonb_build_object('matched', true, 'created', v_created, 'match', v_match);
end;
$function$;

-- ── Хост закрывает комнату ───────────────────────────────────────────
--
-- Закрытие необратимо и доступно только создателю. Строки участников
-- остаются: по ним собирается список «с кем смотрели», а удаление
-- истории ради опустевшей комнаты — плохой обмен.

create or replace function public.close_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'MW403';
  end if;

  select created_by into v_owner from public.rooms where code = p_code for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'MW404';
  end if;

  if v_owner <> v_user then
    raise exception 'not_a_host' using errcode = 'MW403';
  end if;

  -- Срок в прошлом закрывает и те пути, что смотрят только на expires_at.
  update public.rooms
     set status = 'closed',
         expires_at = least(expires_at, now()),
         last_activity_at = now()
   where code = p_code;

  update public.room_members
     set online = false
   where room_code = p_code;

  return jsonb_build_object('code', p_code, 'status', 'closed');
end;
$function$;

revoke execute on function public.close_room(text) from public, anon;
grant execute on function public.close_room(text) to authenticated;

-- ── Сверка списков с другом ──────────────────────────────────────────
--
-- Отдаём только пересечение и только для подтверждённой дружбы. Чужой
-- список целиком — это чужие планы на вечер, их показывать незачем;
-- пересечение же обе стороны и так собирались обсуждать.

create or replace function public.shared_watchlist(p_friend uuid)
returns table(title_id text, title jsonb, mine_at timestamptz, theirs_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    mine.title_id,
    coalesce(mine.title, theirs.title) as title,
    mine.updated_at as mine_at,
    theirs.updated_at as theirs_at
  from public.title_history mine
  join public.title_history theirs
    on theirs.title_id = mine.title_id
   and theirs.user_id = p_friend
  where mine.user_id = auth.uid()
    and mine.action in ('later', 'like', 'match')
    and theirs.action in ('later', 'like', 'match')
    and exists (
      select 1 from public.friendships f
       where f.user_id = auth.uid()
         and f.friend_id = p_friend
         and f.status = 'accepted'
    )
  order by greatest(mine.updated_at, theirs.updated_at) desc
  limit 200;
$function$;

revoke execute on function public.shared_watchlist(uuid) from public, anon;
grant execute on function public.shared_watchlist(uuid) to authenticated;

-- ── Публичная карточка по идентификатору ─────────────────────────────
--
-- Участник комнаты известен по user_id, а не по нику: открыть его
-- профиль иначе нечем. Отдаётся ровно то же, что и в public_profile —
-- только опубликованное самим человеком.

create or replace function public.public_profile_by_id(p_user uuid)
returns table(
  id uuid, username text, display_name text, photo_url text, bio text,
  created_at timestamptz, ratings_count bigint, average_rating numeric,
  favorites_count bigint, watched_count bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    p.id, p.username, p.display_name, p.photo_url, p.bio, p.created_at,
    (select count(*) from public.title_history h where h.user_id = p.id and h.rating is not null),
    (select round(avg(h.rating), 1) from public.title_history h where h.user_id = p.id and h.rating is not null),
    (select count(*) from public.favorites f where f.user_id = p.id),
    (select count(*) from public.title_history h where h.user_id = p.id and h.action = 'watched')
  from public.profiles p
  where p.id = p_user
  limit 1;
$function$;

revoke execute on function public.public_profile_by_id(uuid) from public, anon;
grant execute on function public.public_profile_by_id(uuid) to authenticated;
