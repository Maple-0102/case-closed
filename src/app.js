// Trend Detective page: question -> place -> variable -> guess -> replay -> answer -> clues.
// The tool answers whether, which way, how much and how sure. It never claims a cause.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
import { t, setLang, getLang, STATIC } from './i18n.js';
import { compare, yearly, startYearCheck, correctAcrossSites } from './data.js';
import { trendTest } from './stats.js';
import { VARIABLES, CHECKS, VAR } from './variables.js';
import { CASES, TOPICS, PLACE_TYPES, CLUES, DEFAULT_CLUES, GLOSSARY, siteName, shortSite } from './content.js';
import { chartSvg, replay, startYearSvg } from './chart.js';
import { loadLand, mapSvg } from './map.js';
import { caseWallSvg, animateCaseWall, watchCaseWall } from './hero.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sign = (v, dp) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(Math.max(0, dp));
const term = (key, text) => `<span class="term" tabindex="0" data-term="${key}">${text}</span>`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Calendar months as runs, e.g. [4..10, 12] -> "Apr–Oct, Dec" (never hides a skipped month).
const seasonLabel = m => {
  if (!m) return '';
  const runs = [];
  m.forEach(x => { const last = runs[runs.length - 1]; if (last && x === last[1] + 1) last[1] = x; else runs.push([x, x]); });
  return runs.map(([a, b]) => (a === b ? t(MON[a - 1], `${a} 月`) : t(`${MON[a - 1]}–${MON[b - 1]}`, `${a}–${b} 月`))).join(t(', ', '、'));
};

// Fewer usable years than this gets an explicit "less stable" note.
const FEW_YEARS = 20;
const state = { data: null, results: {}, site: null, variable: 'T2M', caseId: null, guess: null, topic: null, ptype: null, cancel: null, tour: null, tourDrag: [], win: null, checks: {} };
const result = (site = state.site, vid = state.variable) => state.results[vid]?.[site];
const verdictWord = (v, vd) => (vd === 'up' && v.goingUp ? v.goingUp() : vd === 'down' && v.goingDown ? v.goingDown() : t('Not sure yet', '还说不准'));

// ---------- data ----------
async function load() {
  const res = await fetch('data/processed/series.json');
  if (!res.ok) throw new Error(`series.json: HTTP ${res.status}`);
  state.data = await res.json();
  const ids = state.data.sites.map(s => s.id);
  VARIABLES.filter(v => !v.pending).forEach(v => { state.results[v.id] = compare(state.data.series, v.id, v, ids); });
  Object.values(CHECKS).forEach(c => { if (!state.results[c.id]) state.results[c.id] = compare(state.data.series, c.id, c, ids); });
  state.results.AOD_MODEL = compare(state.data.series, 'AOD_MODEL', { annual: 'mean' }, ids);
  state.globalRows = state.data.global ? yearly(state.data.global.T2M, { annual: 'mean' }).rows : null;
}

// ---------- static text ----------
function renderStatic() {
  document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
  // A missing key (e.g. an old cached i18n.js next to a new index.html) must not stop the page.
  document.querySelectorAll('[data-t]').forEach(el => { const s = STATIC[el.dataset.t]; if (s) el.textContent = t(...s); });
  document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  $('foot').innerHTML = t(
    'Data: NASA Giovanni (MERRA-2, MODIS, GPM IMERG; ~1° × 1° area averages), NASA AppEEARS (MODIS NDVI) and NASA POWER, downloaded 14 November 2026. Analyses and visualizations used in this project were produced with the Giovanni online data system, developed and maintained by the NASA GES DISC. Map: Natural Earth via world-atlas (ISC). Code: MIT licence. Built with help from Claude, an AI assistant (see README).',
    '数据：NASA Giovanni（MERRA-2、MODIS、GPM IMERG；约 1°×1° 区域平均）、NASA AppEEARS（MODIS 植被指数）与 NASA POWER，2026 年 11 月 14 日下载。本项目的分析与可视化使用了 NASA GES DISC 开发维护的 Giovanni 在线数据系统。地图：Natural Earth（world-atlas，ISC 许可）。代码：MIT 许可。开发中使用了 AI 助手 Claude（见 README）。');
}

// ---------- step 1: cases and guiding questions ----------
function renderCases() {
  $('cases').innerHTML = CASES.map(c => `<button type="button" class="case${state.caseId === c.id ? ' on' : ''}" data-case="${c.id}">
    <span class="case-tags"><span class="tag">${t('Case', '案例')}</span>${(tp => tp ? `<span class="topic-tag">${tp.icon} ${tp.name()}</span>` : '')(TOPICS.find(x => x.id === VAR(c.variable)?.topic))}</span><strong>${esc(c.title())}</strong><small>${esc(c.sub())}</small><span class="case-open">${t('Open the file →', '打开案卷 →')}</span></button>`).join('')
    + '<div class="guide" id="guide"></div>';
}
const unitTerm = v => (v.id === 'NDVI' ? term('ndvi', 'NDVI') : v.unit);
const viaName = via => (via.includes('Giovanni') ? 'NASA Giovanni' : via.includes('AppEEARS') ? 'NASA AppEEARS' : 'NASA POWER');
const srcLabel = v => (v.kind === 'satellite' ? term('satellite', t('Satellite', '卫星')) : term('model', t('Model', '模型'))) + ' ' + esc(v.product);
function renderGuide() {
  const chip = (attr, id, on, label) => `<button type="button" class="chip${on ? ' on' : ''}" ${attr}="${id}">${label}</button>`;
  const next = state.topic && !state.ptype ? t('Good. Now pick a kind of place in row 2.', '好。现在在第 2 行选一种地方。')
    : !state.topic && state.ptype ? t('Good. Now pick what to investigate in row 1.', '好。现在在第 1 行选要调查什么。')
    : t('Click one option in each row and we’ll suggest what to investigate.', '每一行点一个选项，我们就推荐可以调查的组合。');
  let recs = `<p class="guide-next">👆 ${next}</p>`;
  if (state.topic && state.ptype) {
    const sites = PLACE_TYPES.find(p => p.id === state.ptype).sites;
    const vars = VARIABLES.filter(v => v.topic === state.topic);
    // Only suggest combinations that can be opened (gaps are explained in the data catalogue).
    const pairs = sites.flatMap(s => vars.map(v => ({ s, v, ok: !v.pending && !!result(s, v.id)?.test })));
    const name = ({ s, v }) => t(`${v.name()} in ${shortSite(s)}`, `${shortSite(s)}的${v.name()}`);
    const okPairs = pairs.filter(x => x.ok);
    recs = okPairs.length ? `<p class="guide-next">👇 ${t('Suggestions: click one to investigate.', '推荐：点一个开始调查。')}</p><div class="recs">${okPairs.map(({ s, v }) => `<button type="button" class="rec" data-pick="${s}|${v.id}"><span class="icon" aria-hidden="true">${v.icon}</span>
        <span><strong>${esc(name({ s, v }))}</strong><small>${srcLabel(v)}</small></span></button>`).join('')}</div>`
      : `<p class="guide-next">${t('No data for this combination yet. Try another kind of place.', '这个组合暂时没有数据，换一种地方试试。')}</p>`;
  }
  $('guide').innerHTML = `<span class="tag">${t('Build your own', '自己组案子')}</span><p>🧩 ${t('Or build your own case: answer two questions', '或者自己组一个案子：回答两个问题')}</p>
    <div class="guide-row"><span><b class="row-n">1</b>${t('What do you want to investigate?', '你想调查什么？')}</span><div class="chips">${TOPICS.map(x => chip('data-topic', x.id, state.topic === x.id, `${x.icon} ${x.name()}`)).join('')}</div></div>
    <div class="guide-row"><span><b class="row-n">2</b>${t('What kind of place?', '你想看哪种地方？')}</span><div class="chips">${PLACE_TYPES.map(x => chip('data-ptype', x.id, state.ptype === x.id, x.name())).join('')}</div></div>${recs}`;
}

// ---------- step 2: map ----------
function renderMap() {
  $('s2now').innerHTML = state.site ? `${t('Selected:', '已选：')} <b>📍 ${esc(siteName(state.site))}</b>` : '';
  const v = VAR(state.variable);
  const sites = state.data.sites.map(s => ({ id: s.id, lon: s.lon, lat: s.lat, label: esc(shortSite(s.id)), cls: result(s.id)?.verdict ?? 'na', on: state.site === s.id }));
  $('map').innerHTML = mapSvg(sites);
  $('map').setAttribute('aria-label', t(`World map: places coloured by ${v.short()} trend`, `世界地图：按${v.short()}趋势上色`));
  $('legend').innerHTML = `<span><i class="dot up"></i>${t('Rising', '在上升')}</span><span><i class="dot down"></i>${t('Falling', '在下降')}</span><span><i class="dot unsure"></i>${t('Not sure yet', '还说不准')}</span><span><i class="dot na"></i>${t('No usable data', '无可用数据')}</span><span>· ${t(`Colour = ${v.short()} trend`, `颜色 = ${v.short()}趋势`)}</span>`;
  $('places').innerHTML = state.data.sites.map(s => `<button type="button" class="chip${state.site === s.id ? ' on' : ''}" data-site="${s.id}"><i class="dot ${result(s.id)?.verdict ?? 'na'}"></i>${esc(siteName(s.id))}</button>`).join('');
}

// ---------- step 3: variables ----------
function renderVars() {
  const v = VAR(state.variable);
  $('s3hint').textContent = state.site
    ? t(`👆 In ${shortSite(state.site)}: pick one, then press “See the answer”.`, `👆 选一个要测量${shortSite(state.site)}的东西，再点“查看答案”。`)
    : t('👆 Pick a place above first, then choose one here.', '👆 先在上面选一个地点，再在这里选一个。');
  $('varInfo').innerHTML = `<b>${v.icon} ${esc(v.name())}:</b> ${esc(v.def())} · ${srcLabel(v)}`;
  $('seeAnswer').hidden = !state.site;
  if (state.site) $('seeAnswer').textContent = t(`See the answer: ${v.name()} in ${shortSite(state.site)} ↓`, `查看答案：${shortSite(state.site)}的${v.name()} ↓`);
  $('vars').innerHTML = VARIABLES.map(v => `<button type="button" class="var${state.variable === v.id ? ' on' : ''}" data-var="${v.id}" ${v.pending ? 'disabled' : ''}>
    <span class="icon" aria-hidden="true">${v.icon}</span><strong>${esc(v.name())}</strong><p>${esc(v.def())}</p><span class="src">${srcLabel(v)}</span>
    ${v.pending ? `<span class="tag">${t('Coming soon', '即将加入')}</span>` : ''}</button>`).join('');
}

