-- MatchWatch: регистрация без подтверждения почты.
--
-- Продуктовое решение: основной вход — Telegram, а email нужен лишь как
-- логин. Подтверждение адреса здесь не даёт ничего, зато ломает вход:
-- встроенный SMTP Supabase отдаёт пару писем в час, после чего регистрация
-- падает с over_email_send_rate_limit, а войти нельзя — аккаунт не
-- подтверждён.
--
-- Триггер помечает адрес подтверждённым в момент создания пользователя.
-- Это ровно то же, что галка «Confirm email: off» в дашборде, но живёт
-- в миграциях и воспроизводится вместе со схемой.
--
-- Осознанный компромисс: зарегистрироваться можно на чужой адрес.
-- Доступа это не даёт — пароль знает только регистрирующий,
-- а никаких писем система не рассылает.

create or replace function public.autoconfirm_new_user()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  -- confirmed_at — генерируемая колонка, её трогать нельзя.
  return new;
end;
$$;

revoke execute on function public.autoconfirm_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_autoconfirm on auth.users;

create trigger on_auth_user_autoconfirm
  before insert on auth.users
  for each row execute function public.autoconfirm_new_user();
