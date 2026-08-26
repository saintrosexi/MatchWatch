-- MatchWatch: пятизначный числовой код и дозагрузка колоды.
--
-- Код диктуют вслух и набирают на телефоне: цифровая клавиатура вдвое
-- крупнее и не знает ни регистра, ни спора «O или ноль». Пять знаков
-- вместо четырёх дают стотысячное пространство — случайное попадание
-- в чужую комнату перестаёт быть правдоподобным.
--
-- Колода публиковалась один раз и кончалась: вдвоём её проходили
-- за десяток свайпов. Дописывать умеет любой участник, а не только хост,
-- иначе колода замирает, стоит хосту свернуть приложение.

create or replace function public.generate_room_code()
returns text
language sql
set search_path to 'pg_catalog', 'public'
as $function$
  select string_agg(floor(random() * 10)::int::text, '')
  from generate_series(1, 5);
$function$;

create or replace function public.append_room_deck(p_code text, p_deck jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_deck jsonb;
  v_known text[];
  v_added jsonb;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'MW403';
  end if;

  if not exists (
    select 1 from public.room_members where room_code = p_code and user_id = v_user
  ) then
    raise exception 'not_a_member' using errcode = 'MW403';
  end if;

  -- Блокировка комнаты: два участника могут дописывать одновременно,
  -- и без неё одна из порций потеряется целиком.
  select coalesce(deck, '[]'::jsonb) into v_deck
    from public.rooms where code = p_code for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'MW404';
  end if;

  select coalesce(array_agg(value ->> 'id'), '{}') into v_known
    from jsonb_array_elements(v_deck) as value;

  select coalesce(jsonb_agg(value), '[]'::jsonb) into v_added
    from jsonb_array_elements(p_deck) as value
   where not ((value ->> 'id') = any (v_known));

  update public.rooms
     set deck = v_deck || v_added,
         last_activity_at = now()
   where code = p_code;

  return jsonb_build_object('added', jsonb_array_length(v_added),
                            'size', jsonb_array_length(v_deck || v_added));
end;
$function$;

revoke execute on function public.append_room_deck(text, jsonb) from public, anon;
grant execute on function public.append_room_deck(text, jsonb) to authenticated;

-- Ограничение на формат кода осталось от четырёх букв, и создание комнаты
-- падало отказом базы. Старые комнаты доживают свои шесть часов и удаляются
-- кроном — проверять их незачем, поэтому просто снимаем их с учёта.
delete from public.rooms where code !~ '^[0-9]{5}$';

alter table public.rooms drop constraint if exists rooms_code_check;
alter table public.rooms add constraint rooms_code_check check (code ~ '^[0-9]{5}$');

-- Проверка формата кода при входе осталась от четырёх букв: по новому коду
-- войти было нельзя, а сообщение при этом винило пользователя в опечатке.
-- Заодно закрытая комната перестаёт пускать внутрь.
create or replace function public.join_room(p_code text, p_taste jsonb default null, p_display_name text default null, p_photo_url text default null)
returns rooms
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_members int;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'MW403';
  end if;

  if p_code is null or p_code !~ '^[0-9]{5}$' then
    raise exception 'invalid_code' using errcode = 'MW400';
  end if;

  select * into v_room from public.rooms where code = p_code;

  if not found then
    raise exception 'room_not_found' using errcode = 'MW404';
  end if;

  if v_room.status = 'closed' then
    raise exception 'room_closed' using errcode = 'MW410';
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
$function$;