// ---------- step 4: guess, replay, answer ----------
function question(v) {
  const c = CASES.find(x => x.id === state.caseId && x.site === state.site && x.variable === state.variable);
  return { text: c ? c.title() : t(`Is the ${v.short()} in ${shortSite(state.site)} changing?`, `${shortSite(state.site)}的${v.short()}在变化吗？`), expect: c?.expect, mystery: !!c?.mystery, brief: c?.brief?.(), note: c?.note?.() };
}
function bigAnswer(vd, expect, v) {
  if (vd === 'unsure') return t('Not sure yet', '还说不准');
  const words = vd === 'up' ? v.goingUp() : v.goingDown();
  if (!expect) return t(words[0].toUpperCase() + words.slice(1), words);
  return expect === vd ? t(`Yes — ${words}`, `是的，${words}`) : t(`No — actually ${words}`, `没有，反而${words}`);
}
function everyday(r, v) {
  if (r.verdict === 'unsure') return '';
  const rows = r.rows.filter(x => x.complete);
  const early = rows.filter(x => x.year < rows[0].year + 10);
  if (early.length < 8) return '';
  const up = r.verdict === 'up', T = r.test;
  const now = T.intercept + T.slope * T.lastYear;
  const beaten = early.filter(x => (up ? x.value < now : x.value > now)).length;
  const span = `${early[0].year}–${early[early.length - 1].year}`;
  const hl = up ? t('higher', '高') : t('lower', '低');
  const typ = term('typical', t('typical year', '普通年份'));
  return beaten === early.length
    ? `<p class="everyday">${t(`In everyday terms: a ${typ}’s ${v.short()} today is ${hl} than any year in ${span}.`, `换句话说：如今一个${typ}的${v.short()}，比 ${span} 年里任何一年都${hl}。`)}</p>`
    : `<p class="everyday">${t(`In everyday terms: a ${typ}’s ${v.short()} today is ${hl} than ${beaten} of the ${early.length} years in ${span}.`, `换句话说：如今一个${typ}的${v.short()}，比 ${span} 年里 ${early.length} 年中的 ${beaten} 年都${hl}。`)}</p>`;
}
function parts(r, v) {
  const T = r.test, sig = r.verdict !== 'unsure', up = T.slope > 0;
  const dec = x => sign(x * 10, v.dp);
  const crosses = T.ciLow !== null && T.ciLow < 0 && T.ciHigh > 0;
  const cell = (n, q, a, d) => `<div class="part"><div class="part-q"><span class="part-n">${n}</span>${q}</div><div class="part-a">${a}</div><div class="part-d">${d}</div></div>`;
  return `<div class="parts">
    ${cell(1, t('Did it change?', '变了吗？'), sig ? t('Yes', '是') : term('unsure', t('Not sure yet', '还说不准')),
      sig ? t(`A ${term('significant', 'significant')} ${term('trend', 'trend')}: unlikely to be just random ups and downs.`, `这是${term('significant', '显著')}的${term('trend', '趋势')}：不太可能只是随机起伏。`) : t('The years jump around too much to call it a significant trend.', '年份之间起伏太大，还不能算显著的趋势。'))}
    ${cell(2, t('Which way?', '往哪个方向？'), sig ? (up ? t('Up ↗', '上升 ↗') : t('Down ↘', '下降 ↘')) : (up ? t('Looks up', '看起来上升') : t('Looks down', '看起来下降')),
      sig ? t(`Overall ${up ? 'upward' : 'downward'} from ${T.firstYear} to ${T.lastYear}.`, `${T.firstYear}–${T.lastYear} 年整体${up ? '往上' : '往下'}走。`) : (crosses ? t('Even the direction is not certain yet.', '连方向都还不能确定。') : t('The direction is fairly clear, but the evidence is weak.', '方向大致清楚，但证据还不够强。')))}
    ${cell(3, t('By how much?', '变了多少？'), `${sign(T.slope * (T.lastYear - T.firstYear), v.dp - 1)} ${v.unit}`,
      t(`Total change ${T.firstYear}–${T.lastYear}: about ${dec(T.slope)} ${v.unit} ${term('decade', 'per decade')}.`, `${T.firstYear}–${T.lastYear} 年的总变化，相当于${term('decade', '每十年')} ${dec(T.slope)} ${v.unit}。`))}
    ${cell(4, t('How sure are we?', '有多确定？'), T.ciLow === null ? '—' : `${dec(T.ciLow)} … ${dec(T.ciHigh)}`,
      t(`The change per decade is very likely in this ${term('range', 'range')} (${v.unit}). ${crosses ? 'It crosses zero.' : 'It does not cross zero.'}`, `每十年的变化很可能在这个${term('range', '范围')}里（${v.unit}）。${crosses ? '范围跨过 0。' : '范围不跨过 0。'}`))}
  </div>`;
}
function statsTable(r, v) {
  const T = r.test, dec = x => sign(x * 10, v.dp + 1);
  const n = Object.values(state.results[v.id]).filter(x => x.test).length;
  const meta = state.data.variables[v.id];
  const rows = [
    [t('Test', '检验'), 'Mann-Kendall, two-sided, α = 0.05'],
    [t('Sen slope', 'Sen 斜率'), `${dec(T.slope)} ${v.unit}/${t('decade', '十年')}; 95% CI ${T.ciLow === null ? '—' : `${dec(T.ciLow)} … ${dec(T.ciHigh)}`}`],
    [t('Autocorrelation', '自相关'), `r1 = ${T.r1.toFixed(2)}, ${t('used', '采用')} ρ = ${T.rho.toFixed(2)} (Yue & Wang AR(1)); ${t('variance ×', '方差 ×')} ${T.inflation.toFixed(2)}`],
    [t('p-value', 'p 值'), `${T.p.toPrecision(2)} (${t('uncorrected', '未修正')} ${T.pUncorrected.toPrecision(2)})`],
    [t('Several places', '多地点校正'), `Benjamini-Hochberg ${term('qvalue', 'q')} = ${r.q.toPrecision(2)} (${n} ${t('places tested together', '个地点一起检验')})`],
    [t('Years used', '使用年份'), `${T.n} (${T.firstYear}–${T.lastYear})${r.season ? t(`, ${seasonLabel(r.season)} only`, `，只用 ${seasonLabel(r.season)}`) : ''}`],
    [t('Data', '数据'), `${esc(meta.product)} · <a href="https://doi.org/${meta.doi}" target="_blank" rel="noopener">doi:${meta.doi}</a>`],
  ];
  return `<details class="stats"><summary>${t('For the curious: the statistics', '给懂行的人看：统计细节')}</summary>
    <table class="kv">${rows.map(([k, x]) => `<tr><th>${k}</th><td>${x}</td></tr>`).join('')}</table>
    <p class="cap">${t('The map colours and answers use the stricter q-value because several places are tested at once. Details: docs/method.md.', '因为同时检验了多个地点，地图颜色和结论都用更严格的 q 值。详见 docs/method.md。')}</p></details>`;
}
// Two series are compared over the years both have complete data, so a shorter station
// record is never set against a longer model record. Full records stay as a supplement.
function sameYears(a, b) {
  if (!a?.rows || !b?.rows) return null;
  const ya = new Set(a.rows.filter(r => r.complete).map(r => r.year));
  const yb = new Set(b.rows.filter(r => r.complete).map(r => r.year));
  const A = trendTest(a.rows.filter(r => r.complete && yb.has(r.year)));
  const B = trendTest(b.rows.filter(r => r.complete && ya.has(r.year)));
  return A && B ? { a: A, b: B, n: A.n, first: A.firstYear, last: A.lastYear } : null;
}
const stationPair = r => sameYears(r, state.results.T2M_STATION?.[state.site]);
// The New Delhi case: the model and the city's thermometer disagree, and the page says so.
function renderMystery(box, q, r, v) {
  const s = state.results.T2M_STATION?.[state.site];
  const src = state.data.series[state.site].T2M_STATION.source;
  const pair = stationPair(r);
  const T = pair.a, ST = pair.b;
  const per = x => `${sign(x.slope * 10, 2)} °C ${t('per decade', '每十年')}`;
  const sig = x => (x.p < 0.05 ? t(`supported over these ${pair.n} years`, `这 ${pair.n} 年里得到支持`) : t(`not proven over these ${pair.n} years`, `这 ${pair.n} 年里证据不足`));
  // Without enough evidence we only say what it "looks like", as everywhere else on the page.
  const says = x => (x.p < 0.05 ? (x.slope > 0 ? t('Warming', '在变暖') : t('Cooling', '在降温')) : (x.slope > 0 ? t('Looks like warming', '看起来在升温') : t('Looks like cooling', '看起来在降温')));
  const neither = T.p >= 0.05 && ST.p >= 0.05;
  const guessed = { up: 'up', down: 'down', flat: 'flat' }[state.guess];
  const mine = { up: v.up(), down: v.down(), flat: t('No clear change', '看不出变化') }[state.guess];
  const dirOf = x => (x.slope > 0 ? 'up' : 'down');
  const badge = state.guess === 'skip' ? '' : `<p class="badge ${guessed === dirOf(T) || guessed === dirOf(ST) ? 'ok' : 'miss'}">🔎 ${t(`You guessed “${mine}”. The model ${guessed === dirOf(T) ? 'agrees' : 'disagrees'}; the thermometer ${guessed === dirOf(ST) ? 'agrees' : 'disagrees'}.`, `你猜的是"${mine}"。模型${guessed === dirOf(T) ? '同意' : '不同意'}；温度计${guessed === dirOf(ST) ? '同意' : '不同意'}。`)}</p>`;
  box.innerHTML = `<div class="card answer">${ticket()}<p class="q">${esc(q.text)}</p>${briefNote(q)}
    <p class="cap">${t('Each dot = one year’s average air temperature from the NASA model (°C); thick line = the trend over all years; light fan = trend lines as steep or as flat as the 95% range allows (it is not a range for each year’s value).', '每个点 = NASA 模型给出的一年平均气温（°C）；粗线 = 全部年份的趋势；浅色扇形 = 斜率在 95% 范围内、最陡到最平的所有可能趋势线（不是每年数值的范围）。')}</p>
    <div id="mainChart">${chartSvg(r.rows, r.test, { cls: r.verdict, unit: v.unit, dp: v.dp, label: esc(t('Yearly model temperature with trend line', '模型每年气温和趋势线')) })}</div>
    <div class="after" id="after" hidden>${tamperPanel()}<div id="stampSlot">${stamp('conflict')}</div>${badge}
      <p class="big unsure">${neither ? t('Two sources, two directions, and neither is proven', '两套数据，方向相反，而且都没被证实') : t('Two sources, two answers', '两套数据，两个答案')}</p>
      <div class="duel">
        <div class="part"><div class="part-q">🛰️ ${t(`NASA model (MERRA-2), 110 km ${term('region', 'region')}`, `NASA 模型（MERRA-2），110 公里${term('region', '区域')}`)}</div><div class="part-a ${dirOf(T)}">${says(T)} ${dirOf(T) === 'up' ? '↗' : '↘'}</div><div class="part-d">${per(T)} · ${sig(T)}</div><div class="part-d">${t(`Over its full ${r.test.n} years: ${per(r.test)}, ${r.q < 0.05 ? `only just significant (q = ${r.q.toFixed(3)})` : 'not significant'}.`, `用完整 ${r.test.n} 年算：${per(r.test)}，${r.q < 0.05 ? `只是勉强显著（q = ${r.q.toFixed(3)}）` : '不显著'}。`)}</div></div>
        <div class="part"><div class="part-q">🌡️ ${t(`Thermometer: ${esc(src.stationName)} weather station (NOAA)`, `温度计：${esc(src.stationName)} 气象站（NOAA）`)}</div><div class="part-a ${dirOf(ST)}">${says(ST)} ${dirOf(ST) === 'up' ? '↗' : '↘'}</div><div class="part-d">${per(ST)} · ${sig(ST)}</div></div>
      </div>
      <p class="cap">${t(`Both compared over the same ${pair.n} years where both have complete data (${pair.first}–${pair.last}). The thermometer’s full record is these same ${s.test.n} years.`, `两者都按双方都有完整数据的 ${pair.n} 个相同年份比较（${pair.first}–${pair.last}）。温度计的完整记录就是这 ${s.test.n} 年。`)}</p>
      ${detectiveNote(q)}
      <div class="callout"><h3>${t('Case open: why would they disagree?', '案子还没破：为什么两者会不一样？')}</h3>${neither ? `<p>${t('Over the same years, neither source has enough evidence on its own, and they point in opposite directions. From these data we cannot even say which way New Delhi is heading. That is why the case stays open; the leads below are where a detective would look next.', '在相同年份里，两套数据单独看都证据不足，而且方向相反。凭这些数据，我们连新德里往哪个方向变都说不准，所以这个案子还没结；下面的线索是侦探接下来要查的方向。')}</p>` : ''}<p>${t('In 7 of our 8 cities the model and the thermometer agree closely, so this is unusual. The station measures one spot in a fast-growing city; the model averages a 110 km region that also takes in large areas of irrigated farmland, and it can miss local effects. Neither number is “the truth” on its own.', '在我们的 8 个城市里，有 7 个模型和温度计非常接近，所以这里很不寻常。气象站测的是一座快速扩张的城市里的一个点；模型是 110 公里区域的平均，里面还包括大片灌溉农田，也可能漏掉本地因素。单看哪一个数字都不是"真相"。')}</p></div>
      ${startYearBlock(r, v)}
      <button type="button" class="link-btn" id="replayBtn">${t(`▶ Replay the ${T.n} years`, `▶ 重新回放 ${T.n} 年`)}</button>
      <details class="stats"><summary>${t('The model’s answer in detail', '模型答案的细节')}</summary>${parts(r, v)}${statsTable(r, v).replace(/^<details class="stats"><summary>[^<]*<\/summary>/, '').replace(/<\/details>$/, '')}</details>
    </div></div>`;
  updateStartYear();
  runReplay();
}

