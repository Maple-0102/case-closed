// English / Chinese text helper. English is the default (submission language).
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.
let lang = 'en';
export const getLang = () => lang;
export const setLang = l => { lang = l === 'zh' ? 'zh' : 'en'; return lang; };
export const t = (en, zh) => (lang === 'zh' ? zh : en);

// Static page text, keyed by data-t attributes in index.html.
export const STATIC = {
  brand: ['Trend Detective', '趋势侦探'],
  heroTitle: ['Is Earth changing? Where? By how much?', '地球在变吗？变在哪里？变了多少？'],
  heroLede: ['Be a data detective with NASA satellite and model data. Ask a question, guess the answer, then watch decades of data replay and see whether the change is real or just year-to-year noise.',
    '用 NASA 的卫星和模型数据当一回侦探：提一个问题，先猜答案，再看几十年的数据逐年回放，判断变化是真的，还是只是年份之间的起伏。'],
  tourBtn: ['▶ Watch a 30-second example', '▶ 看一个 30 秒的例子'],
  s1: ['Ask a question', '提一个问题'],
  s2: ['Choose a place', '选一个地点'],
  s2hint: ['Click a dot on the map, or a place name below.', '点地图上的圆点，或下面的地名。'],
  s3: ['Choose what to measure', '选一个要测量的东西'],
  s4: ['The answer', '答案'],
  s5: ['Follow the clues', '找线索'],
  catalogTitle: ['Data sources: where every number comes from, and what is missing', '数据来源：每个数字从哪来、缺了什么'],
  stop: ['Stop', '停止'],
};
