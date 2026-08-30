-- MatchWatch: премиум-подписка и платежи.
--
-- Две таблицы, а не одна, и это главное решение миграции.
--
--   `payments`      — журнал. Append-only, ничего не переписывается.
--                     Сюда одинаково ложатся оплата звёздами, будущая
--                     оплата картой и промо-выдача. У каждой записи свой
--                     внешний идентификатор, по которому её можно найти
--                     при возврате денег или разборе жалобы.
--
--   `subscriptions` — текущее право доступа. Одна строка на человека,
--                     переписывается при каждом продлении.
--
-- Соблазн был свести всё в одну таблицу со статусом. Так делать нельзя:
-- журнал платежей — это бухгалтерия, её нельзя терять при продлении,
-- а право доступа нужно читать на каждый запрос и оно обязано быть
-- одной строкой без агрегации. Разные задачи, разный срок жизни.
--
-- Идемпотентность вынесена в уникальный индекс, а не в проверку в коде.
-- Telegram повторяет доставку вебхука, пока не получит 200, и повтор
-- `successful_payment` при проверке «сначала посмотрим, есть ли такой»
-- проходит насквозь в двух параллельных запросах. База обязана отказать
-- сама.

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,

  /* Чем заплатили: stars | card | promo. Промо тоже платёж, просто на ноль. */
  source         text not null check (source in ('stars', 'card', 'promo')),

  /*
   * Сумма в МИНИМАЛЬНЫХ единицах валюты: копейки для рубля, штуки
   * для звёзд. Дробных денег в базе быть не должно — округление
   * в бухгалтерии всплывает через полгода и не чинится.
   */
  amount         integer not null default 0 check (amount >= 0),
  currency       text    not null default 'XTR',

  /*
   * Идентификатор платежа у провайдера.
   *
   * Для звёзд это `telegram_payment_charge_id` — именно он нужен
   * методу refundStarPayment, и без него вернуть деньги нельзя.
   * Для промо-выдачи сюда кладётся `promo:<user_id>`: так уникальный
   * индекс сам не даст выдать бесплатный месяц дважды.
   */
  charge_id      text not null,

  /* Сколько дней доступа куплено этим платежом. */
  days           integer not null check (days > 0),

  /* Сырой payload от провайдера — на случай разбора спорной оплаты. */
  payload        jsonb not null default '{}'::jsonb,

  created_at     timestamptz not null default now()
);

-- Тот самый замок от повторной доставки вебхука.
create unique index if not exists payments_charge_id_key
  on public.payments (charge_id);

create index if not exists payments_user_created_idx
  on public.payments (user_id, created_at desc);

create table if not exists public.subscriptions (
  user_id     uuid primary key references auth.users on delete cascade,
  plan        text not null default 'premium',

  /*
   * Статус хранится, но истинным источником считается `expires_at`.
   *
   * Поле здесь для запросов «покажи всех активных» и для того, чтобы
   * отличить истёкшую подписку от отменённой вручную. Проверка доступа
   * смотрит на дату: статус можно забыть обновить фоновой задачей,
   * а дата протухает сама.
   */
  status      text not null default 'active'
              check (status in ('active', 'expired', 'cancelled')),

  /* Чем оплачена текущая подписка — для метрик конверсии промо в деньги. */
  source      text not null check (source in ('stars', 'card', 'promo')),

  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);

create index if not exists subscriptions_expires_idx
  on public.subscriptions (expires_at) where status = 'active';

/*
 * Продление подписки.
 *
 * Продлевает от БОЛЬШЕЙ из двух дат — текущего окончания и «сейчас».
 * Иначе человек, оплативший второй месяц заранее, терял остаток
 * первого: наивное `now() + interval` затирает то, за что уже заплачено.
 */
create or replace function public.extend_subscription(
  p_user_id uuid,
  p_days    integer,
  p_source  text
) returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.subscriptions;
begin
  insert into public.subscriptions as s (user_id, source, expires_at)
  values (p_user_id, p_source, now() + make_interval(days => p_days))
  on conflict (user_id) do update
    set expires_at = greatest(s.expires_at, now()) + make_interval(days => p_days),
        status     = 'active',
        source     = excluded.source,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.extend_subscription(uuid, integer, text) from public, anon, authenticated;

alter table public.payments      enable row level security;
alter table public.subscriptions enable row level security;

/*
 * Читать — только своё, писать — некому.
 *
 * Ни одной политики на insert/update здесь нет намеренно. Записи
 * создаёт сервер сервисным ключом, в обход RLS: право доступа,
 * которое клиент может выписать себе сам, правом доступа не является.
 */
drop policy if exists payments_own_read on public.payments;
create policy payments_own_read on public.payments
  for select using (auth.uid() = user_id);

drop policy if exists subscriptions_own_read on public.subscriptions;
create policy subscriptions_own_read on public.subscriptions
  for select using (auth.uid() = user_id);

grant select on public.payments      to authenticated;
grant select on public.subscriptions to authenticated;
