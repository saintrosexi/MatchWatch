import { useState } from 'react';
import { MOOD_PRESETS, REWATCH, moodPreset } from '../../../shared/config/moodPresets.js';
import { Check, Heart, ICON } from '../../ui/icons.js';

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
export function MoodPicker({ myMood = [], members = [], me, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const selected = new Set(myMood);

  const toggle = async (key) => {
    if (busy || disabled) return;
    const next = selected.has(key)
      ? myMood.filter((k) => k !== key)
      : [...myMood, key];

    setBusy(true);
    try {
      await onChange(next);
    } finally {
      setBusy(false);
    }
  };

  // Чужие выборы: показываем рядом с именем, чтобы спор случился до колоды.
  const others = members.filter((m) => m.uid !== me?.uid && (m.mood?.length ?? 0) > 0);

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Чего хотите сегодня</h2>
        {selected.size > 0 && <span className="chip">{selected.size}</span>}
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
        * Пересмотр стоит отдельно: это не настроение, а состав колоды —
        * в неё подмешивается уже любимое, вместо того чтобы исключаться.
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
              {member.mood
                .map((key) => (key === REWATCH ? 'пересмотреть любимое' : moodPreset(key)?.label?.toLowerCase()))
                .filter(Boolean)
                .join(', ')}
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
