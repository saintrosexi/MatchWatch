-- MatchWatch: лимит комнат бесплатного тарифа.
--
-- Проверка живёт в базе, а не в клиенте, и это единственное возможное
-- место. Клиентская проверка платной границы обходится открытием
-- консоли: она годится, чтобы показать витрину вовремя, но не годится,
-- чтобы что-то запрещать.
--
-- Само число берётся из `app_config`, как и веса рекомендаций. Причина
-- та же: тариф меняют по результатам, а не выкладкой. Пока строки
-- в `app_config` нет, лимита НЕТ вовсе — эта миграция сама по себе
-- никого не ограничивает, и премиум остаётся у всех, как и решено
-- на время первой волны.
--
-- Считаем календарный месяц от текущего момента, а не с первого числа:
-- «три комнаты в месяц» человек понимает как «три за последние
-- тридцать дней», а не «три до конца августа, и потом сразу ещё три».

create or replace function public.premium_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value from public.app_config where key = 'premium'), '{}'::jsonb);
$$;

revoke all on function public.premium_settings() from public, anon;

/**
 * Активна ли подписка. Ровно та же истина, что и в приложении:
 * решает дата, а не поле статуса — оно может отстать.
 */
create or replace function public.has_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((public.premium_settings() ->> 'grantAllUsers')::boolean, true)
    or exists (
      select 1 from public.subscriptions s
       where s.user_id = p_user
         and s.status = 'active'
         and s.expires_at > now()
    );
$$;

grant execute on function public.has_premium(uuid) to authenticated;

/**
 * Сколько комнат человеку ещё можно создать.
 *
 * `null` — без ограничения: у премиума, а также пока лимит не задан
 * в `app_config`. Отсутствие настройки обязано означать «не ограничивать»,
 * а не «ограничить нулём»: забытая строка конфигурации не должна
 * выключать продукт.
 */
create or replace function public.rooms_left(p_user uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used  integer;
begin
  if public.has_premium(p_user) then
    return null;
  end if;

  v_limit := (public.premium_settings() #>> '{freeLimits,roomsPerMonth}')::integer;
  if v_limit is null then
    return null;
  end if;

  select count(*) into v_used
    from public.rooms r
   where r.created_by = p_user
     and r.created_at > now() - interval '30 days';

  return greatest(0, v_limit - v_used);
end;
$$;

grant execute on function public.rooms_left(uuid) to authenticated;

/*
 * Проверка встраивается в создание комнаты.
 *
 * Тело функции повторяется целиком, потому что `create or replace`
 * иначе нельзя: в plpgsql нет способа дописать проверку в начало
 * существующей функции. Всё остальное — генерация кода, разрешение
 * гонки через уникальность ключа, запись хоста — оставлено дословно.
 */
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
  v_left int;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'MW403';
  end if;

  -- Лимит бесплатного тарифа. `null` — без ограничения.
  v_left := public.rooms_left(v_user);
  if v_left is not null and v_left <= 0 then
    raise exception 'room_limit_reached' using errcode = 'MW402';
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

revoke execute on function public.create_room(jsonb, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.create_room(jsonb, jsonb, jsonb, text, text) to authenticated;
