import React, { useState, useEffect } from "react";

export const CHAMA_IMAGES = {
  WAVING: "/chama/Mascot_waving_paw_smiling_202607301353.jpeg",
  SWIPE_TUTORIAL: "/chama/Mascot_demonstrating_swipe_gestures_202607301352.jpeg",
  GESTURE_CARDS: "/chama/Mascot_gesturing_towards_UI_cards_202607301352.jpeg",
  THUMBS_UP: "/chama/Mascot_giving_thumbs_up_holding_202607301353.jpeg",
  CINEMA_SEAT: "/chama/Mascot_sitting_in_cinema_202607301353.jpeg",
  WRAPPED_BLANKET: "/chama/Mascot_wrapped_in_blanket_holdin…_202607301353.jpeg",
  EATING_NACHOS: "/chama/Mascot_eating_nacho_chip_202607301352.jpeg",
  SEARCH_GLASS: "/chama/Чама_wearing_hat_magnifying_glass_202607301353.jpeg",
  EMPTY_POPCORN: "/chama/Чама_sad_confused_empty_popcorn_202607301353.jpeg",
  DISCONNECTED_PLUG: "/chama/Чама_holding_plug_disconnected_r…_202607301352.jpeg",
  CONFETTI_JUMP: "/chama/Chamа_jumping_throwing_confetti_202607301353.jpeg",
  CROWN_CAPE: "/chama/Чама_wearing_crown_cape_202607301352.jpeg",
  POINTER_STICK: "/chama/Чама_holding_pointer_stick_gestu…_202607301352.jpeg",
  PUSHING_BUTTON: "/chama/Чама_pushing_UI_button_202607301352.jpeg",
  SITTING_SOFA: "/chama/Чама_sitting_on_sofa_holding_202607301353.jpeg",
  FILM_REEL: "/chama/Чама_sitting_on_film_reel_202607301352.jpeg",
  ASTRONAUT: "/chama/Чама_wearing_astronaut_helmet_fl…_202607301352.jpeg",
  WIZARD: "/chama/Чама_wearing_wizard_hat_wand_202607301352.jpeg",
  SUNGLASSES: "/chama/Чама_wearing_sunglasses_action_pose_202607301353.jpeg",
  FORTUNE_WHEEL: "/chama/Чама_spinning_fortune_wheel_202607301352.jpeg",
  SLEEPING: "/chama/Чама_sleeping_peacefully_blanket_202607301353.jpeg"
};

const transparentCacheMap = new Map();

/**
 * Custom Hook: Strips white background from JPEG images on-the-fly using HTML5 Canvas,
 * converting opaque white pixels into true transparent alpha values with in-memory caching.
 */
export function useTransparentImage(src) {
  const [transparentSrc, setTransparentSrc] = useState(() => transparentCacheMap.get(src) || src);

  useEffect(() => {
    if (!src) return;
    if (transparentCacheMap.has(src)) {
      setTransparentSrc(transparentCacheMap.get(src));
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Flood fill from outer image borders to remove ONLY external background
        const visited = new Uint8Array(w * h);
        const queue = [];

        const isBgPixel = (idx) => {
          const r = data[idx], g = data[idx+1], b = data[idx+2];
          return r > 185 && g > 185 && b > 185;
        };

        // Push border pixels
        for (let x = 0; x < w; x++) {
          const topIdx = (0 * w + x) * 4;
          const botIdx = ((h - 1) * w + x) * 4;
          if (isBgPixel(topIdx)) { queue.push(x, 0); visited[0 * w + x] = 1; }
          if (isBgPixel(botIdx)) { queue.push(x, h - 1); visited[(h - 1) * w + x] = 1; }
        }
        for (let y = 0; y < h; y++) {
          const leftIdx = (y * w + 0) * 4;
          const rightIdx = (y * w + (w - 1)) * 4;
          if (!visited[y * w + 0] && isBgPixel(leftIdx)) { queue.push(0, y); visited[y * w + 0] = 1; }
          if (!visited[y * w + (w - 1)] && isBgPixel(rightIdx)) { queue.push(w - 1, y); visited[(y * w + (w - 1))] = 1; }
        }

        let head = 0;
        while (head < queue.length) {
          const cx = queue[head++];
          const cy = queue[head++];
          const idx = (cy * w + cx) * 4;
          data[idx + 3] = 0; // Make background pixel 100% transparent

          const neighbors = [
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
          ];
          for (let i = 0; i < neighbors.length; i++) {
            const nx = neighbors[i][0];
            const ny = neighbors[i][1];
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nPos = ny * w + nx;
              if (!visited[nPos]) {
                const nIdx = nPos * 4;
                if (isBgPixel(nIdx)) {
                  visited[nPos] = 1;
                  queue.push(nx, ny);
                }
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        transparentCacheMap.set(src, dataUrl);
        setTransparentSrc(dataUrl);
      } catch (err) {
        setTransparentSrc(src);
      }
    };
    img.onerror = () => setTransparentSrc(src);
    img.src = src;
  }, [src]);

  return transparentSrc;
}

/**
 * ChamaMascot Banner / Avatar Component
 */
export function ChamaBanner({ type = "WAVING", text, title, actionText, onAction, size = "medium", className = "" }) {
  if (!title && !text) return null;

  return (
    <div className={`chama-banner flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm transition-all opacity-90 ${className}`}>
      <div className="flex-1 min-w-0">
        {title && <h5 className="text-white/90 font-semibold text-xs mb-0.5 flex items-center gap-1.5 opacity-90">{title}</h5>}
        {text && <p className="text-gray-400 text-xs leading-relaxed opacity-80">{text}</p>}
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="mt-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white font-medium text-[11px] shadow-sm hover:opacity-90 transition"
          >
            {actionText}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * ChamaBackgroundArt — Renders Chama mascot as a subtle, elegant background watermark/overlay
 * positioned gracefully behind content without taking attention away from movies.
 */
export function ChamaBackgroundArt({ type = "SEARCH_GLASS", opacity = 0.08, className = "" }) {
  return null;
}

export default CHAMA_IMAGES;
