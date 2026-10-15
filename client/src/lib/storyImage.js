import { schoolLabel } from './constants.js';
import { tagInfo } from './confessions.js';

const W = 1080;
const H = 1920;

const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Текстийг өргөнд багтаан мөрлөнө (урт үгийг тэмдэгтээр хуваана). */
function wrap(ctx, text, maxWidth) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
        continue;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
      } else {
        let chunk = '';
        for (const ch of [...word]) {
          if (ctx.measureText(chunk + ch).width > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Instagram/Facebook story-д зориулсан 1080×1920 зураг үүсгэнэ.
 * Сайтын одоогийн өнгө (accent, дэвсгэр)-ийг ашиглана.
 */
export async function renderStoryImage(item) {
  try {
    await Promise.all([
      document.fonts.load('600 60px Inter'),
      document.fonts.load('500 36px Inter'),
      document.fonts.load('700 60px Unbounded'),
    ]);
  } catch {
    /* фонт ачаалагдаагүй ч system фонтоор зурна */
  }

  const accent = cssVar('--accent', '#ff3d8b');
  const accentAlt = cssVar('--accent-alt', '#4d8bff');
  const bg = cssVar('--bg', '#070b16');
  const surface = cssVar('--surface-2', '#162142');

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Дэвсгэр
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${color}55`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W * 0.9, H * 0.05, 900, accent);
  glow(W * 0.05, H * 0.98, 900, accentAlt);

  // Дээд хэсэг: "Нууц хана"
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '600 38px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🤫  НУУЦ ХАНА', W / 2, 250);

  // Карт
  const cardX = 90;
  const cardW = W - 180;
  const padX = 72;
  const textMax = cardW - padX * 2;

  // Текстийн хэмжээг багтаан сонгоно
  const text = item.text.trim();
  let size = 64;
  let lines;
  for (; size >= 34; size -= 2) {
    ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
    lines = wrap(ctx, text, textMax);
    if (lines.length * size * 1.38 <= 980) break;
  }
  const lineH = size * 1.38;
  const maxLines = Math.floor(1000 / lineH);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s*\S*$/, '')}…`;
  }

  const textH = lines.length * lineH;
  const cardH = Math.max(560, textH + 300);
  const cardY = Math.max(330, (H - cardH) / 2 - 40);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Accent зураас
  const bar = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
  bar.addColorStop(0, accent);
  bar.addColorStop(1, accentAlt);
  roundRect(ctx, cardX + padX, cardY + 64, 120, 10, 5);
  ctx.fillStyle = bar;
  ctx.fill();

  // Ангилал, сургууль
  const tag = tagInfo(item.tag);
  const meta = [`${tag.emoji} ${tag.label}`, item.school ? schoolLabel(item.school) : ''].filter(Boolean).join('   ·   ');
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '500 36px Inter, system-ui, sans-serif';
  ctx.fillText(meta, cardX + padX, cardY + 150);

  // Текст
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  let y = cardY + 150 + 60 + size;
  for (const line of lines) {
    ctx.fillText(line, cardX + padX, y);
    y += lineH;
  }

  // Like
  if (item.likes > 0) {
    ctx.fillStyle = accent;
    ctx.font = '600 36px Inter, system-ui, sans-serif';
    ctx.fillText(`❤ ${item.likes}`, cardX + padX, cardY + cardH - 60);
  }

  // Доод хэсэг: лого + хаяг
  ctx.textAlign = 'center';
  ctx.font = '700 72px Unbounded, Inter, sans-serif';
  const logo = ctx.createLinearGradient(W / 2 - 160, 0, W / 2 + 160, 0);
  logo.addColorStop(0, accent);
  logo.addColorStop(1, accentAlt);
  ctx.fillStyle = logo;
  ctx.fillText('noone', W / 2, H - 260);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 38px Inter, system-ui, sans-serif';
  ctx.fillText('Чи ч бас нэрээ нууцлаад бич 👀', W / 2, H - 190);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 34px Inter, system-ui, sans-serif';
  ctx.fillText(`${window.location.host}/hana`, W / 2, H - 135);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png'),
  );
}