// Compare a city's temperature trend with the whole planet over the same years (NASA GISTEMP).
function globalLine(test) {
  if (!state.globalRows) return '';
  const g = trendTest(state.globalRows.filter(x => x.complete && x.year >= test.firstYear && x.year <= test.lastYear));
  if (!g) return '';
  const ratio = test.slope / g.slope;
  const here = `${sign(test.slope * 10, 2)} °C`, world = `${sign(g.slope * 10, 2)} °C`;
  const pace = ratio < 0 ? t('in the opposite direction to', '方向与全球相反，全球是')
    : ratio >= 1.25 ? t(`about ${ratio.toFixed(1)} times as fast as`, `大约是全球的 ${ratio.toFixed(1)} 倍，全球是`)
    : ratio <= 0.8 ? t('slower than', '比全球慢，全球是')
    : t('at about the same pace as', '和全球差不多，全球是');
  return `<p class="everyday">🌍 ${t(`Compared with the whole planet: ${here} per decade here, ${pace} the global average (${world} per decade, NASA GISTEMP, land and ocean). Land warms faster than the ocean, so many cities change faster than the global average.`, `和整个地球比：这里每十年 ${here}，${pace}每十年 ${world}（NASA GISTEMP，陆地加海洋）。陆地比海洋升温快，所以很多城市比全球平均变得快。`)}</p>`;
}

// Rubber stamp shown at the reveal: what the evidence supports, not whether the guess was right.
function stamp(kind, sub = '') {
  const label = {
    confirmed: t('Trend supported', '趋势有证据支持'),
    unproven: t('Not proven', '证据不足'),
    conflict: t('Conflicting evidence', '证据矛盾'),
  }[kind];
  return `<div class="stamp stamp-${kind}${sub ? ' stamp-window' : ''}" aria-hidden="true">${label}${sub ? `<span class="stamp-sub">${t('only', '只看')} ${sub}</span>` : ''}</div>`;
}

// If the city's weather station trends the other way, say so right under the big answer.
function stationWarning(r, v) {
  if (v.id !== 'T2M') return '';
  const pair = stationPair(r);
  if (!pair || Math.sign(pair.b.slope) === Math.sign(pair.a.slope)) return '';
  const name = state.data.series[state.site].T2M_STATION.source.stationName, st = pair.b;
  return `<p class="note">⚠️ ${t(`But over the same ${pair.n} years the city’s ${esc(name)} weather station ${st.p < 0.05 ? 'shows' : 'looks like it shows'} ${st.slope > 0 ? 'warming' : 'cooling'} (${sign(st.slope * 10, 2)} °C per decade). The model and the thermometer disagree — see Clue 3 before believing either.`, `但在相同的 ${pair.n} 年里，城里的 ${esc(name)} 气象站${st.p < 0.05 ? '显示的是' : '看起来是'}${st.slope > 0 ? '升温' : '降温'}（每十年 ${sign(st.slope * 10, 2)} °C）。模型和温度计意见相反，先看线索 3，再决定信哪一个。`)}</p>`;
}
// ---------- "Don't get fooled": does the answer depend on the start year? ----------
// The slider moves the main chart and re-stamps it. Every window is judged by the same rule
// as the official answer (one Benjamini-Hochberg correction across the places for that start
// year), so dragging back to the first year always gives back the official stamp.
function checksFor(vid) {
  if (state.checks[vid]) return state.checks[vid];
  const checks = {}, q = {};
  Object.entries(state.results[vid] ?? {}).forEach(([s, r]) => { if (r.test) { checks[s] = startYearCheck(r.rows); q[s] = r.q; } });
  return (state.checks[vid] = correctAcrossSites(checks, q));
}
const checkFor = (site = state.site, vid = state.variable) => checksFor(vid)[site];
const windowOf = c => (c && !c.skipped ? c.windows.find(w => w.start === state.win) ?? c.full : null);

function startYearText(c, r, v) {
  const d = x => sign(x * 10, v.dp);
  const range = t(`${d(c.slopeMin)} to ${d(c.slopeMax)} ${v.unit} per decade`, `每十年 ${d(c.slopeMin)} 到 ${d(c.slopeMax)} ${v.unit}`);
  const K = c.count, a = c.windows[0].start, b = c.windows[c.windows.length - 1].start;
  const mainSig = r.verdict === 'up' || r.verdict === 'down';
  const rise = c.direction === 'up';
  if (!mainSig && c.nSig > 0) {
    const flips = c.kind === 'direction-changes';
    return t(`Gotcha — this is how people get fooled. Pick just the right start year and it looks proven: ${c.nSig} of the ${K} start years would earn a “Trend supported” stamp. But take all the years and the case falls apart.${flips ? ' Move the start a little and the story even reverses.' : ''} Choosing only the years that fit your story is exactly the trick a detective has to catch. Verdict stays: not proven. (Trend from ${range}.)`,
      `抓到了，这就是被骗的套路。只要挑对起点，看起来就像证实了：${K} 个起点里有 ${c.nSig} 个能拿到"趋势有证据支持"的章。可把所有年份放在一起，这个案子就站不住了。${flips ? '起点稍微挪一挪，故事甚至会反过来。' : ''}只挑符合自己说法的年份，正是侦探要拆穿的把戏。结论不变：证据不足。（趋势在${range}之间。）`);
  }
  return {
    'robust': t(`Rock solid. We moved the start year from ${a} all the way to ${b} and questioned the data ${K} times. The story never cracked: it ${rise ? 'rises' : 'falls'} every single time (${range}). Start wherever you like, this evidence holds.`,
      `铁证如山。我们把起点从 ${a} 一路挪到 ${b}，把数据审了 ${K} 遍，口供一次都没变：每一次都在${rise ? '上升' : '下降'}（${range}）。从哪年起算都行，这条证据站得住。`),
    'same-direction-partial': t(`The story holds, but the short versions are shaky. From every start year it still points ${rise ? 'up' : 'down'} (${range}). But start too late and there are too few years left to prove it: ${K - c.nSig} of the ${K} start years can’t close the case alone. That doesn’t overturn the verdict for all the years, but anyone quoting this trend should say which years they mean.`,
      `故事没变，但短版本站不太稳。从每个起点算，方向都是${rise ? '往上' : '往下'}（${range}）。可要是起点太晚，剩下的年份就太少，证明不了：${K} 个起点里有 ${K - c.nSig} 个单独结不了案。这推翻不了全部年份的结论，但谁要引用这个趋势，都应该说清楚是哪几年。`),
    'direction-changes': t(`Watch out — this story flips. Start in one year and it’s going up; start in another and it’s going down (${range}). Anyone who quotes this trend without saying which years is only telling you half the story.`,
      `小心，这个故事会反转。从某些年份算是上升，换个起点就成了下降（${range}）。谁引用这个趋势却不说是哪几年，就只讲了半个故事。`),
    'none-significant': t(`No start year cracks this case. We tried all ${K} and none has enough evidence (${range}). But “can’t prove it” is not “nothing changed”: the years just swing too much to tell.`,
      `换哪个起点都破不了这个案。${K} 个都试过了，没有一个证据足够（${range}）。但"证明不了"不等于"没变"：只是年份之间起伏太大，看不清。`),
  }[c.kind];
}
function farthestText(c, v) {
  const w = c.farthest, T = w.test, d = x => sign(x * 10, v.dp);
  if (w.start === c.full.start) return '';
  return t(`Most misleading start year: ${w.start}. From ${w.start} to ${w.end} (${w.n} years) the trend is ${d(T.slope)} ${v.unit} per decade (95% range ${T.ciLow === null ? '—' : `${d(T.ciLow)} to ${d(T.ciHigh)}`}), the furthest from the trend over all the years.`,
    `最误导人的起点：${w.start} 年。从 ${w.start} 到 ${w.end} 年（${w.n} 年），趋势是每十年 ${d(T.slope)} ${v.unit}（95% 范围 ${T.ciLow === null ? '—' : `${d(T.ciLow)} 到 ${d(T.ciHigh)}`}），和全部年份的趋势差得最远。`);
}
const stampKind = (w, r) => (w.start === checkFor().full.start ? (r.verdict === 'unsure' ? 'unproven' : 'confirmed') : w.significant ? 'confirmed' : 'unproven');

