// Trend Detective page: question -> place -> variable -> guess -> replay -> answer -> clues.
// The tool answers whether, which way, how much and how sure. It never claims a cause.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.
import { t, setLang, getLang, STATIC } from './i18n.js';
import { compare, yearly } from './data.js';
import { trendTest } from './stats.js';
import { VARIABLES, CHECKS, VAR } from './variables.js';
import { CASES, TOPICS, PLACE_TYPES, CLUES, DEFAULT_CLUES, GLOSSARY, siteName, shortSite } from './content.js';
import { chartSvg, replay } from './chart.js';
import { loadLand, mapSvg } from './map.js';
import { caseWallSvg, animateCaseWall } from './hero.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sign = (v, dp) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(Math.max(0, dp));
const term = (key, text) => `<span class="term" tabindex="0" data-term="${key}">${text}</span>`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const seasonLabel = m => (m ? t(`${MON[m[0] - 1]}–${MON[m[m.length - 1] - 1]}`, `${m[0]}–${m[m.length - 1]} 月`) : '');

// Fewer usable years than this gets an explicit "less stable" note.
const FEW_YEARS = 20;
const state = { data: null, results: {}, site: null, variable: 'T2M', caseId: null, guess: null, topic: null, ptype: null, cancel: null, tour: null };
const result = (site = state.site, vid = state.variable) => state.results[vid]?.[site];
const verdictWord = (v, vd) => ({ up: v.goingUp(), down: v.goingDown(), unsure: t('Not sure yet', '还说不准') })[vd];

// ---------- data ----------
async function load() {
  state.data = await (await fetch('data/processed/series.json')).json();
  const ids = state.data.sites.map(s => s.id);
  VARIABLES.filter(v => !v.pending).forEach(v => { state.results[v.id] = compare(state.data.series, v.id, v, ids); });
  Object.values(CHECKS).forEach(c => { if (!state.results[c.id]) state.results[c.id] = compare(state.data.series, c.id, c, ids); });
  state.results.AOD_MODEL = compare(state.data.series, 'AOD_MODEL', { annual: 'mean' }, ids);
  state.globalRows = state.data.global ? yearly(state.data.global.T2M, { annual: 'mean' }).rows : null;
}

// ---------- static text ----------
function renderStatic() {
  document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(...STATIC[el.dataset.t]); });
  document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  $('foot').innerHTML = t(
    'Data: NASA Giovanni (MERRA-2, MODIS, GPM IMERG; ~1° × 1° area averages) and NASA POWER, downloaded 14 November 2026. Analyses and visualizations used in this project were produced with the Giovanni online data system, developed and maintained by the NASA GES DISC. Map: Natural Earth via world-atlas (ISC). Code: MIT licence. Built with help from Claude, an AI assistant (see README).',
    '数据：NASA Giovanni（MERRA-2、MODIS、GPM IMERG；约 1°×1° 区域平均）与 NASA POWER，2026 年 11 月 14 日下载。本项目的分析与可视化使用了 NASA GES DISC 开发维护的 Giovanni 在线数据系统。地图：Natural Earth（world-atlas，ISC 许可）。代码：MIT 许可。开发中使用了 AI 助手 Claude（见 README）。');
}

