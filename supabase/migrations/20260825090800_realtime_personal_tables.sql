-- MatchWatch: Realtime для личных таблиц.
--
-- Клиент подписывался на изменения истории, избранного и профиля вкуса,
-- но эти таблицы не были в публикации supabase_realtime — события не
-- приходили вовсе. Внешне это выглядело так, будто отметки «просмотрено»,
-- «избранное» и «желаемое» никуда не сохраняются: запись в базу шла,
-- а список на экране оставался тем же, что был на момент загрузки.
--
-- RLS применяется и к потоку изменений, поэтому чужие строки в подписку
-- не попадут: политики этих таблиц пропускают только владельца.

alter publication supabase_realtime add table public.title_history;
alter publication supabase_realtime add table public.favorites;
alter publication supabase_realtime add table public.taste_profiles;
alter publication supabase_realtime add table public.user_matches;
alter publication supabase_realtime add table public.profiles;

alter table public.title_history replica identity full;
alter table public.favorites     replica identity full;
