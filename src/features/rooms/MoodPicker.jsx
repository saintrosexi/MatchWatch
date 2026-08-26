import { useState } from 'react';
import { MOOD_PRESETS, REWATCH, moodPreset } from '../../../shared/config/moodPresets.js';
import { Check, Heart, Loader2, Sparkles, X, ICON } from '../../ui/icons.js';
import { api, describeError } from '../../lib/api.js';

/**
 * Настроение на сегодня.
 *
 * Выбор виден всем в комнате намеренно: так до сборки колоды понятно,
 * что напротив хотят другого, и можно договориться заранее — а не после,
 * когда подборка уже собрана и пересобрать её нельзя.
 *
 * Ничего не выбрать — нормально. Пустой запрос означает «мне всё равно»,
 * и колода тогда строится по одному накопленному вкусу.
 */
export function MoodPicker({ myMood, members = [], me, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const keys = myMood?.keys ?? [];
  const ai = myMood?.ai ?? null;
  const selected = new Set(keys);

  const toggle = async (key) => {
    if (busy || disabled) return;
    const next = selected.has(key)
      ? keys.filter((k) => k !== key)
      : [...keys, key];

    setBusy(true);
    try {
      await onChange(next, ai);
    } finally {
      setBusy(false);
    }
  };

  // Чужие выборы: показываем рядом с именем, чтобы спор случился до колоды.
  const others = members.filter((m) => {
    if (m.uid === me?.uid) return false;
    return (m.mood?.keys?.length ?? 0) > 0 || Boolean(m.mood?.ai);
  });

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Чего хотите сегодня</h2>
        {(selected.size > 0 || ai) && (
          <span className="chip">{selected.size + (ai ? 1 : 0)}</span>
        )}
      </div>

      <div className="mood-grid">
        {MOOD_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className="mood-chip"
            aria-pressed={selected.has(preset.key)}
            disabled={busy || disabled}
            onClick={() => toggle(preset.key)}
          >
            <span className="mood-chip__label">{preset.label}</span>
            <span className="mood-chip__hint">{preset.hint}</span>
            {selected.has(preset.key) && <Check size={ICON.sm} className="mood-chip__check" />}
          </button>
        ))}
      </div>

      {/*
        * Своими словами — рядом с чипами, а не вместо них.
        *
        * Шесть кнопок покрывают шесть случаев, а формулируют иначе:
        * «лёгкое, но не тупое», «поплакать, но не про болезни».
        * Кнопки при этом остаются: они работают мгновенно, бесплатно
        * и тогда, когда разбор недоступен.
        */}
      <FreeTextRequest
        value={ai}
        disabled={busy || disabled}
        onApply={(next) => onChange(keys, next)}
      />

      {/*
        * Пересмотр стоит отдельно: это не настроение, а состав колоды —
        * в неё подмешивается уже любимое, вместо того чтобы исключаться.
        * Разбору фразы он не отдаётся: решение подмешать уже увиденное
        * человек принимает сам, а не через угадывание по словам.
        */}
      <button
        type="button"
        className="mood-chip mood-chip--wide"
        aria-pressed={selected.has(REWATCH)}
        disabled={busy || disabled}
        onClick={() => toggle(REWATCH)}
      >
        <span className="mood-chip__label">
          <Heart size={ICON.sm} weight="fill" /> Пересмотреть любимое
        </span>
        <span className="mood-chip__hint">
          Подмешаем то, что вы уже полюбили — кроме увиденного остальными
        </span>
        {selected.has(REWATCH) && <Check size={ICON.sm} className="mood-chip__check" />}
      </button>

      {others.length > 0 && (
        <div className="stack gap-2">
          {others.map((member) => (
            <p key={member.uid} className="faint" style={{ fontSize: 'var(--t-small)' }}>
              <b>{member.name}</b> хочет:{' '}
              {[
                ...(member.mood?.keys ?? [])
                  .map((key) => (key === REWATCH
                    ? 'пересмотреть любимое'
                    : moodPreset(key)?.label?.toLowerCase())),
                member.mood?.ai?.summary,
              ].filter(Boolean).join(', ')}
            </p>
          ))}
        </div>
      )}

      {disabled && (
        <p className="faint" style={{ fontSize: 'var(--t-micro)' }}>
          Колода уже собрана — менять запрос поздно: пересборка обнулила бы
          прогресс тех, кто начал свайпать.
        </p>
      )}
    </section>
  );
}

/*
 * Настроен ли разбор — выясняется на месте, а не отдельным флагом
 * в клиентских переменных.
 *
 * Флаг пришлось бы держать в двух местах: ключ живёт на сервере, флаг
 * жил бы в сборке, и однажды они разъехались бы — поле показывалось
 * бы без ключа или пряталось при рабочем. Сервер отвечает «не
 * настроено» ровно один раз, после чего поле исчезает до конца сессии.
 */
let aiUnavailable = false;

/**
 * Запрос словами.
 *
 * Разбор идёт до сборки колоды и показывается человеку: «поняли так-то».
 * Показать это раньше, чем подборка собрана, — единственный способ дать
 * поправить, если поняли не так. После сборки менять уже поздно.
 */
function FreeTextRequest({ value, disabled, onApply }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [hidden, setHidden] = useState(aiUnavailable);

  const submit = async (event) => {
    event.preventDefault();
    const phrase = text.trim();
    if (!phrase || busy || disabled) return;

    setBusy(true);
    setError(null);
    try {
      const { request } = await api.aiInterpret(phrase);
      await onApply(request);
      setText('');
    } catch (e) {
      /*
       * Ошибку показываем словами и запрос не применяем. Собрать
       * подборку «как обычно», сделав вид, что фраза учтена, — худший
       * из возможных исходов: человек не узнает, что его не поняли.
       */
      if (e?.code === 'ai_not_configured') {
        aiUnavailable = true;
        setHidden(true);
        return;
      }
      setError(describeError(e).text);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onApply(null);
      setError(null);
    } finally {
      setBusy(false);
    }
  };

  if (hidden && !value) return null;

  if (value) {
    return (
      <div className="mood-free mood-free--applied">
        <span className="mood-free__icon"><Sparkles size={ICON.sm} /></span>
        <span className="stack grow gap-1">
          <span className="mood-free__summary">{value.summary}</span>
          {value.text && (
            <span className="faint" style={{ fontSize: 'var(--t-micro)' }}>
              вы сказали: «{value.text}»
            </span>
          )}
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--icon btn--sm"
          onClick={clear}
          disabled={busy || disabled}
          aria-label="Убрать запрос"
        >
          {busy ? <Loader2 size={ICON.sm} className="spin" /> : <X size={ICON.sm} />}
        </button>
      </div>
    );
  }

  return (
    <form className="mood-free" onSubmit={submit}>
      <input
        className="input grow"
        value={text}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        placeholder="Или скажите словами: лёгкое, но не тупое"
        maxLength={400}
        disabled={busy || disabled}
        aria-label="Чего хочется сегодня, своими словами"
      />
      <button
        type="submit"
        className="btn btn--ghost btn--sm"
        disabled={busy || disabled || !text.trim()}
      >
        {busy ? <><Loader2 size={ICON.sm} className="spin" /> Разбираем…</> : 'Понять'}
      </button>

      {error && (
        <p className="mood-free__error" role="alert">{error}</p>
      )}
    </form>
  );
}
