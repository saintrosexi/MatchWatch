-- MatchWatch: публичный профиль как страница человека, а не как счётчики.
--
-- До этой миграции чужой профиль отдавал имя, ник, описание и четыре
-- числа. Числа о человеке не говорят ничего: «85 просмотрено» одинаково
-- у того, кто любит хорроры, и у того, кто смотрит только комедии.
-- Смотреть там было не на что, и заходить незачем.
--
-- Ключевые решения:
--
--   * показываем то, что уже известно из решений человека, — любимое,
--     оценки, темы вкуса. Новых полей «расскажите о себе» не заводим:
--     их никто не заполняет, а решения человек принимает каждый вечер;
--
--   * закреплённые фильмы — единственная ручная часть, и она тоже
--     не новые данные, а выбор из уже отмеченного любимым. Это визитка:
--     шесть постеров говорят о человеке больше страницы текста;
--
--   * видимость открыта по умолчанию, иначе профили останутся пустыми
--     ровно так же, как сейчас: включать что-либо специально не станет
--     почти никто. Закрыть можно каждый раздел отдельно;
--
--   * пересечение считается относительно того, КТО СМОТРИТ: «у вас
--     четыре общих любимых» — единственная причина открыть чужой
--     профиль, а не просто пролистать список людей. Флаг видимости
--     фильмов уважается и здесь, иначе закрытый список вычерпывался бы
--     по одному фильму через сравнение;
--
--   * страница собирается ОДНОЙ функцией и возвращает один jsonb.
--     Иначе экран профиля — это шесть запросов подряд, каждый со своим
--     ожиданием, и открывается он заметно дольше, чем читается.

alter table public.profiles
  add column if not exists show_films   boolean not null default true,
  add column if not exists show_ratings boolean not null default true,
  add column if not exists show_watched boolean not null default true,
  add column if not exists pinned_ids   text[]  not null default '{}',
  add column if not exists hero_id      text,
  add column if not exists accent       text    not null default 'coral';

-- Акцент — выбор из палитры продукта, а не произвольный цвет.
-- Произвольный неизбежно приводит к нечитаемому тексту на нём.
alter table public.profiles drop constraint if exists profiles_accent_known;
alter table public.profiles add constraint profiles_accent_known
  check (accent in ('coral', 'gold', 'ice', 'mint', 'violet'));

-- Шесть постеров — верхняя граница визитки: дальше это уже не выбор,
-- а второй список любимого, который и так есть ниже на странице.
alter table public.profiles drop constraint if exists profiles_pinned_limit;
alter table public.profiles add constraint profiles_pinned_limit
  check (array_length(pinned_ids, 1) is null or array_length(pinned_ids, 1) <= 6);

/*
 * Страница профиля целиком.
 *
 * SECURITY DEFINER: личные таблицы закрыты политикой «только владелец»,
 * и обойти её может лишь функция — но отдаёт она строго то, что человек
 * открыл сам. Проверки видимости стоят внутри, а не в клиенте: клиент
 * можно переписать, функцию нельзя.
 */
