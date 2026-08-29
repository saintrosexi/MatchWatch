import { Compass, Flame } from '../../ui/icons.js';

/**
 * Переключатель режима ленты.
 *
 * Два состояния, а не список: выбор между «полистать своё» и «покажи
 * другое» человек делает не глядя, на ходу, и лишний экран настроек
 * здесь означал бы, что переключать не будут вовсе.
 *
 * Обе подписи видны всегда: у крупного тумблера посреди экрана скрытая
 * половина читается как одна кнопка с непонятной иконкой, и человек
 * не видит, между чем выбирает.
 */
const MODES = [
  { key: 'calm', label: 'Моё', icon: Flame, hint: 'Похожее на любимое' },
  { key: 'discovery', label: 'Другое', icon: Compass, hint: 'Незнакомое и по сегодняшнему настроению' },
];

export function FeedModeSwitch({ value = 'calm', onChange }) {
  return (
    <div className="feed-switch" role="group" aria-label="Режим ленты">
      {MODES.map(({ key, label, icon: Icon, hint }) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            className={`feed-switch__item ${on ? 'feed-switch__item--on' : ''}`}
            aria-pressed={on}
            title={hint}
            onClick={() => onChange?.(key)}
          >
            <Icon size={16} weight={on ? 'fill' : 'regular'} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
