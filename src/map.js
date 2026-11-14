// World map (equirectangular, 60°S–80°N) with one dot per study place.
// Land outlines: world-atlas land-110m (Natural Earth, via vendor/), drawn with topojson-client.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
const W = 960, TOP = 80, BOTTOM = -60, K = W / 360;
const px = (lon, lat) => [(lon + 180) * K, (TOP - lat) * K];

let landD = '';
let landRings = [];
// Land outline in any projection (used by the hero case wall).
// Rings that cross the 180° meridian are split there, so no line is drawn across the map.
// xSeam: break the ring where the projected x jumps by more than this (for maps whose seam
// is not the date line); otherwise break where the longitude jumps across the date line.
function ringPath(ring, project, xSeam = 0) {
  let d = '', prev = null, prevX = null, broken = false;
  ring.forEach(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    const jump = prev !== null && (xSeam ? Math.abs(x - prevX) > xSeam : Math.abs(lon - prev) > 180);
    if (jump) broken = true;
    prevX = x;
    d += `${i === 0 || jump ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    prev = lon;
  });
  return broken ? d : d + 'Z';
}
export function landPath(project, xSeam = 0) {
  return landRings.map(r => ringPath(r, project, xSeam)).join('');
}
export async function loadLand() {
  try {
    const topo = await (await fetch('vendor/land-110m.json')).json();
    const geo = window.topojson.feature(topo, topo.objects.land);
    const rings = [];
    (geo.features ?? [geo]).forEach(f => {
      const g = f.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      polys.forEach(p => p.forEach(r => rings.push(r)));
    });
    landRings = rings;
    landD = rings.map(r => ringPath(r, px)).join('');
  } catch { landD = ''; }
}

// sites: [{id, lon, lat, label, cls, on}]
// opts.mini: small locator map (bigger dots, no labels, no grid) for the answer's case ticket.
export function mapSvg(sites, opts = {}) {
  const mini = !!opts.mini;
  let s = '';
  if (!mini) for (let lon = -150; lon <= 150; lon += 30) { const [x] = px(lon, 0); s += `<line class="grat" x1="${x}" x2="${x}" y1="0" y2="${(TOP - BOTTOM) * K}"/>`; }
  if (!mini) for (let lat = -60; lat <= 80; lat += 20) { const [, y] = px(0, lat); s += `<line class="grat" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`; }
  if (landD) s += `<path class="land" d="${landD}"/>`;
  sites.forEach(p => {
    const [x, y] = px(p.lon, p.lat);
    const right = x < W - 150;
    const rd = mini ? 26 : 8, rr = mini ? 44 : 13;
    s += `<g class="pin ${p.cls}${p.on ? ' on' : ''}" data-site="${p.id}" tabindex="0" role="button" aria-label="${p.label}"><title>${p.label}</title>
      <circle class="ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr}"/><circle class="d" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rd}"/>
      ${mini ? '' : `<text x="${(right ? x + 14 : x - 14).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}">${p.label}</text>`}</g>`;
  });
  return s;
}