create or replace function public.profile_page(p_username text default null, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  me      uuid := auth.uid();
  person  public.profiles%rowtype;
  films   boolean;
  rates   boolean;
  seen    boolean;
  result  jsonb;
begin
  select * into person from public.profiles p
   where (p_user is not null and p.id = p_user)
      or (p_user is null and p_username is not null and lower(p.username) = lower(p_username))
   limit 1;

  if person.id is null then
    return null;
  end if;

  films := coalesce(person.show_films, true);
  rates := coalesce(person.show_ratings, true);
  seen  := coalesce(person.show_watched, true);

  select jsonb_build_object(
    'id', person.id,
    'username', person.username,
    'displayName', person.display_name,
    'photoURL', person.photo_url,
    'bio', person.bio,
    'createdAt', person.created_at,
    'accent', person.accent,
    'isMe', me is not null and me = person.id,

    'visibility', jsonb_build_object('films', films, 'ratings', rates, 'watched', seen),

    'stats', jsonb_build_object(
      'favorites', (select count(*) from public.favorites f where f.user_id = person.id),
      'watched', case when seen
        then (select count(*) from public.title_history h
               where h.user_id = person.id and h.action = 'watched')
        else null end,
      'ratings', case when rates
        then (select count(*) from public.title_history h
               where h.user_id = person.id and h.rating is not null)
        else null end,
      'averageRating', case when rates
        then (select round(avg(h.rating), 1) from public.title_history h
               where h.user_id = person.id and h.rating is not null)
        else null end,
      'decisions', (select count(*) from public.title_history h where h.user_id = person.id),
      'matches', (select count(*) from public.user_matches m where m.user_id = person.id)
    ),

    /*
     * Закреплённое и «фильм про меня» берутся из избранного, а не
     * хранятся отдельными карточками: иначе постер и название
     * разъезжались бы с каталогом при первом же обновлении данных.
     */
    'hero', case when films and person.hero_id is not null
      then (select f.title from public.favorites f
             where f.user_id = person.id and f.title_id = person.hero_id)
      else null end,

    'pinned', case when films
      then coalesce((
        select jsonb_agg(f.title order by array_position(person.pinned_ids, f.title_id))
          from public.favorites f
         where f.user_id = person.id and f.title_id = any(person.pinned_ids)
      ), '[]'::jsonb)
      else '[]'::jsonb end,

    'favorites', case when films
      then coalesce((
        select jsonb_agg(t.title order by t.added_at desc)
          from (select f.title, f.added_at from public.favorites f
                 where f.user_id = person.id
                 order by f.added_at desc limit 18) t
      ), '[]'::jsonb)
      else '[]'::jsonb end,

    'topRated', case when rates
      then coalesce((
        -- Оценка человека кладётся отдельным ключом: в карточке уже есть
        -- `rating` — это балл фильма у зрителей, и путать их нельзя.
        select jsonb_agg(jsonb_set(t.title, '{userRating}', to_jsonb(t.rating)) order by t.rating desc)
          from (select h.title, h.rating from public.title_history h
                 where h.user_id = person.id and h.rating is not null and h.title is not null
                 order by h.rating desc, h.updated_at desc limit 6) t
      ), '[]'::jsonb)
      else '[]'::jsonb end,

    /*
     * Темы вкуса — то, что накопилось само по свайпам. Это самая
     * честная характеристика человека на странице: её нельзя
     * заполнить красиво, она получается из решений.
     */
    'tags', coalesce((
      select jsonb_agg(w.key order by (w.value)::numeric desc)
        from (select key, value from jsonb_each(
                (select tp.tag_weights from public.taste_profiles tp where tp.user_id = person.id)
              ) order by (value)::numeric desc limit 6) w
    ), '[]'::jsonb),

    /*
     * Пересечение со смотрящим — причина зайти в чужой профиль вообще.
     * Мэтчи показываем всегда: это событие, о котором знают оба.
     * Общие любимые — только если человек открыл свои фильмы.
     */
    'shared', case when me is null or me = person.id then null else jsonb_build_object(
      'movies', case when films
        then coalesce((
          select jsonb_agg(t.title)
            from (select f.title from public.favorites f
                   where f.user_id = person.id
                     and f.title_id in (select f2.title_id from public.favorites f2 where f2.user_id = me)
                   limit 8) t
        ), '[]'::jsonb)
        else '[]'::jsonb end,
      'count', case when films
        then (select count(*) from public.favorites f
               where f.user_id = person.id
                 and f.title_id in (select f2.title_id from public.favorites f2 where f2.user_id = me))
        else 0 end,
      'matches', (select count(*) from public.user_matches m
                   where m.user_id = me
                     and m.title_id in (select m2.title_id from public.user_matches m2
                                         where m2.user_id = person.id))
    ) end
  ) into result;

  return result;
end;
$$;

revoke all on function public.profile_page(text, uuid) from public;
grant execute on function public.profile_page(text, uuid) to authenticated;

/*
 * Право на изменение выдаётся поколоночно, и это не формальность.
 *
 * Политика RLS отвечает на вопрос «чью строку можно править», а не
 * «какие поля»: без поколоночных прав человек, правя свой же профиль,
 * мог бы заодно выставить себе access_tier = 'plus'. Поэтому новые
 * колонки витрины приходится разрешать явно — молчаливый отказ 403
 * при сохранении означает ровно то, что колонку сюда забыли добавить.
 */
grant update (show_films, show_ratings, show_watched, pinned_ids, hero_id, accent)
  on public.profiles to authenticated;
