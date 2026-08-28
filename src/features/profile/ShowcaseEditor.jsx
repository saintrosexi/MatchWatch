import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, Heart, Star } from '../../ui/icons.js';
import { Sheet } from '../../ui/Sheet.jsx';
import { Poster } from '../../ui/Poster.jsx';
import { EmptyState } from '../../ui/States.jsx';
import { saveShowcase } from '../../engine/social.js';

/** Палитра продукта. Произвольный цвет рано или поздно нечитаем на тёмном. */
const ACCENTS = [
  { key: 'coral', label: 'Коралловый', color: 'var(--coral)' },
  { key: 'gold', label: 'Золотой', color: 'var(--gold)' },
  { key: 'ice', label: 'Ледяной', color: 'var(--ice)' },
  { key: 'mint', label: 'Мятный', color: 'var(--mint)' },
  { key: 'violet', label: 'Фиолетовый', color: '#a97bff' },
];

const PIN_LIMIT = 6;

/**
 * Витрина профиля: что человек показывает о себе и как это выглядит.
 *
 * Здесь нет ни одного поля вида «расскажите о себе». Всё, из чего
 * собирается страница, человек уже отметил, пока пользовался лентой, —
 * настроить можно только порядок и видимость. Так профиль не пустует
 * у тех, кто не любит заполнять анкеты, а таких большинство.
 */
export function ShowcaseEditor({ open, onClose, uid, profile, favorites = {}, onSaved, toasts }) {
  const [form, setForm] = useState({
    pinnedIds: [], heroId: null, accent: 'coral',
    showFilms: true, showRatings: true, showWatched: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      pinnedIds: profile?.pinned_ids ?? [],
      heroId: profile?.hero_id ?? null,
      accent: profile?.accent ?? 'coral',
      showFilms: profile?.show_films ?? true,
      showRatings: profile?.show_ratings ?? true,
      showWatched: profile?.show_watched ?? true,
    });
  }, [open, profile]);

  /*
   * Выбирать можно только из любимого. Это и есть смысл визитки:
   * не «любой фильм из каталога», а «вот эти из тех, что я уже назвал
   * своими». Иначе закреплённое перестаёт что-либо значить.
   */
  const options = useMemo(
    () => Object.values(favorites).sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)),
    [favorites],
  );

  const togglePin = (id) => setForm((f) => {
    if (f.pinnedIds.includes(id)) return { ...f, pinnedIds: f.pinnedIds.filter((x) => x !== id) };
    if (f.pinnedIds.length >= PIN_LIMIT) return f;
    return { ...f, pinnedIds: [...f.pinnedIds, id] };
  });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await saveShowcase(uid, form);
      onSaved?.(saved);
      toasts?.success('Профиль обновлён');
      onClose?.();
    } catch (error) {
      toasts?.error(error?.message ?? 'Не получилось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Витрина профиля">
      <form className="stack gap-5" onSubmit={submit}>
        <section className="stack gap-3">
          <span className="field__label">Цвет страницы</span>
          <div className="row gap-3">
            {ACCENTS.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`accent-dot ${form.accent === item.key ? 'accent-dot--on' : ''}`}
                style={{ '--dot': item.color }}
                aria-label={item.label}
                aria-pressed={form.accent === item.key}
                onClick={() => setForm((f) => ({ ...f, accent: item.key }))}
              >
                {form.accent === item.key && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>

        {options.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Сначала отметьте любимое"
            text="Визитка собирается из фильмов, которым вы поставили сердечко. Отметьте несколько — и они появятся здесь."
          />
        ) : (
          <>
            <section className="stack gap-3">
              <span className="field__label">
                <Bookmark size={14} /> Визитка — до {PIN_LIMIT} фильмов
              </span>
              <p className="faint" style={{ fontSize: 'var(--t-micro)' }}>
                Их увидят первыми. Выбрано {form.pinnedIds.length} из {PIN_LIMIT}.
              </p>
              <div className="pick-grid">
                {options.map((item) => {
                  const on = form.pinnedIds.includes(item.id);
                  const order = form.pinnedIds.indexOf(item.id) + 1;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`pick-card ${on ? 'pick-card--on' : ''}`}
                      aria-pressed={on}
                      onClick={() => togglePin(item.id)}
                      title={item.title}
                    >
                      <Poster src={item.poster} alt={item.title} size="w185" />
                      {on && <span className="pick-card__badge">{order}</span>}
                      <span className="pick-card__cap truncate">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="stack gap-3">
              <span className="field__label"><Star size={14} /> Фильм про себя</span>
              <p className="faint" style={{ fontSize: 'var(--t-micro)' }}>
                Его постер станет обложкой страницы.
              </p>
              <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`chip chip--interactive ${!form.heroId ? 'chip--on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, heroId: null }))}
                >
                  без обложки
                </button>
                {options.slice(0, 12).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`chip chip--interactive ${form.heroId === item.id ? 'chip--on' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, heroId: item.id }))}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="stack gap-3">
          <span className="field__label">Что видно другим</span>
          {/*
            * Открыто по умолчанию, но каждый раздел закрывается отдельно.
            * Скрытые фильмы прячут и совпадение по ним: иначе закрытый
            * список вычерпывался бы по одному фильму через сравнение.
            */}
          <Toggle
            label="Любимые фильмы"
            hint="Витрина, любимое и совпадение с другими"
            value={form.showFilms}
            onChange={(v) => setForm((f) => ({ ...f, showFilms: v }))}
          />
          <Toggle
            label="Оценки"
            hint="Что оценил выше всего и средний балл"
            value={form.showRatings}
            onChange={(v) => setForm((f) => ({ ...f, showRatings: v }))}
          />
          <Toggle
            label="Сколько просмотрено"
            hint="Только число, без списка"
            value={form.showWatched}
            onChange={(v) => setForm((f) => ({ ...f, showWatched: v }))}
          />
        </section>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </form>
    </Sheet>
  );
}

/* Тот же переключатель, что в настройках профиля: одинаковые вещи
   не должны выглядеть по-разному от экрана к экрану. */
function Toggle({ label, hint, value, onChange }) {
  return (
    <label className="member" style={{ cursor: 'pointer' }}>
      <span className="stack grow">
        <span className="member__name">{label}</span>
        <span className="member__state">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 20, height: 20, accentColor: 'var(--coral)' }}
      />
    </label>
  );
}
