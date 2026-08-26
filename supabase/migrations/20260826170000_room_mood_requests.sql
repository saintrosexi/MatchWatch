-- MatchWatch: настроение участника на сегодня.
--
-- Хранится рядом с участником, а не в комнате: это личный запрос, и
-- складывать их должен алгоритм, а не человек, дописывающий общий список.
-- Видно всем в комнате — так до сборки колоды видно, что напротив хотят
-- другого, и можно договориться заранее, а не после.

alter table public.room_members
  add column if not exists mood_request jsonb not null default '[]'::jsonb;

comment on column public.room_members.mood_request is
  'Ключи выбранных чипов настроения, включая режим rewatch.';

create or replace function public.set_room_mood(p_code text, p_keys jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'MW403';
  end if;

  if jsonb_typeof(p_keys) <> 'array' then
    raise exception 'invalid_keys' using errcode = 'MW400';
  end if;

  -- Потолок на размер: список ключей приходит от клиента, и без предела
  -- в строку участника можно записать что угодно любого объёма.
  if jsonb_array_length(p_keys) > 12 then
    raise exception 'too_many_keys' using errcode = 'MW400';
  end if;

  update public.room_members
     set mood_request = p_keys
   where room_code = p_code and user_id = v_user;

  if not found then
    raise exception 'not_a_member' using errcode = 'MW403';
  end if;

  update public.rooms
     set last_activity_at = now()
   where code = p_code;

  return p_keys;
end;
$function$;

revoke execute on function public.set_room_mood(text, jsonb) from public, anon;
grant execute on function public.set_room_mood(text, jsonb) to authenticated;
