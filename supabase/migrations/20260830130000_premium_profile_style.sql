-- MatchWatch: оформление профиля как премиум-граница.
--
-- Выбор границы объясняется отдельно, потому что он не случайный.
--
-- Отрезать премиумом комнаты нельзя: комната — это приглашение второго
-- человека, то есть единственный механизм, которым продукт растёт сам.
-- Ограничить её значит выключить собственный рост ради выручки, которой
-- пока нет. Отрезать ленту тоже нельзя — она и есть продукт.
--
-- Оформление профиля не отнимает ничего. Человек без подписки видит
-- ровно тот же продукт; человек с подпиской получает то, чего у него
-- не было, — и то, что видят другие. Это единственный класс функций,
-- где платящий выигрывает, а не платящий ничего не теряет.
--
-- На сейчас премиум выдан всем (`grantAllUsers` в конфиге), так что
-- граница лежит готовой, но никого не ограничивает.

-- Премиальные акценты дописываются к прежним пяти, а не заменяют их:
-- цвет, выбранный до подписки, обязан пережить её окончание.
alter table public.profiles drop constraint if exists profiles_accent_known;
alter table public.profiles add constraint profiles_accent_known
  check (accent in (
    -- Бесплатные
    'coral', 'gold', 'ice', 'mint', 'violet',
    -- Премиальные
    'ember', 'ocean', 'orchid', 'moss'
  ));

/*
 * Оформление карточки профиля.
 *
 * Отдельное поле, а не «расширенный акцент»: цвет и фактура —
 * независимые решения, и человек, выбравший коралловый, должен иметь
 * возможность взять к нему любую из фактур, а не заранее собранную пару.
 */
alter table public.profiles
  add column if not exists frame text not null default 'plain';

alter table public.profiles drop constraint if exists profiles_frame_known;
alter table public.profiles add constraint profiles_frame_known
  check (frame in ('plain', 'glow', 'gradient', 'film', 'noir'));

/*
 * Сколько фильмов можно закрепить.
 *
 * Хранится в профиле, а не берётся из конфига приложения, потому что
 * проверять длину массива обязана база: клиент, отправляющий двадцать
 * закреплённых, не должен получить двадцать. Значение проставляется
 * сервером при выдаче подписки.
 */
alter table public.profiles
  add column if not exists pin_limit smallint not null default 6
  check (pin_limit between 1 and 24);

alter table public.profiles drop constraint if exists profiles_pinned_within_limit;
alter table public.profiles add constraint profiles_pinned_within_limit
  check (cardinality(pinned_ids) <= pin_limit);

-- Человек правит оформление сам; лимит закреплённых — нет.
grant update (frame) on public.profiles to authenticated;

/*
 * Публичная страница обязана сказать, что человек премиальный.
 *
 * Иначе оформление выглядит как случайный набор цветов, а не как знак,
 * и половина смысла платной косметики теряется: её ценность в том, что
 * её видно другим.
 *
 * Тело прежней функции не переписываем и не копируем: она собирает
 * страницу одним запросом и делает это правильно. Переименовываем её
 * в базовую и надстраиваем обёртку — так расхождение двух копий одного
 * запроса становится невозможным, а не маловероятным.
 */
do $$
begin
  if not exists (
    select 1 from pg_proc pr
      join pg_namespace ns on ns.oid = pr.pronamespace
     where ns.nspname = 'public' and pr.proname = 'profile_page_base'
  ) then
    alter function public.profile_page(text, uuid) rename to profile_page_base;
  end if;
end $$;

-- Базовая остаётся внутренней: публичный вход должен быть один.
revoke all on function public.profile_page_base(text, uuid) from public, anon, authenticated;

create or replace function public.profile_page(p_username text default null, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  base    jsonb := public.profile_page_base(p_username, p_user);
  person  uuid;
  premium boolean;
  style   text;
begin
  if base is null then
    return null;
  end if;

  person := (base ->> 'id')::uuid;

  select exists (
    select 1 from public.subscriptions s
     where s.user_id = person
       and s.status = 'active'
       and s.expires_at > now()
  ) into premium;

  select p.frame into style from public.profiles p where p.id = person;

  return base || jsonb_build_object('premium', premium, 'frame', coalesce(style, 'plain'));
end;
$$;

grant execute on function public.profile_page(text, uuid) to anon, authenticated;
