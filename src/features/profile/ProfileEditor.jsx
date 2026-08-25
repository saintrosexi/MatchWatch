import { useEffect, useState } from 'react';
import { AtSign, Check, Image as ImageIcon, Loader2, UserRound } from 'lucide-react';
import { Sheet } from '../../ui/Sheet.jsx';
import { isUsernameAvailable, saveProfile, suggestUsername } from '../../engine/social.js';
import { getTelegramUser } from '../../lib/telegram.js';

const BIO_LIMIT = 280;

/**
 * Редактор профиля.
 *
 * Ник проверяется на занятость по мере ввода, но окончательный арбитр —
 * уникальный индекс в базе: между проверкой и отправкой проходят
 * секунды, и за это время ник может занять кто-то другой.
 */
export function ProfileEditor({ open, onClose, uid, profile, onSaved, toasts }) {
  const telegram = getTelegramUser();

  const [form, setForm] = useState({ displayName: '', username: '', bio: '', photoURL: '' });
  const [availability, setAvailability] = useState(null); // null | 'checking' | 'free' | 'taken'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      displayName: profile?.display_name ?? profile?.displayName ?? '',
      /*
       * Ник подставляем из Telegram: он уже уникален и человек его знает.
       * Производное от имени — запасной вариант для входа по email.
       */
      username: profile?.username
        ?? suggestUsername(telegram?.username ?? profile?.display_name ?? ''),
      bio: profile?.bio ?? '',
      photoURL: profile?.photo_url ?? profile?.photoURL ?? '',
    });
    setError(null);
    setAvailability(null);
  }, [open, profile]);

  const currentUsername = (profile?.username ?? '').toLowerCase();

  useEffect(() => {
    const value = form.username.trim().toLowerCase();
    if (!open || !value || value === currentUsername) { setAvailability(null); return undefined; }

    setAvailability('checking');
    const timer = setTimeout(() => {
      isUsernameAvailable(value)
        .then((free) => setAvailability(free ? 'free' : 'taken'))
        .catch(() => setAvailability(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [form.username, open, currentUsername]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProfile(uid, form);
      onSaved?.(saved);
      toasts.success('Профиль обновлён');
      onClose();
    } catch (err) {
      setError(err?.message ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const usernameHint = {
    checking: 'проверяем…',
    free: 'ник свободен',
    taken: 'ник уже занят',
  }[availability];

  return (
    <Sheet open={open} onClose={onClose} title="Профиль">
      <form className="stack gap-5" onSubmit={submit}>
        <div className="row gap-4">
          {form.photoURL
            ? <img className="editor__avatar" src={form.photoURL} alt="" />
            : <span className="editor__avatar editor__avatar--empty"><UserRound size={28} /></span>}

          <div className="stack gap-2 grow" style={{ minWidth: 0 }}>
            <span className="field__label">Аватар</span>
            {telegram?.photo_url && form.photoURL !== telegram.photo_url && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setForm((f) => ({ ...f, photoURL: telegram.photo_url }))}
              >
                <ImageIcon size={14} /> Взять из Telegram
              </button>
            )}
            <input
              className="input"
              type="url"
              placeholder="Ссылка на изображение"
              value={form.photoURL}
              onChange={(e) => setForm((f) => ({ ...f, photoURL: e.target.value }))}
            />
          </div>
        </div>

        <label className="field">
          <span className="field__label">Имя</span>
          <input
            className="input"
            type="text"
            maxLength={60}
            placeholder="Как вас зовут"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          />
          <span className="faint" style={{ fontSize: 'var(--t-micro)' }}>
            Показывается в комнатах и в профиле. Может повторяться — это не адрес.
          </span>
        </label>

        <label className="field">
          <span className="field__label">Ник</span>
          <div className="row gap-2 surface" style={{ padding: '0 var(--s-3)', borderRadius: 'var(--r-sm)' }}>
            <AtSign size={16} color="var(--text-low)" />
            <input
              className="input"
              style={{ background: 'none', border: 'none' }}
              type="text"
              maxLength={24}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="nickname"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9._]/g, '') }))}
            />
            {availability === 'checking' && <Loader2 size={15} color="var(--text-low)" />}
            {availability === 'free' && <Check size={15} color="var(--mint)" />}
          </div>
          <span
            className="faint"
            style={{ fontSize: 'var(--t-micro)', color: availability === 'taken' ? 'var(--coral)' : undefined }}
          >
            {usernameHint ?? 'По нику вас найдут друзья. 3–24 символа: латиница, цифры, точка, подчёркивание.'}
          </span>
        </label>

        <label className="field">
          <span className="field__label">О себе</span>
          <textarea
            className="input"
            style={{ minHeight: 88, padding: 'var(--s-3)', resize: 'vertical', lineHeight: 1.5 }}
            maxLength={BIO_LIMIT}
            placeholder="Что смотрите и что советуете"
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          />
          <span className="faint" style={{ fontSize: 'var(--t-micro)' }}>
            {form.bio.length} из {BIO_LIMIT}
          </span>
        </label>

        {error && <p className="auth__error">{error}</p>}

        <button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          disabled={saving || availability === 'taken'}
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </form>
    </Sheet>
  );
}
