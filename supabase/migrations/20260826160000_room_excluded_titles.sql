-- MatchWatch: что не должно попасть в общую колоду.
--
-- Колода комнаты обязана быть одной и той же и в одном порядке у всех:
-- иначе «мэтч» превращается в совпадение позиций, а не вкусов. Раньше
-- каждый участник отсеивал карточки своей личной историей уже при показе,
-- и наборы разъезжались — со стороны это выглядело как случайные карточки.
--
-- Поэтому исключения считаются один раз, на генерации, и сразу по всем
-- участникам: то, что кто-то уже смотрел или уже любит, показывать паре
-- незачем. Режим «пересматриваем любимое» снимает запрет на избранное —
-- там смысл ровно в том, чтобы вернуть уже любимое.
create or replace function public.room_excluded_titles(p_code text, p_keep_favorites boolean default false)
returns table(title_id text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with members as (
    select user_id from public.room_members where room_code = p_code
  )
  select distinct h.title_id
    from public.title_history h
   where h.user_id in (select user_id from members)
     and (
       h.action = 'watched'
       or (h.action = 'favorite' and not p_keep_favorites)
     )
     and exists (
       select 1 from public.room_members m
        where m.room_code = p_code and m.user_id = auth.uid()
     )
  union
  select distinct f.title_id
    from public.favorites f
   where not p_keep_favorites
     and f.user_id in (select user_id from members)
     and exists (
       select 1 from public.room_members m
        where m.room_code = p_code and m.user_id = auth.uid()
     );
$function$;

revoke execute on function public.room_excluded_titles(text, boolean) from public, anon;
grant execute on function public.room_excluded_titles(text, boolean) to authenticated;
