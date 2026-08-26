import { useEffect, useState } from 'react';
import { Heart, Loader2, ICON } from '../../ui/icons.js';
import { Poster } from '../../ui/Poster.jsx';
import { listNames } from '../../../shared/i18n/plural.js';

/**
 * Почти-совпадения на паузе.
 *
 * Мэтч по-прежнему требует согласия каждого — иначе он перестанет
 * что-либо значить. Но почти-совпадения до сих пор пропадали молча:
 * в одной комнате четыре раза двое из троих выбирали один и тот же
 * фильм, и вечер каждый раз кончался ничем.
 *
 * Показывается ровно там, где человек и так стоит без дела — на экране
 * ожидания. Вклиниваться в ленту с этим нельзя: посреди свайпов такой
 * вопрос читается как давление, а на паузе он к месту.
 *
 * Имена вместо «большинства» намеренно. «Аня и Егор выбрали» говорит
 * больше, чем «двое из трёх»: в комнате сидят знакомые люди, и чьё
 * именно мнение совпало — половина ответа на вопрос, соглашаться ли.
 */
export function NearMatches({ items = [], onAgree, onRefresh }) {
  const [busy, setBusy] = useState(null);
  const [declined, setDeclined] = useState(() => new Set());

  useEffect(() => { onRefresh?.(); }, [onRefresh]);

  const visible = items.filter((item) => !declined.has(item.titleId));
  if (!visible.length) return null;

  const agree = async (item) => {
    setBusy(item.titleId);
    try {
      await onAgree(item);
    } finally {
      setBusy(null);
    }
  };

  /*
   * Отказ живёт только в этой сессии и никуда не пишется. «Не хочу
   * обсуждать это сейчас» — не то же самое, что «нет» фильму: голос
   * человека остаётся прежним, просто вопрос снят с экрана.
   */
  const decline = (item) => {
    setDeclined((prev) => new Set(prev).add(item.titleId));
  };

  return (
    <section className="section near">
      <div className="section__head">
        <h2 className="section__title">Пока ждёте</h2>
      </div>

      {visible.map((item) => (
        <div className="near__item" key={item.titleId}>
          {item.title?.poster
            ? <Poster className="near__poster" src={item.title.poster} alt="" />
            : <div className="near__poster surface" />}

          <div className="stack grow gap-1">
            <span className="near__title">{item.title?.title ?? 'Этот фильм'}</span>
            <span className="near__who">
              <b>{listNames(item.likedBy)}</b> уже за
              {item.skipped ? ' — а вы прошли мимо' : ''}
            </span>
            <span className="faint" style={{ fontSize: 'var(--t-micro)' }}>
              {item.skipped
                ? 'Передумаете — сойдётесь на нём и закроете вечер.'
                : 'Скажете «да» — будет мэтч, и искать дальше не придётся.'}
            </span>
          </div>

          <div className="stack gap-2">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy === item.titleId}
              onClick={() => agree(item)}
            >
              {busy === item.titleId
                ? <Loader2 size={ICON.sm} className="spin" />
                : <><Heart size={ICON.sm} weight="fill" /> Давайте</>}
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              disabled={busy === item.titleId}
              onClick={() => decline(item)}
            >
              Не хочу
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

