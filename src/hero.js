// Hero "case wall": a hand-drawn world map with one warming-stripe evidence card per city,
// pinned with red string to the central case file. Stripes come from our own data
// (MERRA-2 yearly air temperature, each year compared with that city's 1991-2020 average).
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
import { t } from './i18n.js?v=20261116w';
import { yearly } from './data.js?v=20261116w';
import { shortSite, CASES } from './content.js?v=20261116w';
import { landPath } from './map.js?v=20261116w';

const W = 960, H = 390, TOP = 80, K = W / 360;
// The map's left/right seam sits in the Bering Strait (169° W), which is open sea, so no
// land is cut at the edges (a seam on the date line would slice through eastern Russia).
const SEAM = -169;
const px = (lon, lat) => [(((lon - SEAM) % 360) + 360) % 360 * K, (TOP - lat) * K];
const CARD_W = 108, CARD_H = 78, STRIPE_H = 36;
// Card positions (top-left) chosen so cards sit near their city without overlapping.
const SLOTS = {
  nuuk: [196, 22], london: [352, 14], moscow: [560, 10], cairo: [574, 112], delhi: [718, 98],
  singapore: [776, 206], sydney: [826, 292], manaus: [206, 214],
};
const FILE = { x: 400, y: 214, w: 180, h: 92 };

// Diverging blue - paper - red scale for anomalies in [-1, 1].
function stripeColor(a) {
  const lerp = (c1, c2, f) => c1.map((v, i) => Math.round(v + (c2[i] - v) * f));
  const blue = [33, 102, 172], mid = [247, 240, 228], red = [178, 24, 43];
  const c = a < 0 ? lerp(mid, blue, Math.min(1, -a)) : lerp(mid, red, Math.min(1, a));
  return `rgb(${c.join(',')})`;
}

function stripes(rows, x, y, w, h) {
  const full = rows.filter(r => r.complete);
  const base = full.filter(r => r.year >= 1991 && r.year <= 2020);
  const mean = base.reduce((s, r) => s + r.value, 0) / base.length;
  const max = Math.max(...full.map(r => Math.abs(r.value - mean))) || 1;
  const bw = w / rows.length;
  return rows.map((r, i) => `<rect x="${(x + i * bw).toFixed(2)}" y="${y}" width="${(bw + 0.4).toFixed(2)}" height="${h}" fill="${r.complete ? stripeColor((r.value - mean) / max) : 'transparent'}"/>`).join('');
}

// "How to read a card" key, centred under the case file so it stays visible on phones.
// A detective's red-marker note on the board: a rough circle round the Manaus card and an
// arrow from a short scribbled line in the empty South Pacific. Drawn once, then it stays still.
function note() {
  return `<g class="cw-mark" aria-hidden="true">
    <path class="cw-ink" pathLength="1" d="M214 205 C262 192, 322 196, 334 228 C346 262, 318 300, 262 304 C214 308, 186 290, 184 258 C182 228, 200 208, 240 199"/>
    <path class="cw-ink cw-ink-2" pathLength="1" d="M120 318 C142 316, 172 312, 192 302"/>
    <path class="cw-ink cw-ink-3" pathLength="1" d="M180 302 L192 302 L190 314"/>
    <text class="cw-mark-t" x="14" y="336">${t('Click any card to start,', '点任意卡片就能开始，')}</text>
    <text class="cw-mark-s" x="14" y="354">${t('or scroll down', '或者向下浏览')}<tspan class="cw-down" dx="4">↓</tspan>${t(` for ${CASES.length} cases,`, `：${CASES.length} 个案子，`)}</text>
    <text class="cw-mark-s" x="14" y="371">${t('each ending in a final check.', '每个最后都有一关判断题。')}</text>
  </g>`;
}

function legend() {
  const x = 322, y = 334, w = 150, h = 16;
  const sample = [-0.8, -0.3, -0.9, -0.1, -0.5, 0.1, -0.4, 0.2, -0.2, 0.3, 0.0, 0.4, 0.6, 0.2, 0.7, 0.5, 0.9, 0.6];
  const bw = w / sample.length;
  let g = `<g class="cw-key"><rect class="cw-key-bg" x="${x - 10}" y="${y - 20}" width="336" height="70" rx="3"/>`;
  g += `<text class="cw-key-h" x="${x}" y="${y - 6}">${t('HOW TO READ A CARD', '怎么看卡片')}<tspan class="cw-key-sub"> · ${t('1 stripe = 1 year', '1 条 = 1 年')}</tspan></text>`;
  g += sample.map((a, i) => `<rect x="${(x + i * bw).toFixed(1)}" y="${y}" width="${(bw + 0.3).toFixed(1)}" height="${h}" fill="${stripeColor(a)}"/>`).join('');
  g += `<text class="cw-key-t" x="${x}" y="${y + h + 12}">1991</text><text class="cw-key-t" x="${x + w}" y="${y + h + 12}" text-anchor="end">2025</text>`;
  const lx = x + w + 16;
  g += `<rect x="${lx}" y="${y - 1}" width="11" height="11" fill="${stripeColor(-0.85)}"/><text class="cw-key-t" x="${lx + 16}" y="${y + 8}">${t('cooler than usual', '比平常冷')}</text>`;
  g += `<rect x="${lx}" y="${y + 14}" width="11" height="11" fill="${stripeColor(0.85)}"/><text class="cw-key-t" x="${lx + 16}" y="${y + 23}">${t('warmer than usual', '比平常暖')}</text>`;
  g += `<text class="cw-key-n" x="${x}" y="${y + 42}">${t('“Usual” = that city’s 1991–2020 average. Data: NASA MERRA-2.', '"平常" = 该城市 1991–2020 年的平均。数据：NASA MERRA-2。')}</text></g>`;
  return g;
}

