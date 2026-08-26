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
