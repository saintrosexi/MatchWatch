import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Download, Share2, Sparkles } from 'lucide-react';
import { Sheet } from '../../ui/Sheet.jsx';
import { Poster, posterVariant } from '../../ui/Poster.jsx';
import { downloadMatchImage, haptic, roomInviteLink, shareToTelegram, shareViaInlineQuery } from '../../lib/telegram.js';
import { trackMetric, trackError } from '../../lib/telemetry.js';
import { METRIC, MODULE } from '../../../shared/telemetry/events.js';

/**
 * Празднование обоюдного лайка: конфетти, звук, тактильный отклик
 * и готовая карточка для репоста.
 */
export function MatchCelebration({ match, roomCode, onClose, onOpenWatchlist }) {
  const canvasRef = useRef(null);
  const [shareUrl, setShareUrl] = useState(null);

  useEffect(() => {
    if (!match) return undefined;
    haptic('success');

    const duration = 1600;
    const end = Date.now() + duration;
    const colors = ['#FFC24B', '#FF4D5E', '#FF7A3D', '#6FD8FF'];

    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 62, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true });
      confetti({ particleCount: 4, angle: 120, spread: 62, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    return () => confetti.reset?.();
  }, [match]);

  /* Карточка мэтча рисуется в canvas — её можно репостнуть картинкой. */
  useEffect(() => {
    if (!match) return;
    renderShareCard(match, canvasRef.current)
      .then(setShareUrl)
      .catch((error) => {
        // Постер мог «испортить» canvas из-за CORS — тогда делимся текстом.
        trackError('Не удалось отрисовать карточку мэтча', {
          module: MODULE.SHARE, level: 'warning', error,
        });
        setShareUrl(null);
      });
  }, [match]);

  if (!match) return null;

  const text = `Совпали на «${match.title}»! Смотрим вместе 🍿`;
  const inviteUrl = roomInviteLink(roomCode) ?? window.location.origin;

  const handleShare = () => {
    trackMetric(METRIC.MATCH_SHARED, { room: roomCode, context: { titleId: match.titleId } });
    // switchInlineQuery отправляет карточку с постером прямо в чат:
    // получателю не нужно открывать приложение, чтобы её увидеть.
    if (shareViaInlineQuery(`match ${match.titleId}`, ['users', 'groups'])) return;
    if (shareToTelegram({ url: inviteUrl, text })) return;
    navigator.share?.({ title: 'MatchWatch', text, url: inviteUrl })
      ?.catch(() => navigator.clipboard?.writeText(`${text} ${inviteUrl}`));
  };

  return (
    <Sheet open onClose={onClose} variant="center">
      <div className="celebrate">
        <span className="eyebrow"><Sparkles size={12} /> Совпадение</span>
        <h2 className="celebrate__title">Мэтч!</h2>

        {match.poster
          ? <Poster className="celebrate__poster" src={match.poster} alt={match.title} eager />
          : <div className="celebrate__poster surface" />}

        <div className="stack gap-1">
          <h3 style={{ fontSize: 'var(--t-title)' }}>{match.title}</h3>
          {match.year && <span className="muted">{match.year}</span>}
        </div>

        <p className="state__text">
          Вы оба свайпнули вправо. Фильм уже в вашем общем списке «к просмотру».
        </p>

        <canvas ref={canvasRef} width={1080} height={1350} style={{ display: 'none' }} />

        <div className="row gap-3" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn btn--gold" onClick={handleShare}>
            <Share2 size={16} /> Поделиться
          </button>
          {shareUrl && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (!downloadMatchImage(shareUrl, `matchwatch-${match.titleId}.png`)) {
                  const a = document.createElement('a');
                  a.href = shareUrl;
                  a.download = 'matchwatch.png';
                  a.click();
                }
              }}
            >
              <Download size={16} /> Сохранить
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onOpenWatchlist}>
            К списку
          </button>
        </div>

        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Свайпать дальше
        </button>
      </div>
    </Sheet>
  );
}

/** Рисует шер-карточку 1080×1350: постер + подпись. */
async function renderShareCard(match, canvas) {
  if (!canvas) throw new Error('canvas недоступен');
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  if (match.poster) {
    const image = await loadImage(posterVariant(match.poster, 'w780'));
    const scale = Math.max(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    ctx.globalAlpha = 1;

    const cardW = width * 0.56;
    const cardH = cardW * 1.5;
    const cardX = (width - cardW) / 2;
    const cardY = height * 0.14;
    roundRect(ctx, cardX, cardY, cardW, cardH, 36);
    ctx.save();
    ctx.clip();
    ctx.drawImage(image, cardX, cardY, cardW, cardH);
    ctx.restore();
  }

  const gradient = ctx.createLinearGradient(0, height * 0.55, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.96)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFC24B';
  ctx.font = '700 44px Inter, system-ui, sans-serif';
  ctx.fillText('MATCHWATCH · СОВПАДЕНИЕ', width / 2, height - 300);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 76px Inter, system-ui, sans-serif';
  wrapText(ctx, `«${match.title}»`, width / 2, height - 190, width - 140, 86);

  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.font = '500 38px Inter, system-ui, sans-serif';
  ctx.fillText('Совпали и смотрим вместе 🍿', width / 2, height - 80);

  return canvas.toDataURL('image/png');
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Постер не загрузился: ${src}`));
  img.src = src;
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  const start = y - (lines.length - 1) * lineHeight;
  lines.slice(-3).forEach((l, i) => ctx.fillText(l, x, start + i * lineHeight));
}