// data: series.json; results: compare() output for T2M. Returns SVG markup.
export function caseWallSvg(data, results) {
  let s = `<defs><filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter></defs>`;
  const land = landPath(px, W / 2);
  if (land) s += `<path class="cw-land" d="${land}" filter="url(#ink)"/>`;
  const fx = FILE.x + FILE.w / 2, fy = FILE.y + 8;
  let strings = '', cards = '', dots = '';
  data.sites.forEach((site, i) => {
    const [sx, sy] = px(site.lon, site.lat);
    const [cx, cy] = SLOTS[site.id];
    const px0 = cx + CARD_W / 2, py0 = cy + 6;
    const sag = 26 + (i % 3) * 8;
    strings += `<path class="cw-string" style="--i:${i}" d="M${px0} ${py0} Q${((px0 + fx) / 2).toFixed(1)} ${(Math.max(py0, fy) + sag).toFixed(1)} ${fx} ${fy}"/>`;
    dots += `<circle class="cw-city" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3.2"/><path class="cw-lead" d="M${sx.toFixed(1)} ${sy.toFixed(1)} L${px0} ${cy + CARD_H}"/>`;
    const rows = yearly(data.series[site.id].T2M, { annual: 'mean' }).rows;
    const r = results[site.id];
    const slope = r?.test ? `${r.test.slope >= 0 ? '+' : '−'}${Math.abs(r.test.slope * 10).toFixed(2)} °C / ${t('decade', '十年')}` : '';
    const tilt = ((i % 2 ? 1 : -1) * (1 + (i % 3))).toFixed(1);
    cards += `<g class="cw-card" style="--i:${i}" data-site="${site.id}" data-hero="1" tabindex="0" role="button" aria-label="${shortSite(site.id)} ${slope}">
      <title>${t(`Open the ${shortSite(site.id)} case`, `打开${shortSite(site.id)}的案子`)}</title>
      <g transform="rotate(${tilt} ${cx + CARD_W / 2} ${cy + CARD_H / 2})">
        <rect class="cw-paper" x="${cx}" y="${cy}" width="${CARD_W}" height="${CARD_H}"/>
        ${stripes(rows, cx + 6, cy + 6, CARD_W - 12, STRIPE_H)}
        <text class="cw-name" x="${cx + 7}" y="${cy + STRIPE_H + 22}">${shortSite(site.id)}</text>
        <text class="cw-val" x="${cx + 7}" y="${cy + STRIPE_H + 35}">${slope}</text>
        <circle class="cw-pin" cx="${px0}" cy="${py0}" r="4.2"/>
        ${site.id === 'delhi' ? `<g class="cw-q"><circle cx="${cx + CARD_W - 6}" cy="${cy + STRIPE_H + 22}" r="13"/><text x="${cx + CARD_W - 6}" y="${cy + STRIPE_H + 28}" text-anchor="middle">?</text></g>` : ''}
      </g></g>`;
  });
  s += dots + strings + cards;
  s += `<g class="cw-file" data-goto="step1" tabindex="0" role="button" aria-label="${t('See all cases', '查看全部案子')}"><title>${t('See all cases', '查看全部案子')}</title><g transform="rotate(-1.5 ${fx} ${FILE.y + FILE.h / 2})">
    <path class="cw-folder" d="M${FILE.x} ${FILE.y + 10} h60 l8 -10 h${FILE.w - 68} v${FILE.h} h-${FILE.w} z"/>
    <text class="cw-file-t" x="${fx}" y="${FILE.y + 40}" text-anchor="middle">${t('CASE FILE 2026', '案卷 2026')}</text>
    <text class="cw-file-q" x="${fx}" y="${FILE.y + 64}" text-anchor="middle">${t('Is Earth changing?', '地球在变吗？')}</text>
    <text class="cw-file-open" x="${fx}" y="${FILE.y + 84}" text-anchor="middle">${t('▸ see all cases', '▸ 查看全部案子')}</text>
    <circle class="cw-pin" cx="${fx}" cy="${fy}" r="5"/></g></g>`;
  s += legend() + note();
  return s;
}

// Start the string-drawing animation (respects reduced motion).
export function animateCaseWall(svg) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  svg.querySelectorAll('.cw-string').forEach(p => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = reduce ? '0' : `${len}`;
  });
  // Animation frames are paused in background tabs, so a timer makes sure the cards
  // always appear even if the page was opened in the background.
  const on = () => svg.classList.add('cw-on');
  if (reduce || document.hidden) { on(); return; }
  requestAnimationFrame(on);
  setTimeout(on, 150);
}

// Play the case-wall animation again each time the visitor comes back to it: reset it
// quietly once it is fully off screen, start it again when it scrolls back into view.
let wallObserver = null;
export function watchCaseWall(svg) {
  if (wallObserver || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let away = false;
  wallObserver = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) { away = true; svg.classList.remove('cw-on'); return; }
    if (away) { away = false; requestAnimationFrame(() => svg.classList.add('cw-on')); setTimeout(() => svg.classList.add('cw-on'), 150); }
  }, { threshold: 0 });
  wallObserver.observe(svg);
}

export const HERO_SIZE = { W, H };