// The slider panel, right under the main chart.
function tamperPanel() {
  const c = checkFor();
  if (!c || c.skipped) return '';
  const a = c.windows[0].start, b = c.windows[c.windows.length - 1].start;
  return `<div class="tamper" id="tamper">
    <p class="tamper-title">🕵️ ${t('Try to fake the evidence: keep only the years you want', '试着伪造证据：只留下你想要的年份')}</p>
    <p class="hint">${t('Drag the start year. The data never changes, only which years you look at. Watch the stamp.', '拖动起始年份。数据一点没改，变的只是你看哪几年。注意看印章。')}</p>
    <div class="slider-row"><label for="startSlider">${term('startYear', t('Start year', '起始年份'))}</label>
      <input type="range" id="startSlider" min="${a}" max="${b}" step="1" value="${state.win ?? a}"><output id="startOut" for="startSlider"></output></div>
    <div class="explore" id="exploreCard" aria-live="polite"></div>
  </div>`;
}
// The summary section further down: every start year at a glance, and the verdict.
function startYearBlock(r, v) {
  const c = checkFor();
  const head = `<h3>🕵️ ${t('Don’t get fooled: would a different start year change the story?', '别被骗：换一个起始年份，结论会变吗？')}</h3>`;
  if (!c || c.skipped) {
    return `<section class="robust">${head}<p class="note">${t(`This record has only ${c?.n ?? 0} complete years. The start-year check needs at least 20, so it is not run here (a design rule of this tool, not a statistical guarantee).`, `这条记录只有 ${c?.n ?? 0} 个完整年份。起始年份检查至少需要 20 年，所以这里不做（这是本工具的设计门槛，不是统计学保证）。`)}</p></section>`;
  }
  return `<section class="robust" id="robust">${head}
    <p><button type="button" class="btn tab-btn" data-goto="tamper">↑ ${t('Try it yourself: drag the start-year slider', '自己试试：拖动起始年份滑块')}</button></p>
    <p class="cap">${t(`Each dot = the trend from that start year to ${c.end}, per decade. ● filled = that start year alone would get a “Trend supported” stamp · ○ hollow = not proven · line = its 95% range. Click a dot to try that start year.`, `每个点 = 从该年到 ${c.end} 年的趋势（每十年）。● 实心 = 只看这段年份也能拿到"趋势有证据支持"的章 · ○ 空心 = 证据不足 · 竖线 = 95% 范围。点圆点就能试这个起点。`)}</p>
    <div id="winDots"></div>
    <p class="robust-verdict">${startYearText(c, r, v)}</p>
    ${farthestText(c, v) ? `<p class="cap">${farthestText(c, v)}</p>` : ''}
    <details class="stats"><summary>${t('How this check works', '这个检查怎么做的')}</summary><p class="cap">${t(`The end year stays at ${c.end}; the start moves one year at a time, keeping at least 15 calendar years and 15 complete years in every window. Start years with missing data are skipped, not replaced. Every window is judged by the same rule as the official answer: Mann-Kendall with the autocorrelation correction, then one Benjamini-Hochberg correction across all places for that start year. So the first dot is always the official answer. The windows overlap heavily and are not corrected against each other, and each interval is a 95% range for that window only. Records under 20 complete years are not checked; that is a design rule, not a statistical guarantee. Only the start year moves; the end year and the data source stay fixed.`, `终点固定在 ${c.end} 年，起点每次挪一年，每个窗口至少 15 个日历年、15 个完整年份。缺数据的起始年份直接跳过，不用别的年份顶替。每个窗口都用和正式结论相同的规则判断：Mann-Kendall 检验加自相关修正，再对同一起点的所有地点做一次 Benjamini-Hochberg 校正。所以第一个点永远就是正式结论。各窗口大量重叠，彼此之间没有再做校正，每条区间只是该窗口自己的 95% 范围。不足 20 个完整年份的记录不做此检查；这是设计门槛，不是统计学保证。只有起点在动，终点和数据来源都不变。`)}</p></details>
  </section>`;
}
// fromUser: re-draw the main chart and re-stamp (not on first render, while the replay runs).
function updateStartYear(fromUser = false) {
  const c = checkFor();
  if (!c || c.skipped || !$('tamper')) return;
  const r = result(), v = VAR(state.variable), q = question(v);
  const nearest = y => c.windows.reduce((a, w) => (Math.abs(w.start - y) < Math.abs(a.start - y) ? w : a), c.full);
  const w = nearest(state.win ?? c.full.start);
  state.win = w.start === c.full.start ? null : w.start;
  $('startSlider').value = w.start;
  $('startOut').textContent = `${w.start}–${w.end}`;
  const last = c.windows[c.windows.length - 1].start;
  if (fromUser) {
    $('mainChart').innerHTML = chartSvg(r.rows, r.test, { cls: r.verdict, unit: v.unit, dp: v.dp, still: true, win: state.win ? { start: w.start, test: w.test } : null, label: esc(t(`Yearly values; highlighted ${w.start}–${w.end}`, `每年数值；高亮 ${w.start}–${w.end}`)) });
    if (!q.mystery) $('stampSlot').innerHTML = stamp(stampKind(w, r), state.win ? `${w.start}–${w.end}` : '');
  }
  if ($('winDots')) $('winDots').innerHTML = startYearSvg(c, { dp: v.dp, unit: v.unit, current: w.start, label: esc(t('Trend per decade for each start year', '每个起始年份的每十年趋势')) });
  const T = w.test, d = x => sign(x * 10, v.dp);
  const k = w.significant ? (T.slope > 0 ? 'up' : 'down') : 'unsure';
  const word = w.significant ? (T.slope > 0 ? t('Rising, and it holds up', '在上升，而且站得住') : t('Falling, and it holds up', '在下降，而且站得住')) : (T.slope > 0 ? t('Looks like rising, but not proven', '看起来在上升，但证据不足') : t('Looks like falling, but not proven', '看起来在下降，但证据不足'));
  $('exploreCard').innerHTML = `<p class="explore-head">${state.win ? t(`Only ${w.start}–${w.end} · ${w.n} years`, `只看 ${w.start}–${w.end} · ${w.n} 年`) : t(`All years · ${w.start}–${w.end} · ${w.n} years`, `全部年份 · ${w.start}–${w.end} · ${w.n} 年`)}</p>
    <p class="explore-res ${k}">${word}${t(':', '：')} ${d(T.slope)} ${v.unit} ${t('per decade', '每十年')}</p>
    ${w.start === last ? `<p class="cap">⛔ ${t(`This is as late as the start can go: every window keeps at least 15 years (here ${w.start}–${w.end}). Shorter records are too easily swayed by a few odd years.`, `起点最晚只能到这里：每个窗口至少保留 15 年（这里是 ${w.start}–${w.end}）。再短的话，几个反常年份就能把趋势带偏。`)}</p>` : ''}
    ${state.win ? `<p class="cap">${q.mystery ? t('The stamp stays “Conflicting evidence”: the thermometer still disagrees. The answer below covers all the years.', '印章仍是"证据矛盾"：温度计还是不同意。下面的答案针对全部年份。') : t('The stamp now judges only these years. The answer below still covers all the years.', '印章现在只评判这几年。下面的答案仍然针对全部年份。')}</p><button type="button" class="link-btn" id="resetWindow">↺ ${t('Back to all the years', '回到全部年份')}</button>` : ''}`;
}
// "Your case" ticket at the top of the answer: shows the place and the measure, each with a
// button back to the step where it can be changed (visitors who start from a case card
// skip steps 2 and 3, so this is where they learn both can be changed).
function ticket() {
  const v = VAR(state.variable);
  return `<div class="ticket"><span class="ticket-h">🕵️ ${t('Your case:', '你的案子：')}</span>
    <button type="button" class="ticket-btn" data-goto="step2">📍 ${esc(siteName(state.site))} <u>${t('change place ↑', '换地点 ↑')}</u></button>
    <button type="button" class="ticket-btn" data-goto="step3">${v.icon} ${esc(v.name())} <u>${t('change what to measure ↑', '换测量对象 ↑')}</u></button></div>`;
}
const briefNote = q => (q.brief ? `<p class="brief">📝 <b>${t('Case brief:', '案情简介：')}</b> ${esc(q.brief)}</p>` : '');
function detectiveNote(q) {
  return q.note ? `<div class="det-note"><h3>🕵️ ${t('Detective’s note', '侦探笔记')}</h3><p>${esc(q.note)}</p></div>` : '';
}
function renderAnswer() {
  state.cancel?.();
  const box = $('answer');
  if (!state.site) { box.innerHTML = `<div class="card answer"><p class="q">${t('Pick a case, answer the two questions, or click a place on the map.', '先选一个案例、回答两个问题，或者在地图上点一个地点。')}</p></div>`; return; }
  const v = VAR(state.variable), r = result();
  if (!r?.test) {
    box.innerHTML = `<div class="card answer">${ticket()}<p class="q">${t(`Not enough ${v.short()} data for ${siteName(state.site)}`, `${siteName(state.site)}的${v.short()}数据不够`)}${state.site === 'nuuk' && v.id === 'SOIL' ? t(': the area is mostly ice and snow.', '：这里大多是冰雪。') : v.id === 'NDVI' ? t(': clouds cover this area in most months, so the satellite rarely gets a clean look at the ground. We leave cloudy months out instead of guessing.', '：这里大多数月份都被云遮住，卫星很少能看清地面。我们把多云的月份排除掉，而不是去猜。') : t(' to test a trend.', '，无法做趋势检验。')} ${t('Try another place or variable.', '换一个地点或变量试试。')}</p></div>`;
    return;
  }
  const q = question(v), T = r.test;
  const span = T.lastYear - T.firstYear + 1;
  const fewNote = T.n < FEW_YEARS ? ` ${t(`Only ${T.n} of the ${span} years from ${T.firstYear} to ${T.lastYear} have complete data, so this result is less stable than one built on a long, unbroken record.`, `${T.firstYear}–${T.lastYear} 年的 ${span} 年里只有 ${T.n} 年数据完整，所以这个结果不如长期连续记录那样稳定。`)}` : '';
  const seasonNote = r.season
    ? `<p class="note">🛰️ ${v.id === 'NDVI'
      ? t(`In some months here snow or thick cloud hides the plants, so we compare only the ${seasonLabel(r.season)} average each year, when the ground can be seen. Missing months are never filled in.`, `这里有些月份被积雪或厚云遮住，看不到植物，所以只比较每年 ${seasonLabel(r.season)}（看得清地面的月份）的平均。缺的月份不补值。`)
      : t(`In some months here (dark winters or cloudy rainy seasons) the satellite cannot see the ground, so we compare only the ${seasonLabel(r.season)} average each year. Missing months are never filled in.`, `这里有些月份（冬季太暗或雨季云多）卫星看不到地面，所以只比较每年 ${seasonLabel(r.season)} 的平均。缺的月份不补值。`)}${fewNote}</p>`
    : fewNote ? `<p class="note">⚠️${fewNote}</p>` : '';
  if (!state.guess) {
    const opts = [['up', '↗', v.up()], ['down', '↘', v.down()], ['flat', '〰', t('No clear change', '看不出变化')]];
    box.innerHTML = `<div class="card answer guess">${ticket()}<p class="q">${esc(q.text)}</p>${briefNote(q)}<p class="guess-lead">${t('Make a guess first!', '先猜一猜！')}</p>
      <p class="hint">${t(`From ${T.firstYear} to ${T.lastYear}, the ${r.season ? seasonLabel(r.season) + ' ' : ''}${v.short()} in ${shortSite(state.site)}…`, `从 ${T.firstYear} 年到 ${T.lastYear} 年，${shortSite(state.site)}${r.season ? `每年 ${seasonLabel(r.season)} ` : ''}的${v.short()}……`)}</p>
      <div class="guess-opts">${opts.map(([id, icon, label]) => `<button type="button" class="guess-btn" data-guess="${id}"><span aria-hidden="true">${icon}</span>${esc(label)}</button>`).join('')}</div>
      <button type="button" class="link-btn" data-guess="skip">${t('Skip — just show me', '跳过，直接看答案')}</button></div>`;
    return;
  }
  if (q.mystery) { renderMystery(box, q, r, v); return; }
  const truth = { up: 'up', down: 'down', unsure: 'flat' }[r.verdict];
  const mine = { up: v.up(), down: v.down(), flat: t('No clear change', '看不出变化') }[state.guess];
  const badge = state.guess === 'skip' ? '' : state.guess === truth
    ? `<p class="badge ok">🎯 ${t(`You got it! You guessed “${mine}”.`, `猜对了！你猜的是"${mine}"。`)}</p>`
    : `<p class="badge miss">😮 ${t(`Surprise! You guessed “${mine}”.`, `出乎意料！你猜的是"${mine}"。`)}</p>`;
  const via = t(`${viaName(state.data.series[state.site][v.id].source.via)}, ${term('region', 'region')} average`, `${viaName(state.data.series[state.site][v.id].source.via)}，${term('region', '区域')}平均`);
  box.innerHTML = `<div class="card answer">${ticket()}<p class="q">${esc(q.text)}</p>${briefNote(q)}${seasonNote}
    <p class="cap">${t(`Each dot = one year’s ${r.season ? seasonLabel(r.season) + ' average' : 'value'} (${unitTerm(v)}); thick line = the trend over all years; light fan = trend lines as steep or as flat as the 95% range allows (it is not a range for each year’s value).`, `每个点 = 一年的${r.season ? ` ${seasonLabel(r.season)} 平均` : '数值'}（${unitTerm(v)}）；粗线 = 全部年份的趋势；浅色扇形 = 斜率在 95% 范围内、最陡到最平的所有可能趋势线（不是每年数值的范围）。`)}</p>
    <div id="mainChart">${chartSvg(r.rows, T, { cls: r.verdict, unit: v.unit, dp: v.dp, label: esc(t('Yearly values with trend line', '每年数值和趋势线')) })}</div>
    <div class="after" id="after" hidden>${tamperPanel()}<div id="stampSlot">${stamp(r.verdict === 'unsure' ? 'unproven' : 'confirmed')}</div>${badge}
      <p class="big ${r.verdict}">${bigAnswer(r.verdict, q.expect, v)}</p>${stationWarning(r, v)}${everyday(r, v)}${v.id === 'T2M' && r.verdict !== 'unsure' ? globalLine(T) : ''}${parts(r, v)}${detectiveNote(q)}
      <p class="cap">${t('Data:', '数据：')} ${srcLabel(v)} (${via}), ${T.n} ${t('years', '年')}.</p>
      ${r.verdict === 'unsure' ? `<div class="callout"><h3>${t('“Not sure yet” is a finding too', '"还说不准"也是发现')}</h3><p>${t(`The years swing a lot here, so ${T.n} years are not enough to decide. That is not the same as “no change”: a longer record, or another variable, might make it clear.`, `这里年份之间起伏很大，${T.n} 年的数据还不够下结论。这不等于"没有变化"：更长的记录，或者换一个变量，可能就能看清。`)}</p></div>` : ''}
      ${startYearBlock(r, v)}
      <button type="button" class="link-btn" id="replayBtn">${t(`▶ Replay the ${T.n} years`, `▶ 重新回放 ${T.n} 年`)}</button>
      ${statsTable(r, v)}</div></div>`;
  updateStartYear();
  runReplay();
}
function runReplay() {
  state.cancel?.();
  if (state.win !== null && $('mainChart')) {
    state.win = null;
    const r = result(), v = VAR(state.variable);
    $('mainChart').innerHTML = chartSvg(r.rows, r.test, { cls: r.verdict, unit: v.unit, dp: v.dp, label: esc(t('Yearly values with trend line', '每年数值和趋势线')) });
    $('stampSlot').innerHTML = stamp(question(v).mystery ? 'conflict' : r.verdict === 'unsure' ? 'unproven' : 'confirmed');
    updateStartYear();
  }
  const svg = document.querySelector('#mainChart .chart'), after = $('after');
  if (!svg || !after) return;
  const animate = state.guess !== 'skip' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  after.hidden = true; $('step5').hidden = true;
  state.cancel = replay(svg, { animate, onDone: () => {
    after.hidden = false; renderClues();
    // Land on the slider panel: slider, stamp and big answer fit on one screen, and the
    // panel flashes once so visitors notice they can drag it.
    if (animate && !state.tour) {
      const tp = $('tamper');
      if (tp) { window.scrollTo({ top: tp.getBoundingClientRect().top + scrollY - 110, behavior: 'smooth' }); flash(tp); }
      else after.querySelector('.big')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } });
}

// ---------- step 5: clues ----------
function compareRows(vid) {
  const v = VAR(vid);
  const rs = Object.entries(state.results[vid]).filter(([, r]) => r.test);
  const max = Math.max(...rs.map(([, r]) => Math.max(Math.abs(r.test.ciLow ?? r.test.slope), Math.abs(r.test.ciHigh ?? r.test.slope)))) * 1.1 || 1;
  const P = x => 50 + (x / max) * 50;
  return rs.map(([id, r]) => `<div class="cmp ${r.verdict}${id === state.site ? ' on' : ''}" data-site="${id}" data-keep="1" role="button" tabindex="0">
    <span>${esc(siteName(id))}${r.season ? ` <small>${seasonLabel(r.season)}</small>` : ''}</span>
    <span class="bar"><span class="zero"></span>${r.test.ciLow !== null ? `<span class="ci" style="left:${P(r.test.ciLow)}%;width:${P(r.test.ciHigh) - P(r.test.ciLow)}%"></span>` : ''}<span class="pt" style="left:${P(r.test.slope)}%"></span></span>
    <span class="v">${sign(r.test.slope * 10, v.dp)}</span></div>`).join('') +
    `<p class="cap">${t(`Dot = change per decade (${v.unit}); bar = likely range; line = zero. Click a row to switch place.`, `点 = 每十年的变化（${v.unit}）；横条 = 很可能的范围；竖线 = 0。点一行可以切换地点。`)}</p>`;
}
// The MERRA-2 model has haze for every month, but its values run lower than what MODIS
// measures in polluted places, so it is used to check the direction only.
function modelHaze(sat) {
  const m = state.results.AOD_MODEL?.[state.site];
  if (!m?.test) return '';
  const years = new Set(sat.rows.filter(x => x.complete).map(x => x.year));
  const avg = rows => rows.reduce((s, x) => s + x.value, 0) / rows.length;
  const satMean = avg(sat.rows.filter(x => x.complete));
  const modelRows = m.rows.filter(x => x.complete && years.has(x.year));
  if (!modelRows.length) return '';
  const modelMean = avg(modelRows);
  const dir = x => (x > 0 ? t('up', '上升') : t('down', '下降'));
  const lower = modelMean < satMean * 0.85, higher = modelMean > satMean * 1.15;
  const level = lower ? t('runs lower than', '明显低于') : higher ? t('runs higher than', '明显高于') : t('is close to', '接近');
  return `<p>${t(`The MERRA-2 model also estimates haze, with no gaps (1991–2025). Over the same years its average here (${modelMean.toFixed(2)}) ${level} what the satellite measures (${satMean.toFixed(2)}), so we only compare the direction: the model looks <b>${dir(m.test.slope)}</b> since 1991.`, `MERRA-2 模型也会估算雾霾，而且没有缺测（1991–2025）。在相同年份里，它在这里的平均值（${modelMean.toFixed(2)}）${level}卫星实测（${satMean.toFixed(2)}），所以只比较方向：模型显示 1991 年以来<b>${dir(m.test.slope)}</b>。`)}</p>`;
}
function crossCheck() {
  const c = CHECKS[state.variable];
  if (!c) return '';
  const a = result(), b = state.results[c.id]?.[state.site];
  if (!a?.test || !b?.test) return '';
  const pair = sameYears(a, b);
  if (!pair) return '';
  const dir = x => (x.slope > 0 ? t('up', '上升') : t('down', '下降'));
  const agree = Math.sign(pair.a.slope) === Math.sign(pair.b.slope);
  if (c.station) {
    const src = state.data.series[state.site][c.id].source, v = VAR(state.variable);
    const per = x => `${sign(x.slope * 10, v.dp)} ${v.unit}/${t('decade', '十年')}`;
    const sigTxt = x => (x.p < 0.05 ? t('significant', '显著') : t('not significant on its own', '单独看不显著'));
    return `<p>${t(`Thermometer check — <b>${esc(src.stationName)}</b> weather station, compared over the same ${pair.n} years that both have complete (${pair.first}–${pair.last}): station <b>${per(pair.b)}</b> (${sigTxt(pair.b)}); model region average <b>${per(pair.a)}</b>. Full records: station ${per(b.test)} (${b.test.n} years), model ${per(a.test)} (${a.test.n} years).`, `温度计核对：<b>${esc(src.stationName)}</b> 气象站，按双方都有完整数据的 ${pair.n} 个相同年份比较（${pair.first}–${pair.last}）：气象站 <b>${per(pair.b)}</b>（${sigTxt(pair.b)}）；模型区域平均 <b>${per(pair.a)}</b>。各自完整记录：气象站 ${per(b.test)}（${b.test.n} 年），模型 ${per(a.test)}（${a.test.n} 年）。`)} ${agree ? t('They agree on the direction.', '两者方向一致。') : `<b>${t('They disagree.', '两者方向相反。')}</b> ${t('The model and the thermometer tell different stories here, so this answer should not be trusted on its own. A station sits at one point in the city; the model averages a 110 km region and can miss local effects. Finding out why is the next piece of detective work.', '模型和温度计在这里讲的是两个故事，所以不能单凭本页答案下结论。气象站只代表城里的一个点；模型是 110 公里范围的平均，可能漏掉本地因素。弄清为什么，就是下一步的侦探工作。')}`}</p>`;
  }
  return `${state.variable === 'AOD' ? modelHaze(a) : ''}<p>${t(`Same question, different dataset — ${c.label()} (${b.test.firstYear}–${b.test.lastYear}${b.season ? ', ' + seasonLabel(b.season) : ''}) looks <b>${dir(b.test)}</b>; this answer looks <b>${dir(a.test)}</b>. Over the ${pair.n} years both have (${pair.first}–${pair.last}): ${dir(pair.b)} vs ${dir(pair.a)}.`, `换一套数据问同一个问题：${c.label()}（${b.test.firstYear}–${b.test.lastYear}${b.season ? '，' + seasonLabel(b.season) : ''}）看起来<b>${dir(b.test)}</b>；本页答案看起来<b>${dir(a.test)}</b>。在双方都有的 ${pair.n} 年（${pair.first}–${pair.last}）里：${dir(pair.b)} 对 ${dir(pair.a)}。`)} ${agree ? t('They agree on the direction.', '两者方向一致。') : t('They disagree, so be extra careful.', '两者方向不一致，结论要更谨慎。')}</p>`;
}
function renderClues() {
  const box = $('clues');
  if (!state.site || !result()?.test || $('after')?.hidden !== false) { $('step5').hidden = true; $('step6').hidden = true; return; }
  $('step5').hidden = false;
  renderReport();
  const v = VAR(state.variable);
  const list = (CLUES[state.site] ?? DEFAULT_CLUES).filter(([id]) => id !== state.variable);
  box.innerHTML = `<p class="hint">${t('This tool answers whether, which way, how much and how sure — not why. A detective’s next step is to collect clues: did other places, or other things, change too?', '这个工具回答"有没有变、往哪变、变多少、有多确定"，不判断原因。侦探的下一步是找线索：别的地方、别的东西有没有一起变？')}</p>
  <div class="clue-grid">
    <div class="card clue"><h3>${t(`Clue 1: ${v.short()} in other places`, `线索 1：其他地方的${v.short()}`)}</h3>${compareRows(v.id)}</div>
    <div class="card clue"><h3>${t(`Clue 2: other things in ${shortSite(state.site)}`, `线索 2：${shortSite(state.site)}的其他变量`)}</h3>
      <div class="recs">${list.map(([id, why]) => {
        const cv = VAR(id), cr = cv.pending ? null : result(state.site, id);
        const tag = cr?.test ? `<span class="tag ${cr.verdict}">${esc(verdictWord(cv, cr.verdict))} · ${sign(cr.test.slope * 10, cv.dp)} ${cv.unit}/${t('decade', '十年')}${cr.season ? ' · ' + seasonLabel(cr.season) : ''}</span>` : `<small>${cv.pending ? t('Coming soon', '即将加入') : t('Not enough data here', '这里数据不足')}</small>`;
        return `<button type="button" class="rec" data-pick="${state.site}|${id}" ${cr?.test ? '' : 'disabled'}><span class="icon" aria-hidden="true">${cv.icon}</span><span><strong>${esc(cv.name())}</strong><small>${esc(why())}</small>${tag}<small>${srcLabel(cv)}</small></span></button>`;
      }).join('')}</div>
      <p class="warn">⚠️ ${t('Two things changing together is a clue worth following — not proof that one caused the other.', '两个东西一起变化，是值得深究的线索，但不等于一个导致了另一个。')}</p>
      ${v.kind === 'model' ? `<p class="warn">${t('Variables marked “Model MERRA-2” come from the same model, so agreeing with each other is not independent evidence. Satellite data is a more independent check.', '标着"模型 MERRA-2"的变量来自同一个模型，彼此吻合不算独立证据；卫星数据才是更独立的核对。')}</p>` : ''}</div>
    <div class="card clue"><h3>${t('Clue 3: check against other data', '线索 3：用别的数据核对')}</h3>${crossCheck()}
      <p>${t('These are averages over a region, not readings from one weather station. Before concluding, compare with local station records (for example NOAA Climate Data Online).', '这些是区域平均，不是某个气象站的读数。下结论前，可以和当地气象站记录比一比（例如 NOAA 气候数据在线服务 CDO）。')}</p></div>
  </div>`;
}

// ---------- step 6: case report ----------
// Everything the investigation found, on one page the visitor can print or download.
function reportModel() {
  const v = VAR(state.variable), r = result(), T = r.test;
  const q = question(v);
  const dec = x => `${sign(x * 10, v.dp)} ${v.unit} ${t('per decade', '每十年')}`;
  const guessText = { up: v.up(), down: v.down(), flat: t('No clear change', '看不出变化'), skip: t('No guess recorded', '没有记录推测') }[state.guess] ?? '—';
  const pair = v.id === 'T2M' ? stationPair(r) : null;
  const conflict = !!pair && Math.sign(pair.b.slope) !== Math.sign(pair.a.slope);
  const finding = (q.mystery || conflict) && pair
    ? t(`Two sources disagree over the same ${pair.n} years (${pair.first}–${pair.last}): the NASA model says ${dec(pair.a.slope)}; the city’s weather station says ${dec(pair.b.slope)}.${pair.a.p >= 0.05 && pair.b.p >= 0.05 ? ' Neither is proven on its own, so not even the direction is settled.' : ''}`, `在相同的 ${pair.n} 年（${pair.first}–${pair.last}）里，两套数据意见相反：NASA 模型是${dec(pair.a.slope)}；城里的气象站是${dec(pair.b.slope)}。${pair.a.p >= 0.05 && pair.b.p >= 0.05 ? '两者单独看都证据不足，所以连方向都还定不下来。' : ''}`)
    : r.verdict === 'unsure'
      ? t(`Not proven. The data moves ${dec(T.slope)}, but the years swing too much to call it a significant trend.`, `证据不足。数据显示${dec(T.slope)}，但年份之间起伏太大，还不能算显著趋势。`)
      : t(`${verdictWord(v, r.verdict)[0].toUpperCase() + verdictWord(v, r.verdict).slice(1)}: ${dec(T.slope)}, a significant trend.`, `${verdictWord(v, r.verdict)}：${dec(T.slope)}，趋势显著。`);
  const evidence = [
    [t('Years', '年份'), `${T.firstYear}–${T.lastYear} (${T.n} ${t('complete years', '个完整年份')})${r.season ? ', ' + seasonLabel(r.season) : ''}`],
    [t('Rate of change', '变化速度'), dec(T.slope)],
    [t('Likely range (95%)', '很可能的范围（95%）'), T.ciLow === null ? '—' : `${sign(T.ciLow * 10, v.dp)} … ${sign(T.ciHigh * 10, v.dp)} ${v.unit} ${t('per decade', '每十年')}`],
    [t('Mann-Kendall test', 'Mann-Kendall 检验'), `p = ${T.p.toPrecision(2)}, q = ${r.q.toPrecision(2)}`],
    [t('Start-year check', '起始年份检查'), (c => c.skipped ? t(`Not run: only ${c.n} complete years (needs 20).`, `未做：只有 ${c.n} 个完整年份（需要 20）。`) : `${startYearText(c, r, v)} ${farthestText(c, v)}`.trim())(checkFor())],
    [t('Source', '数据来源'), `${state.data.variables[v.id]?.product ?? v.product} (doi:${state.data.variables[v.id]?.doi ?? '—'})`],
  ];
  const checks = [];
  if (pair) checks.push(t(`Thermometer (${state.data.series[state.site].T2M_STATION.source.stationName}, NOAA), same ${pair.n} years: ${dec(pair.b.slope)} vs model ${dec(pair.a.slope)} — ${conflict ? 'disagrees' : 'agrees'} on direction.`, `温度计（${state.data.series[state.site].T2M_STATION.source.stationName}，NOAA），相同 ${pair.n} 年：${dec(pair.b.slope)}，模型 ${dec(pair.a.slope)}，方向${conflict ? '相反' : '一致'}。`));
  const c = CHECKS[state.variable];
  if (c && !c.station) {
    const b = state.results[c.id]?.[state.site];
    if (b?.test) checks.push(t(`${c.label()}: looks ${b.test.slope > 0 ? 'up' : 'down'} — ${Math.sign(b.test.slope) === Math.sign(T.slope) ? 'agrees' : 'disagrees'} on direction.`, `${c.label()}：看起来${b.test.slope > 0 ? '上升' : '下降'}，方向${Math.sign(b.test.slope) === Math.sign(T.slope) ? '一致' : '相反'}。`));
  }
  if (v.id === 'T2M' && r.verdict !== 'unsure' && state.globalRows) {
    const g = trendTest(state.globalRows.filter(x => x.complete && x.year >= T.firstYear && x.year <= T.lastYear));
    if (g) checks.push(t(`Global average (NASA GISTEMP): ${sign(g.slope * 10, 2)} °C per decade over the same years.`, `全球平均（NASA GISTEMP）：同期每十年 ${sign(g.slope * 10, 2)} °C。`));
  }
  const clues = (CLUES[state.site] ?? DEFAULT_CLUES).filter(([id]) => id !== state.variable).map(([id]) => {
    const cv = VAR(id), cr = cv.pending ? null : result(state.site, id);
    const w = verdictWord(cv, cr?.verdict ?? 'unsure');
    return cr?.test ? `${cv.name()}: ${w[0].toUpperCase() + w.slice(1)} (${sign(cr.test.slope * 10, cv.dp)} ${cv.unit} ${t('per decade', '每十年')}${cr.season ? ', ' + seasonLabel(cr.season) : ''})` : `${cv.name()}: ${cv.pending ? t('data still coming', '数据未到') : t('not enough data', '数据不足')}`;
  });
  const open = [];
  if (q.mystery || conflict) open.push(t('Why do the model and the thermometer disagree? Check local station records and land use around the city.', '为什么模型和温度计意见相反？查当地气象站记录和城市周边的土地利用。'));
  if (r.verdict === 'unsure') open.push(t('Is there a trend at all? A longer record or another dataset might settle it.', '到底有没有趋势？更长的记录或另一套数据可能就能回答。'));
  if (T.n < FEW_YEARS) open.push(t(`Only ${T.n} complete years — the result is less stable.`, `只有 ${T.n} 个完整年份，结果不够稳定。`));
  open.push(t('What caused the change? This tool shows what changed, not why.', '变化的原因是什么？本工具只回答变了什么，不回答为什么。'));
  const kind = q.mystery || conflict ? 'conflict' : r.verdict === 'unsure' ? 'unproven' : 'confirmed';
  return { title: q.text, place: siteName(state.site), variable: v.name(), guessText, finding, evidence, checks, clues, open, kind, note: q.note };
}
function reportHtml(m) {
  const li = xs => xs.map(x => `<li>${esc(x)}</li>`).join('');
  const date = new Date().toISOString().slice(0, 10);
  return `<article class="report">
    <header class="rep-head"><div><p class="rep-kicker">${t('TREND DETECTIVE · CASE REPORT', '趋势侦探 · 结案报告')}</p><h3>${esc(m.title)}</h3>
      <p class="rep-meta">${esc(m.place)} · ${esc(m.variable)} · ${date}</p></div>${stamp(m.kind)}</header>
    <section><h4>${t('1. Your hypothesis', '1. 你的推测')}</h4><p>${esc(m.guessText)}</p></section>
    <section><h4>${t('2. What the data says', '2. 数据怎么说')}</h4><p class="rep-finding">${esc(m.finding)}</p>
      <table>${m.evidence.map(([k, x]) => `<tr><th>${esc(k)}</th><td>${esc(x)}</td></tr>`).join('')}</table></section>
    ${m.checks.length ? `<section><h4>${t('3. Cross-checks', '3. 交叉核对')}</h4><ul>${li(m.checks)}</ul></section>` : ''}
    <section><h4>${m.checks.length ? t('4. Clues collected', '4. 收集到的线索') : t('3. Clues collected', '3. 收集到的线索')}</h4><ul>${li(m.clues)}</ul></section>
    ${m.note ? `<section><h4>${t('Detective’s note', '侦探笔记')}</h4><p>${esc(m.note)}</p></section>` : ''}
    <section><h4>${t('Still open', '尚未解开的疑点')}</h4><ul>${li(m.open)}</ul></section>
    <footer class="rep-foot">${t('Method: yearly values, Mann-Kendall test with lag-1 autocorrelation correction, Sen slope with 95% interval, Benjamini-Hochberg across 8 cities. Data: NASA Giovanni / POWER, NOAA GHCN-Monthly, NASA GISTEMP.', '方法：年度值；Mann-Kendall 检验（含一阶自相关修正）、Sen 斜率及 95% 区间、8 城市 Benjamini-Hochberg 校正。数据：NASA Giovanni / POWER、NOAA GHCN-Monthly、NASA GISTEMP。')}</footer>
  </article>`;
}
function renderReport() {
  $('step6').hidden = false;
  const m = reportModel();
  $('report').innerHTML = `<p class="hint">${t('Here is everything your investigation found, on one page. Print it, save it as a PDF, or download it to share.', '这是你这次调查的全部发现，汇成一页。可以打印、存成 PDF，或下载后分享。')}</p>
    ${reportHtml(m)}
    <div class="next-steps"><h4>🕵️ ${t('Case closed. What next?', '结案了。接下来查什么？')}</h4>
      <div class="hero-actions"><button type="button" class="btn tab-btn" data-goto="cases">📁 ${t('Open another case', '换一个案子')}</button><button type="button" class="btn tab-btn" data-goto="guide">🧩 ${t('Build your own case', '自己组一个案子')}</button><button type="button" class="btn tab-btn" data-goto="step2">🗺️ ${t('Pick a city on the map', '回到地图选城市')}</button><button type="button" class="btn tab-btn" data-goto="top">🏠 ${t('Back to the home page', '回到首页')}</button></div></div>
    <div class="hero-actions rep-actions"><button type="button" class="btn" id="printReport">${t('Print or save as PDF', '打印 / 存成 PDF')}</button><button type="button" class="btn btn-soft" id="downloadReport">${t('Download report (HTML)', '下载报告（HTML）')}</button></div>`;
}
function downloadReport() {
  const m = reportModel();
  const css = [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules].map(x => x.cssText); } catch { return []; } }).filter(x => /^(:root|\.report|\.rep-|\.stamp|@keyframes stamp|body)/.test(x) || x.includes('.report') || x.includes('.stamp')).join('\n');
  const html = `<!doctype html><html lang="${getLang() === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(m.title)} — Trend Detective</title><style>${css}\nbody{margin:0;padding:24px;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif}</style></head><body>${reportHtml(m)}</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `trend-detective-${state.site}-${state.variable.toLowerCase()}.html`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- data catalogue ----------
function renderCatalog() {
  state.results.T2M_POWER ??= compare(state.data.series, 'T2M_POWER', { annual: 'mean' }, state.data.sites.map(s => s.id));
  const ids = [...VARIABLES.filter(v => !v.pending).map(v => v.id), 'AOD_AQUA', 'AOD_MODEL', 'T2M_STATION', 'T2M_POWER'];
  const rows = ids.map(id => {
    const meta = state.data.variables[id] ?? null;
    const any = Object.values(state.data.series).find(s => s[id])?.[id];
    const tested = Object.values(state.results[id] ?? {}).filter(r => r.test).length;
    const gaps = state.data.sites.map(s => [s.id, state.data.series[s.id]?.[id]?.missing ?? 0]).filter(([, m]) => m > 0).map(([s, m]) => `${shortSite(s)} ${m}`);
    const seasons = Object.entries(state.results[id] ?? {}).filter(([, r]) => r.season).map(([s, r]) => `${shortSite(s)} ${seasonLabel(r.season)}`);
    const name = VAR(id)?.name() ?? { AOD_AQUA: t('Haze (Aqua satellite)', '雾霾（Aqua 卫星）'), AOD_MODEL: t('Haze (model)', '雾霾（模型）'), T2M_POWER: t('Air temperature (one grid cell)', '气温（单个格点）'), T2M_STATION: t('Air temperature (weather stations)', '气温（气象站）') }[id];
    const product = meta ? `${esc(meta.product)}<br><a href="https://doi.org/${meta.doi}" target="_blank" rel="noopener">doi:${meta.doi}</a>`
      : id === 'T2M_STATION' ? `NOAA NCEI GHCN-Monthly v4 (TAVG, adjusted)<br><a href="https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-monthly" target="_blank" rel="noopener">ncei.noaa.gov</a> · ${t('one station per city', '每个城市一个站')}`
      : 'NASA POWER Monthly API v2.10.0 (MERRA-2)';
    return `<tr><th>${esc(name)}</th><td>${product}</td><td>${any ? `${any.start.slice(0, 4)}–${any.end.slice(0, 4)}` : '—'}</td><td>${tested} / 8</td><td>${gaps.length ? esc(gaps.join(', ')) : t('none', '无')}${seasons.length ? `<br><small>${t('Observable months only:', '只用看得清的月份：')} ${esc(seasons.join(', '))}</small>` : ''}</td></tr>`;
  }).join('');
  $('catalog').innerHTML = `<div class="table-scroll"><table><thead><tr><th>${t('Variable', '变量')}</th><th>${t('Product', '产品')}</th><th>${t('Years', '年份')}</th><th>${t('Places tested', '可检验地点')}</th><th>${t('Missing months', '缺测月数')}</th></tr></thead><tbody>${rows}
    </tbody></table></div>
    <p class="cap">${t('Region = 1° × 1° box around each city (Giovanni area average). A year counts only if all its months have data; gaps are never filled. Satellite haze gaps come from dark winters and cloudy seasons. Plant greenness (NASA AppEEARS statistics over the same boxes) leaves out any month where more than 20% of the area is cloudy or snowy.', '区域 = 每个城市周围 1°×1° 的方框（Giovanni 区域平均）。一年里所有月份都有数据才算一年；不补值。植被绿度（NASA AppEEARS 对同一方框的统计）中，凡是超过 20% 面积被云或雪遮住的月份都不计入。卫星雾霾的缺测来自冬季昏暗和多云季节。')}</p>`;
}

// ---------- interaction ----------
function renderFlow() { renderCases(); renderGuide(); renderMap(); renderVars(); renderAnswer(); }
function renderHero() {
  const svg = $('caseWall');
  svg.innerHTML = `<title id="cwTitle">${esc(t(...STATIC.cwTitle))}</title>` + caseWallSvg(state.data, state.results.T2M);
  animateCaseWall(svg);
  watchCaseWall(svg);
  const wrap = $('caseWallWrap');
  if (wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
}
function renderAll() { renderStatic(); renderHero(); renderFlow(); renderCatalog(); }
// Scroll to a step and flash it briefly so the eye follows the move.
function flash(el) { if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
function goStep(id) {
  const el = $(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  flash(el);
}
function pick({ site, variable, caseId = null, guess = null, scroll = true }) {
  if (site) state.site = site;
  if (variable) state.variable = variable;
  state.caseId = caseId; state.guess = guess; state.win = null;
  renderFlow();
  if (scroll) $('step4').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.addEventListener('click', e => {
  if (e.target.closest('.term')) return;
  if (e.target.closest('#replayBtn')) { runReplay(); return; }
  const go = e.target.closest('[data-goto]');
  if (go) {
    if (go.dataset.goto === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (/^step\d$/.test(go.dataset.goto)) { goStep(go.dataset.goto); return; }
    if (go.dataset.goto === 'tamper' && $('tamper')) { window.scrollTo({ top: $('tamper').getBoundingClientRect().top + scrollY - 110, behavior: 'smooth' }); flash($('tamper')); return; }
    const el = $(go.dataset.goto);
    el?.scrollIntoView({ behavior: 'smooth', block: go.dataset.goto === 'guide' ? 'center' : 'start' });
    if (go.dataset.goto === 'guide') { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    return;
  }
  if (e.target.closest('#resetWindow')) { state.win = null; updateStartYear(true); return; }
  const dot = e.target.closest('.rb-dot');
  if (dot) { state.win = Number(dot.dataset.start); updateStartYear(true); $('tamper')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (e.target.closest('#printReport')) { window.print(); return; }
  if (e.target.closest('#downloadReport')) { downloadReport(); return; }
  const el = e.target.closest('[data-lang],[data-case],[data-topic],[data-ptype],[data-pick],[data-site],[data-var],[data-guess]');
  if (!el || el.disabled) return;
  const d = el.dataset;
  if (d.lang) { setLang(d.lang); try { localStorage.setItem('td-lang', d.lang); } catch { /* storage unavailable */ } renderAll(); return; }
  if (d.case) { const c = CASES.find(x => x.id === d.case); pick({ site: c.site, variable: c.variable, caseId: c.id }); return; }
  if (d.topic) { state.topic = d.topic; renderGuide(); return; }
  if (d.ptype) { state.ptype = d.ptype; renderGuide(); return; }
  if (d.pick) { const [site, variable] = d.pick.split('|'); pick({ site, variable }); return; }
  if (d.guess) { state.guess = d.guess; renderAnswer(); return; }
  if (d.hero) { pick({ site: d.site, variable: 'T2M' }); return; }
  if (d.site) { pick({ site: d.site, guess: d.keep ? 'skip' : null, scroll: false }); if (!d.keep) flash($('step3')); return; }
  // Choosing what to measure only selects it; the 'See the answer' button moves on.
  if (d.var) { pick({ variable: d.var, scroll: false }); flash($('seeAnswer')); }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-site], [role="button"][data-goto]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});

// glossary pop-ups (hover, tap or keyboard focus)
let tip = null;
const hideTip = () => { tip?.remove(); tip = null; };
function showTip(el) {
  hideTip();
  tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'tooltip');
  tip.textContent = GLOSSARY[el.dataset.term]();
  document.body.append(tip);
  const r = el.getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(scrollX + r.left, scrollX + document.documentElement.clientWidth - tip.offsetWidth - 8)) + 'px';
  tip.style.top = (scrollY + r.bottom + 8) + 'px';
}
document.addEventListener('mouseover', e => { const x = e.target.closest('.term'); if (x) showTip(x); });
document.addEventListener('mouseout', e => { if (e.target.closest('.term')) hideTip(); });
document.addEventListener('focusin', e => { const x = e.target.closest('.term'); if (x) showTip(x); });
document.addEventListener('focusout', e => { if (e.target.closest('.term')) hideTip(); });
document.addEventListener('click', e => { const x = e.target.closest('.term'); if (x) showTip(x); else hideTip(); });

// ---------- 30-second guided example (8 steps) ----------
// About 30 seconds: the case wall, one mystery (New Delhi), one trick to catch (Cairo haze +
// slider), the detective's note and the case report, then back to the ways in.
// Drag the start year step by step so the viewer sees the stamp change.
function tourDrag(to) {
  const c = checkFor();
  if (!c || c.skipped) return;
  const starts = c.windows.map(w => w.start).filter(y => y <= to);
  starts.forEach((y, k) => { state.tourDrag.push(setTimeout(() => { if (state.tour === null) return; state.win = y; updateStartYear(true); }, 250 + k * 220)); });
}
const later = (ms, fn) => state.tourDrag.push(setTimeout(() => { if (state.tour !== null) fn(); }, ms));
const TOUR = [
  { el: 'caseWallWrap', text: () => t('Welcome, detective. Each card is a city with 35 years of NASA temperature data, pinned to one question: is Earth changing?', '欢迎你，侦探。每张卡片是一座城市和它 35 年的 NASA 气温数据，都钉在同一个问题上：地球在变吗？'), act: () => window.scrollTo({ top: 0, behavior: 'smooth' }), noScroll: true, ms: 3400 },
  { el: 'step4', text: () => t('Case 1: New Delhi. Read the case brief, then guess first. We say “got warmer”… and replay 35 years.', '案子 1：新德里。先读案情简介，再猜。我们猜"变暖了"……然后回放 35 年。'), act: () => { pick({ site: 'delhi', variable: 'T2M', caseId: 'delhi', scroll: false }); $('step4').scrollIntoView({ behavior: 'smooth', block: 'start' }); later(1900, () => { state.guess = 'up'; renderAnswer(); }); }, noScroll: true, ms: 4600 },
  { el: 'step4', text: () => t('Twist: NASA’s model looks like cooling, the city’s thermometer looks like warming, and neither is proven. Case open.', '反转：NASA 模型看起来在降温，城里的温度计却看起来在升温，而且都没被证实。案子没结。'), act: () => document.querySelector('#answer .big')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), noScroll: true, ms: 3600 },
  { el: 'step4', text: () => t('Case 2: is Cairo’s air getting cleaner? Over all the years, the satellite says: not proven.', '案子 2：开罗的空气变干净了吗？看全部年份，卫星的回答是：证据不足。'), act: () => { pick({ site: 'cairo', variable: 'AOD', caseId: 'cairohaze', guess: 'skip', scroll: false }); later(350, () => $('mainChart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }, noScroll: true, ms: 3400 },
  { el: 'tamper', text: () => t('Now let’s fake the evidence: keep only the years we like… and watch the stamp.', '现在试着伪造证据：只留下我们喜欢的年份……注意看印章。'), act: () => tourDrag(2009), block: 'center', ms: 5000 },
  { el: 'step4', text: () => t('Gotcha! Picking the years that fit is how people get fooled. Every case ends with a detective’s note like this one.', '抓到了！只挑符合说法的年份，就是被骗的套路。每个案子最后都有一段这样的侦探笔记。'), act: () => document.querySelector('#answer .det-note')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), noScroll: true, ms: 3600 },
  { el: 'step6', text: () => t('Close the case: one page with your guess, the evidence and the clues, to print or share.', '结案：一页纸写下你的推测、证据和线索，可以打印或分享。'), act: () => $('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), noScroll: true, ms: 3400 },
  { el: 'heroActions', text: () => t('Your turn! Open a case file, build your own case, or pick a city on the map.', '轮到你了！打开一个案卷、自己组一个案子，或者在地图上选一座城市。'), act: () => { $('heroActions').scrollIntoView({ behavior: 'smooth', block: 'center' }); flash($('heroActions')); }, noScroll: true, ms: 3800 },
];
function stopTour() { clearTimeout(state.tour); state.tourDrag.forEach(clearTimeout); state.tourDrag = []; state.tour = null; $('tourBar').hidden = true; document.querySelectorAll('.hl').forEach(x => x.classList.remove('hl')); }
function tourStep(i) {
  document.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  if (i >= TOUR.length) { stopTour(); return; }
  const s = TOUR[i];
  s.act?.();
  const el = $(s.el); el?.classList.add('hl');
  if (!s.noScroll) el?.scrollIntoView({ behavior: 'smooth', block: s.block ?? 'start' });
  $('tourText').textContent = s.text();
  state.tour = setTimeout(() => tourStep(i + 1), s.ms ?? 3600);
}
$('openCase').addEventListener('click', () => $('step1').scrollIntoView({ behavior: 'smooth', block: 'start' }));
$('tourBtn').addEventListener('click', () => { stopTour(); $('tourBar').hidden = false; state.tour = -1; tourStep(0); });
$('tourStop').addEventListener('click', stopTour);

// ---------- start ----------
let saved = null;
try { saved = localStorage.getItem('td-lang'); } catch { /* storage unavailable */ }
setLang(new URLSearchParams(location.search).get('lang') ?? saved ?? 'en');
renderStatic();
// Tell the visitor something is happening while ~400 KB of data loads, and say so if it fails.
$('loadStatus').textContent = t('Opening the case files…', '正在打开案卷……');
try {
  await Promise.all([load(), loadLand()]);
} catch (err) {
  $('loadStatus').classList.add('error');
  $('loadStatus').innerHTML = `${esc(t('Sorry, the case files could not be loaded. Check your internet connection and try again.', '抱歉，案卷加载失败。请检查网络后重试。'))} <button type="button" class="btn btn-small" onclick="location.reload()">${esc(t('Try again', '重试'))}</button>`;
  throw err;
}
$('loadStatus').textContent = '';
$('loadStatus').hidden = true;
renderAll();
document.addEventListener('input', e => {
  if (e.target.id === 'startSlider') { state.win = Number(e.target.value); updateStartYear(true); }
});
document.addEventListener('keydown', e => {
  const dot = e.target.closest?.('.rb-dot');
  if (dot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); state.win = Number(dot.dataset.start); updateStartYear(true); }
});