// ---------- step 1: cases and guiding questions ----------
function renderCases() {
  $('cases').innerHTML = CASES.map(c => `<button type="button" class="case${state.caseId === c.id ? ' on' : ''}" data-case="${c.id}">
    <span class="tag">${t('Case', '案例')}</span><strong>${esc(c.title())}</strong><small>${esc(c.sub())}</small></button>`).join('');
}
const srcLabel = v => (v.kind === 'satellite' ? term('satellite', t('Satellite', '卫星')) : term('model', t('Model', '模型'))) + ' ' + esc(v.product);
function renderGuide() {
  const chip = (attr, id, on, label) => `<button type="button" class="chip${on ? ' on' : ''}" ${attr}="${id}">${label}</button>`;
  let recs = `<p class="hint" style="margin:8px 0 0;font-weight:400">${t('Answer both and we’ll suggest what to investigate.', '两个都选好，我们就推荐可以调查的组合。')}</p>`;
  if (state.topic && state.ptype) {
    const sites = PLACE_TYPES.find(p => p.id === state.ptype).sites;
    const vars = VARIABLES.filter(v => v.topic === state.topic);
    recs = `<div class="recs">${sites.flatMap(s => vars.map(v => {
      const r = v.pending ? null : result(s, v.id);
      const ok = r?.test;
      return `<button type="button" class="rec" data-pick="${s}|${v.id}" ${ok ? '' : 'disabled'}><span class="icon" aria-hidden="true">${v.icon}</span>
        <span><strong>${esc(t(`${v.name()} in ${shortSite(s)}`, `${shortSite(s)}的${v.name()}`))}</strong><small>${srcLabel(v)}${ok ? '' : ' · ' + (v.pending ? t('coming soon', '即将加入') : t('not enough data here', '这里数据不足'))}</small></span></button>`;
    })).join('')}</div>`;
  }
  $('guide').innerHTML = `<p>${t('Or answer two questions:', '或者，回答两个问题：')}</p>
    <div class="guide-row"><span>${t('What do you want to investigate?', '你想调查什么？')}</span><div class="chips">${TOPICS.map(x => chip('data-topic', x.id, state.topic === x.id, `${x.icon} ${x.name()}`)).join('')}</div></div>
    <div class="guide-row"><span>${t('What kind of place?', '你想看哪种地方？')}</span><div class="chips">${PLACE_TYPES.map(x => chip('data-ptype', x.id, state.ptype === x.id, x.name())).join('')}</div></div>${recs}`;
}

// ---------- step 2: map ----------
function renderMap() {
  const v = VAR(state.variable);
  const sites = state.data.sites.map(s => ({ id: s.id, lon: s.lon, lat: s.lat, label: esc(shortSite(s.id)), cls: result(s.id)?.verdict ?? 'na', on: state.site === s.id }));
  $('map').innerHTML = mapSvg(sites);
  $('map').setAttribute('aria-label', t(`World map: places coloured by ${v.short()} trend`, `世界地图：按${v.short()}趋势上色`));
  $('legend').innerHTML = `<span><i class="dot up"></i>${t('Rising', '在上升')}</span><span><i class="dot down"></i>${t('Falling', '在下降')}</span><span><i class="dot unsure"></i>${t('Not sure yet', '还说不准')}</span><span><i class="dot na"></i>${t('No usable data', '无可用数据')}</span><span>· ${t(`Colour = ${v.short()} trend`, `颜色 = ${v.short()}趋势`)}</span>`;
  $('places').innerHTML = state.data.sites.map(s => `<button type="button" class="chip${state.site === s.id ? ' on' : ''}" data-site="${s.id}"><i class="dot ${result(s.id)?.verdict ?? 'na'}"></i>${esc(siteName(s.id))}</button>`).join('');
}

// ---------- step 3: variables ----------
function renderVars() {
  $('vars').innerHTML = VARIABLES.map(v => `<button type="button" class="var${state.variable === v.id ? ' on' : ''}" data-var="${v.id}" ${v.pending ? 'disabled' : ''}>
    <span class="icon" aria-hidden="true">${v.icon}</span><strong>${esc(v.name())}</strong><p>${esc(v.def())}</p><span class="src">${srcLabel(v)}</span>
    ${v.pending ? `<span class="tag">${t('Coming soon', '即将加入')}</span>` : ''}</button>`).join('');
}

