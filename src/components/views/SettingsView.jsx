import React, { useState } from 'react';
import { Volume2, VolumeX, Smartphone, Palette, Trash2, Download, RotateCcw, ArrowLeft, Check, Shield } from 'lucide-react';
import { triggerHaptic } from '../../engine/hapticsEngine.js';
import { playSound, setSoundEnabled } from '../../engine/soundEngine.js';

export function SettingsView({
  soundOn,
  setSoundOn,
  onResetDislikesOnly,
  onResetAllData,
  onClose,
  allLikesData = {}
}) {
  const [resetDislikesConfirmed, setResetDislikesConfirmed] = useState(false);
  const [resetAllConfirmed, setResetAllConfirmed] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allLikesData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `matchwatch_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setExported(true);
      triggerHaptic('success');
      setTimeout(() => setExported(false), 2000);
    } catch (e) {
      console.warn('Export error:', e);
    }
  };

  return (
    <div style={{ padding: '0 16px 24px', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          onClick={onClose}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.8rem' }}
        >
          <ArrowLeft size={16} /> Назад
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Настройки</h2>
        <div style={{ width: '40px' }} />
      </div>

      {/* Viewport Mode Switcher */}
      <div className="glass-panel" style={{ padding: '18px', marginBottom: '18px' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '4px' }}>Режим отображения</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Переключение между широкоформатной десктоп-студией и мобильной версией
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'auto', label: '⚡ Авто' },
            { id: 'desktop', label: '🖥 ПК / Десктоп' },
            { id: 'mobile', label: '📱 Мобильный' }
          ].map((v) => {
            const currentMode = localStorage.getItem('mw_viewport_mode') || 'auto';
            const isSelected = currentMode === v.id;
            return (
              <button
                key={v.id}
                onClick={() => {
                  triggerHaptic('medium');
                  playSound('tap');
                  localStorage.setItem('mw_viewport_mode', v.id);
                  window.location.reload();
                }}
                className={isSelected ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, padding: '8px', fontSize: '0.75rem' }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sound Settings */}
      <div className="glass-panel" style={{ padding: '18px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>Звуковые эффекты SFX</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Тактильные синтезаторные звуки свайпов и побед</div>
          </div>
          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
              triggerHaptic('light');
              if (next) playSound('tap');
            }}
            className={soundOn ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 15px', fontSize: '0.8rem' }}
          >
            {soundOn ? 'Включен' : 'Выключен'}
          </button>
        </div>
      </div>

      {/* Persistent Data Safety Card */}
      <div className="glass-panel" style={{ padding: '18px', marginBottom: '18px', border: '1px solid rgba(50, 215, 75, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Shield size={18} color="var(--accent-emerald)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--accent-emerald)' }}>
            Защита базы данных
          </h3>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '12px' }}>
          Все ваши лайки ({allLikesData.likedIds?.length || 0}) и избранное ({allLikesData.superlikeIds?.length || 0}) надёжно зафиксированы. Свайпнутые фильмы никогда повторно не попадут в подборку.
        </p>

        <button
          onClick={handleExport}
          className="btn-secondary"
          style={{ width: '100%', fontSize: '0.825rem' }}
        >
          {exported ? <Check size={16} color="var(--accent-emerald)" /> : <Download size={16} />}
          {exported ? 'Файл скачан!' : 'Скачать резервную копию лайков (JSON)'}
        </button>
      </div>

      {/* Reset Dislikes ONLY (Safe Action) */}
      <div className="glass-panel" style={{ padding: '18px', marginBottom: '18px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ff9966', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RotateCcw size={16} /> Сбросить только историю пропусков
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
          Вернуть пропущенные фильмы обратно в колоду для повторного рассмотрения. Ваши лайки и избранное останутся нетронутыми!
        </p>

        {resetDislikesConfirmed ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                triggerHaptic('medium');
                if (onResetDislikesOnly) onResetDislikesOnly();
                setResetDislikesConfirmed(false);
              }}
              className="btn-primary"
              style={{ flex: 1, fontSize: '0.825rem' }}
            >
              Подтвердить сброс пропусков
            </button>
            <button
              onClick={() => setResetDislikesConfirmed(false)}
              className="btn-secondary"
              style={{ fontSize: '0.825rem' }}
            >
              Отмена
            </button>
          </div>
        ) : (
          <button
            onClick={() => setResetDislikesConfirmed(true)}
            className="btn-secondary"
            style={{ width: '100%', fontSize: '0.825rem' }}
          >
            Сбросить только пропуски ({allLikesData.dislikedIds?.length || 0})
          </button>
        )}
      </div>

      {/* Full Reset Danger Zone */}
      <div className="glass-panel" style={{ padding: '18px', borderColor: 'rgba(255, 71, 87, 0.25)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ff5e62', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trash2 size={16} /> Полный сброс всех данных
        </h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Удалит все лайки, избранное и историю на этом устройстве.
        </p>

        {resetAllConfirmed ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                triggerHaptic('heavy');
                onResetAllData();
                setResetAllConfirmed(false);
                onClose();
              }}
              className="btn-primary"
              style={{ flex: 1, background: 'var(--accent-coral)', fontSize: '0.825rem' }}
            >
              Да, удалить всё
            </button>
            <button
              onClick={() => setResetAllConfirmed(false)}
              className="btn-secondary"
              style={{ fontSize: '0.825rem' }}
            >
              Отмена
            </button>
          </div>
        ) : (
          <button
            onClick={() => setResetAllConfirmed(true)}
            className="btn-secondary"
            style={{ width: '100%', borderColor: 'rgba(255, 71, 87, 0.3)', color: '#ff5e62', fontSize: '0.825rem' }}
          >
            Очистить все данные
          </button>
        )}
      </div>
    </div>
  );
}
