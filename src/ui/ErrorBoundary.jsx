import { Component } from 'react';
import { RotateCcw } from './icons.js';
import { trackError } from '../lib/telemetry.js';
import { LEVEL, MODULE } from '../../shared/telemetry/events.js';

/**
 * Последний рубеж: сбой рендера не должен оставлять пользователя
 * перед чёрным экраном без объяснений и без выхода.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    trackError(error?.message ?? 'Сбой рендера React', {
      module: this.props.module ?? MODULE.UI,
      level: LEVEL.CRITICAL,
      error,
      context: { componentStack: info?.componentStack?.slice(0, 1500), boundary: this.props.name },
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="state">
        <h3 className="state__title">Что-то сломалось</h3>
        <p className="state__text">
          Мы уже знаем об этой ошибке и разбираемся. Можно перезагрузить экран
          и продолжить — ваши свайпы сохранены.
        </p>
        <div className="row gap-3">
          <button type="button" className="btn btn--primary"
            onClick={() => this.setState({ error: null })}>
            <RotateCcw size={16} /> Попробовать снова
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }
}