// ---------- step 4: guess, replay, answer ----------
function question(v) {
  const c = CASES.find(x => x.id === state.caseId && x.site === state.site && x.variable === state.variable);
  return { text: c ? c.title() : t(`Is the ${v.short()} in ${shortSite(state.site)} changing?`, `${shortSite(state.site)}的${v.short()}在变化吗？`), expect: c?.expect, mystery: !!c?.mystery };
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
      sig ? t(`A ${term('significant', 'significant')} ${term('trend', 'trend')}, not just random ups and downs.`, `这是${term('significant', '显著')}的${term('trend', '趋势')}，不像随机起伏。`) : t('The years jump around too much to call it a significant trend.', '年份之间起伏太大，还不能算显著的趋势。'))}
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
    [t('Several places', '多地点校正'), `Benjamini-Hochberg q = ${r.q.toPrecision(2)} (${n} ${t('places tested together', '个地点一起检验')})`],
    [t('Years used', '使用年份'), `${T.n} (${T.firstYear}–${T.lastYear})${r.season ? t(`, ${seasonLabel(r.season)} only`, `，只用 ${seasonLabel(r.season)}`) : ''}`],
    [t('Data', '数据'), `${esc(meta.product)} · <a href="https://doi.org/${meta.doi}" target="_blank" rel="noopener">doi:${meta.doi}</a>`],
  ];
  return `<details class="stats"><summary>${t('For the curious: the statistics', '给懂行的人看：统计细节')}</summary>
    <table class="kv">${rows.map(([k, x]) => `<tr><th>${k}</th><td>${x}</td></tr>`).join('')}</table>
    <p class="cap">${t('The map colours and answers use the stricter q-value because several places are tested at once. Details: docs/method.md.', '因为同时检验了多个地点，地图颜色和结论都用更严格的 q 值。详见 docs/method.md。')}</p></details>`;
}
// The New Delhi case: the model and the city's thermometer disagree, and the page says so.
function renderMystery(box, q, r, v) {
  const s = state.results.T2M_STATION?.[state.site];
  const src = state.data.series[state.site].T2M_STATION.source;
  const T = r.test, ST = s.test;
  const per = x => `${sign(x.slope * 10, 2)} °C ${t('per decade', '每十年')}`;
  const sig = x => (x.p < 0.05 ? t('significant', '显著') : t('not significant on its own', '单独看不显著'));
  const says = x => (x.slope > 0 ? t('Warming', '在变暖') : t('Cooling', '在降温'));
  const guessed = { up: 'up', down: 'down', flat: 'flat' }[state.guess];
  const mine = { up: v.up(), down: v.down(), flat: t('No clear change', '看不出变化') }[state.guess];
  const dirOf = x => (x.slope > 0 ? 'up' : 'down');
  const badge = state.guess === 'skip' ? '' : `<p class="badge ${guessed === dirOf(T) || guessed === dirOf(ST) ? 'ok' : 'miss'}">🔎 ${t(`You guessed “${mine}”. The model ${guessed === dirOf(T) ? 'agrees' : 'disagrees'}; the thermometer ${guessed === dirOf(ST) ? 'agrees' : 'disagrees'}.`, `你猜的是"${mine}"。模型${guessed === dirOf(T) ? '同意' : '不同意'}；温度计${guessed === dirOf(ST) ? '同意' : '不同意'}。`)}</p>`;
  box.innerHTML = `<div class="card answer"><p class="q">${esc(q.text)}</p>
    <p class="cap">${t('Each dot = one year’s average air temperature from the NASA model (°C); thick line = the trend; light fan = the likely range.', '每个点 = NASA 模型给出的一年平均气温（°C）；粗线 = 趋势；浅色扇形 = 很可能的范围。')}</p>
    ${chartSvg(r.rows, T, { cls: r.verdict, unit: v.unit, dp: v.dp, label: esc(t('Yearly model temperature with trend line', '模型每年气温和趋势线')) })}
    <div class="after" id="after" hidden>${stamp('conflict')}${badge}
      <p class="big unsure">${t('Two sources, two answers', '两套数据，两个答案')}</p>
      <div class="duel">
        <div class="part"><div class="part-q">🛰️ ${t(`NASA model (MERRA-2), 110 km ${term('region', 'region')}`, `NASA 模型（MERRA-2），110 公里${term('region', '区域')}`)}</div><div class="part-a ${dirOf(T)}">${says(T)} ${dirOf(T) === 'up' ? '↗' : '↘'}</div><div class="part-d">${per(T)} · ${sig(T)} · ${T.firstYear}–${T.lastYear}</div></div>
        <div class="part"><div class="part-q">🌡️ ${t(`Thermometer: ${esc(src.stationName)} weather station (NOAA)`, `温度计：${esc(src.stationName)} 气象站（NOAA）`)}</div><div class="part-a ${dirOf(ST)}">${says(ST)} ${dirOf(ST) === 'up' ? '↗' : '↘'}</div><div class="part-d">${per(ST)} · ${sig(ST)} · ${ST.n} ${t('complete years', '个完整年份')}</div></div>
      </div>
      <div class="callout"><h3>${t('Case open: why would they disagree?', '案子还没破：为什么两者会不一样？')}</h3><p>${t('In 7 of our 8 cities the model and the thermometer agree closely, so this is unusual. The station measures one spot in a fast-growing city; the model averages a 110 km region that also takes in large areas of irrigated farmland, and it can miss local effects. Neither number is “the truth” on its own — the leads below are where a detective would look next.', '在我们的 8 个城市里，有 7 个模型和温度计非常接近，所以这里很不寻常。气象站测的是一座快速扩张的城市里的一个点；模型是 110 公里区域的平均，里面还包括大片灌溉农田，也可能漏掉本地因素。单看哪一个数字都不是"真相"，下面的线索是侦探接下来要查的方向。')}</p></div>
      <button type="button" class="link-btn" id="replayBtn">${t(`▶ Replay the ${T.n} years`, `▶ 重新回放 ${T.n} 年`)}</button>
      <details class="stats"><summary>${t('The model’s answer in detail', '模型答案的细节')}</summary>${parts(r, v)}${statsTable(r, v).replace(/^<details class="stats"><summary>[^<]*<\/summary>/, '').replace(/<\/details>$/, '')}</details>
    </div></div>`;
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
function stamp(kind) {
  const label = {
    confirmed: t('Trend confirmed', '趋势成立'),
    unproven: t('Not proven', '证据不足'),
    conflict: t('Conflicting evidence', '证据矛盾'),
  }[kind];
  return `<div class="stamp stamp-${kind}" aria-hidden="true">${label}</div>`;
}

// If the city's weather station trends the other way, say so right under the big answer.
function stationWarning(r, v) {
  if (v.id !== 'T2M') return '';
  const s = state.results.T2M_STATION?.[state.site];
  if (!s?.test || Math.sign(s.test.slope) === Math.sign(r.test.slope)) return '';
  const name = state.data.series[state.site].T2M_STATION.source.stationName;
  return `<p class="note">⚠️ ${t(`But the city’s ${esc(name)} weather station shows ${s.test.slope > 0 ? 'warming' : 'cooling'} (${sign(s.test.slope * 10, 2)} °C per decade). The model and the thermometer disagree — see Clue 3 before believing either.`, `但城里的 ${esc(name)} 气象站显示的是${s.test.slope > 0 ? '升温' : '降温'}（每十年 ${sign(s.test.slope * 10, 2)} °C）。模型和温度计意见相反，先看线索 3，再决定信哪一个。`)}</p>`;
}
function renderAnswer() {
  state.cancel?.();
  const box = $('answer');
  if (!state.site) { box.innerHTML = `<div class="card answer"><p class="q">${t('Pick a case, answer the two questions, or click a place on the map.', '先选一个案例、回答两个问题，或者在地图上点一个地点。')}</p></div>`; return; }
  const v = VAR(state.variable), r = result();
  if (!r?.test) {
    box.innerHTML = `<div class="card answer"><p class="q">${t(`Not enough ${v.short()} data for ${siteName(state.site)}`, `${siteName(state.site)}的${v.short()}数据不够`)}${state.site === 'nuuk' && v.id === 'SOIL' ? t(': the area is mostly ice and snow.', '：这里大多是冰雪。') : t(' to test a trend.', '，无法做趋势检验。')} ${t('Try another place or variable.', '换一个地点或变量试试。')}</p></div>`;
    return;
  }
  const q = question(v), T = r.test;
  const span = T.lastYear - T.firstYear + 1;
  const fewNote = T.n < FEW_YEARS ? ` ${t(`Only ${T.n} of the ${span} years from ${T.firstYear} to ${T.lastYear} have complete data, so this result is less stable than one built on a long, unbroken record.`, `${T.firstYear}–${T.lastYear} 年的 ${span} 年里只有 ${T.n} 年数据完整，所以这个结果不如长期连续记录那样稳定。`)}` : '';
  const seasonNote = r.season
    ? `<p class="note">🛰️ ${t(`In some months here (dark winters or cloudy rainy seasons) the satellite cannot see the ground, so we compare only the ${seasonLabel(r.season)} average each year. Missing months are never filled in.`, `这里有些月份（冬季太暗或雨季云多）卫星看不到地面，所以只比较每年 ${seasonLabel(r.season)} 的平均。缺的月份不补值。`)}${fewNote}</p>`
    : fewNote ? `<p class="note">⚠️${fewNote}</p>` : '';
  if (!state.guess) {
    const opts = [['up', '↗', v.up()], ['down', '↘', v.down()], ['flat', '〰', t('No clear change', '看不出变化')]];
    box.innerHTML = `<div class="card answer guess"><p class="q">${esc(q.text)}</p><p class="guess-lead">${t('Make a guess first!', '先猜一猜！')}</p>
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
  const via = t(`${state.data.series[state.site][v.id].source.via.includes('Giovanni') ? 'NASA Giovanni' : 'NASA POWER'}, ${term('region', 'region')} average`, `${state.data.series[state.site][v.id].source.via.includes('Giovanni') ? 'NASA Giovanni' : 'NASA POWER'}，${term('region', '区域')}平均`);
  box.innerHTML = `<div class="card answer"><p class="q">${esc(q.text)}</p>${seasonNote}
    <p class="cap">${t(`Each dot = one year’s ${r.season ? seasonLabel(r.season) + ' average' : 'value'} (${v.unit}); thick line = the trend; light fan = the likely range.`, `每个点 = 一年的${r.season ? ` ${seasonLabel(r.season)} 平均` : '数值'}（${v.unit}）；粗线 = 趋势；浅色扇形 = 很可能的范围。`)}</p>
    ${chartSvg(r.rows, T, { cls: r.verdict, unit: v.unit, dp: v.dp, label: esc(t('Yearly values with trend line', '每年数值和趋势线')) })}
    <div class="after" id="after" hidden>${stamp(r.verdict === 'unsure' ? 'unproven' : 'confirmed')}${badge}
      <p class="big ${r.verdict}">${bigAnswer(r.verdict, q.expect, v)}</p>${stationWarning(r, v)}${everyday(r, v)}${v.id === 'T2M' && r.verdict !== 'unsure' ? globalLine(T) : ''}${parts(r, v)}
      <p class="cap">${t('Data:', '数据：')} ${srcLabel(v)} (${via}), ${T.n} ${t('years', '年')}.</p>
      ${r.verdict === 'unsure' ? `<div class="callout"><h3>${t('“Not sure yet” is a finding too', '"还说不准"也是发现')}</h3><p>${t(`The years swing a lot here, so ${T.n} years are not enough to decide. That is not the same as “no change”: a longer record, or another variable, might make it clear.`, `这里年份之间起伏很大，${T.n} 年的数据还不够下结论。这不等于"没有变化"：更长的记录，或者换一个变量，可能就能看清。`)}</p></div>` : ''}
      <button type="button" class="link-btn" id="replayBtn">${t(`▶ Replay the ${T.n} years`, `▶ 重新回放 ${T.n} 年`)}</button>
      ${statsTable(r, v)}</div></div>`;
  runReplay();
}
function runReplay() {
  state.cancel?.();
  const svg = document.querySelector('#answer .chart'), after = $('after');
  if (!svg || !after) return;
  const animate = state.guess !== 'skip' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  after.hidden = true; $('step5').hidden = true;
  state.cancel = replay(svg, { animate, onDone: () => {
    after.hidden = false; renderClues();
    if (animate && !state.tour) after.querySelector('.big')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  const dir = r => (r.test.slope > 0 ? t('up', '上升') : t('down', '下降'));
  const agree = Math.sign(a.test.slope) === Math.sign(b.test.slope);
  if (c.station) {
    const src = state.data.series[state.site][c.id].source, v = VAR(state.variable);
    const per = r => `${sign(r.test.slope * 10, v.dp)} ${v.unit}/${t('decade', '十年')}`;
    const sigTxt = r => (r.test.p < 0.05 ? t('significant', '显著') : t('not significant on its own', '单独看不显著'));
    return `<p>${t(`Thermometer check — <b>${esc(src.stationName)}</b> weather station (${b.test.n} complete years, ${b.test.firstYear}–${b.test.lastYear}): <b>${per(b)}</b> (${sigTxt(b)}). The model region average: <b>${per(a)}</b>.`, `温度计核对：<b>${esc(src.stationName)}</b> 气象站（${b.test.n} 个完整年份，${b.test.firstYear}–${b.test.lastYear}）：<b>${per(b)}</b>（${sigTxt(b)}）。模型区域平均：<b>${per(a)}</b>。`)} ${agree ? t('They agree on the direction.', '两者方向一致。') : `<b>${t('They disagree.', '两者方向相反。')}</b> ${t('The model and the thermometer tell different stories here, so this answer should not be trusted on its own. A station sits at one point in the city; the model averages a 110 km region and can miss local effects. Finding out why is the next piece of detective work.', '模型和温度计在这里讲的是两个故事，所以不能单凭本页答案下结论。气象站只代表城里的一个点；模型是 110 公里范围的平均，可能漏掉本地因素。弄清为什么，就是下一步的侦探工作。')}`}</p>`;
  }
  return `${state.variable === 'AOD' ? modelHaze(a) : ''}<p>${t(`Same question, different dataset — ${c.label()} (${b.test.firstYear}–${b.test.lastYear}${b.season ? ', ' + seasonLabel(b.season) : ''}) looks <b>${dir(b)}</b>; this answer looks <b>${dir(a)}</b>.`, `换一套数据问同一个问题：${c.label()}（${b.test.firstYear}–${b.test.lastYear}${b.season ? '，' + seasonLabel(b.season) : ''}）看起来<b>${dir(b)}</b>；本页答案看起来<b>${dir(a)}</b>。`)} ${agree ? t('They agree on the direction.', '两者方向一致。') : t('They disagree, so be extra careful.', '两者方向不一致，结论要更谨慎。')}</p>`;
}
function renderClues() {
  const box = $('clues');
  if (!state.site || !result()?.test || $('after')?.hidden !== false) { $('step5').hidden = true; return; }
  $('step5').hidden = false;
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
    <tr><th>${t('Plant greenness', '植被绿度')}</th><td>MODIS MOD13A3 v6.1<br><a href="https://doi.org/10.5067/MODIS/MOD13A3.061" target="_blank" rel="noopener">doi:10.5067/MODIS/MOD13A3.061</a></td><td>2000–2025</td><td>—</td><td>${t('Requested from NASA AppEEARS; coming soon', '已向 NASA AppEEARS 申请，即将加入')}</td></tr></tbody></table></div>
    <p class="cap">${t('Region = 1° × 1° box around each city (Giovanni area average). A year counts only if all its months have data; gaps are never filled. Satellite haze gaps come from dark winters and cloudy seasons.', '区域 = 每个城市周围 1°×1° 的方框（Giovanni 区域平均）。一年里所有月份都有数据才算一年；不补值。卫星雾霾的缺测来自冬季昏暗和多云季节。')}</p>`;
}

// ---------- interaction ----------
function renderFlow() { renderCases(); renderGuide(); renderMap(); renderVars(); renderAnswer(); }
function renderHero() {
  const svg = $('caseWall');
  svg.innerHTML = `<title id="cwTitle">${esc(t(...STATIC.cwTitle))}</title>` + caseWallSvg(state.data, state.results.T2M);
  animateCaseWall(svg);
  const wrap = $('caseWallWrap');
  if (wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
}
function renderAll() { renderStatic(); renderHero(); renderFlow(); renderCatalog(); }
function pick({ site, variable, caseId = null, guess = null, scroll = true }) {
  if (site) state.site = site;
  if (variable) state.variable = variable;
  state.caseId = caseId; state.guess = guess;
  renderFlow();
  if (scroll) $('step4').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.addEventListener('click', e => {
  if (e.target.closest('.term')) return;
  if (e.target.closest('#replayBtn')) { runReplay(); return; }
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
  if (d.site) { pick({ site: d.site, guess: d.keep ? 'skip' : null, scroll: !d.keep }); return; }
  if (d.var) pick({ variable: d.var, scroll: false });
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-site]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
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

// ---------- 30-second guided example (7 steps x 4.3 s) ----------
const TOUR = [
  { el: 'step1', text: () => t('A detective starts with a question. Today’s case: is New Delhi warming or cooling?', '侦探从一个问题开始。今天的案子：新德里在变暖，还是在变冷？') },
  { el: 'step2', text: () => t('Each dot is a city, coloured by its temperature trend from NASA’s MERRA-2 model.', '地图上每个点是一个城市，颜色是 NASA MERRA-2 模型算出的气温趋势。'), act: () => pick({ site: 'delhi', variable: 'T2M', caseId: 'delhi', scroll: false }) },
  { el: 'step3', text: () => t('Every variable comes with a plain definition and says whether it comes from a satellite or a model.', '每个变量都有大白话解释，并标明来自卫星还是模型。') },
  { el: 'step4', text: () => t('Guess first! Most places are warming, so we guess “got warmer”… and replay 35 years.', '先猜！大多数地方在变暖，我们猜"变暖了"……然后回放 35 年。'), act: () => { state.guess = 'up'; renderAnswer(); } },
  { el: 'step4', text: () => t('Twist: the model says cooling, but the city’s thermometer says warming. Two sources, two answers.', '反转：模型说在降温，城里的温度计却说在升温。两套数据，两个答案。'), act: () => document.querySelector('#answer .big')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), noScroll: true },
  { el: 'step5', text: () => t('So we follow the leads: sunlight, haze and soil moisture around the city.', '于是跟着线索查：城市周围的阳光、雾霾和土壤湿度。') },
  { el: 'step5', text: () => t('Lead 1: less sunlight is reaching the ground — a significant drop. The case stays open.', '线索 1：照到地面的阳光在显著减少。案子还没结。'), act: () => document.querySelector('#clues .recs')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), noScroll: true },
];
function stopTour() { clearTimeout(state.tour); state.tour = null; $('tourBar').hidden = true; document.querySelectorAll('.hl').forEach(x => x.classList.remove('hl')); }
function tourStep(i) {
  document.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  if (i >= TOUR.length) { stopTour(); return; }
  const s = TOUR[i];
  s.act?.();
  const el = $(s.el); el.classList.add('hl');
  if (!s.noScroll) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('tourText').textContent = s.text();
  state.tour = setTimeout(() => tourStep(i + 1), 4300);
}
$('openCase').addEventListener('click', () => $('step1').scrollIntoView({ behavior: 'smooth', block: 'start' }));
$('tourBtn').addEventListener('click', () => { stopTour(); $('tourBar').hidden = false; state.tour = -1; tourStep(0); });
$('tourStop').addEventListener('click', stopTour);

// ---------- start ----------
let saved = null;
try { saved = localStorage.getItem('td-lang'); } catch { /* storage unavailable */ }
setLang(new URLSearchParams(location.search).get('lang') ?? saved ?? 'en');
renderStatic();
await Promise.all([load(), loadLand()]);
renderAll();
