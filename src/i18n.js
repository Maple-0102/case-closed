// English / Chinese text helper. English is the default (submission language).
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.
let lang = 'en';
export const getLang = () => lang;
export const setLang = l => { lang = l === 'zh' ? 'zh' : 'en'; return lang; };
export const t = (en, zh) => (lang === 'zh' ? zh : en);

// Static page text, keyed by data-t attributes in index.html.
export const STATIC = {
  brand: ['Trend Detective', '趋势侦探'],
  heroTitle: ['TREND DETECTIVE', '趋势侦探'],
  cwTitle: ['Case wall: eight cities, each with 35 years of temperature stripes, pinned to one case file', '案件墙：8 个城市，每个城市 35 年的温度条纹，钉在同一份案卷上'],
  openCase: ['Open the case file', '打开案卷'],
  swipeHint: ['← Swipe to see every city →', '← 左右滑动查看所有城市 →'],
  heroLede: ['Is Earth changing? Where? By how much? Pick a case, write down your guess, then let 35 years of NASA satellite and model data testify — and check whether the change is real or just year-to-year noise. Tap any card to start with that city.',
    '地球在变吗？变在哪里？变了多少？选一个案子，写下你的推测，再让 NASA 卫星和模型的 35 年数据来作证，看看变化是真的，还是只是年份间的起伏。点任意一张卡片，就从那个城市开始调查。'],
  tourBtn: ['▶ Watch a 30-second example', '▶ 看 30 秒示范'],
  s1: ['Ask a question', '提一个问题'],
  s2: ['Choose a place', '选一个地点'],
  s2hint: ['Click a dot on the map, or a place name below.', '点地图上的圆点，或下面的地名。'],
  s3: ['Choose what to measure', '选一个要测量的东西'],
  s4: ['The answer', '答案'],
  s5: ['Follow the clues', '找线索'],
  s6: ['Close the case', '结案'],
  catalogTitle: ['Data sources: where every number comes from, and what is missing', '数据来源：每个数字从哪来、缺了什么'],
  stop: ['Stop', '停止'],
};
