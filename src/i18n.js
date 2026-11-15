// English / Chinese text helper. English is the default (submission language).
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
let lang = 'en';
export const getLang = () => lang;
export const setLang = l => { lang = l === 'zh' ? 'zh' : 'en'; return lang; };
export const t = (en, zh) => (lang === 'zh' ? zh : en);

// Static page text, keyed by data-t attributes in index.html.
export const STATIC = {
  brand: ['Case Closed?', '结案了吗？'],
  heroTitle: ['CASE CLOSED?', '结案了吗？'],
  heroTag: ['Investigate Earth’s changes. Decide what the evidence supports.', '调查地球的变化，判断证据到底支持什么。'],
  cwTitle: ['Case wall: eight cities, each with 35 years of temperature stripes, pinned to one case file', '案件墙：8 个城市，每个城市 35 年的温度条纹，钉在同一份案卷上'],
  openCase: ['Open a case file', '打开一个案卷'],
  openCaseSub: ['12 cases, each ending in a final check', '12 个案子，每个最后都有一关'],
  buildBtn: ['Build your own case', '自己组一个案子'],
  buildBtnSub: ['Answer two quick questions', '回答两个小问题'],
  mapBtn: ['Pick a city on the map', '在地图上选城市'],
  mapBtnSub: ['8 cities · 7 things to measure', '8 座城市 · 7 种测量'],
  swipeHint: ['← Swipe to see every city →', '← 左右滑动查看所有城市 →'],
  heroLede: ['You are the trend detective. Is Earth changing? Where? By how much? Pick a case, write down your guess, let NASA satellite and model data testify, and check whether the change is real or just year-to-year noise. Then decide: would you sign a claim about it? Tap any card to start with that city.',
    '你就是趋势侦探。地球在变吗？变在哪里？变了多少？选一个案子，写下你的推测，再让 NASA 卫星和模型数据来作证，看看变化是真的，还是只是年份间的起伏。最后判断：一句关于它的说法，你敢不敢签字？点任意一张卡片，就从那个城市开始调查。'],
  tourBtn: ['Watch a 30-second example', '看 30 秒示范'],
  tourBtnSub: ['30-second guided tour of two cases', '30 秒带你走一遍两个案子'],
  s1: ['Ask a question', '提一个问题'],
  s2: ['Choose a place and what to measure', '选地点，再选要测量什么'],
  s2a: ['Where?', '在哪里？'],
  s2hint: ['👆 Click a dot on the map or a place name.', '👆 点地图上的圆点或地名。'],
  s1hint: ['👆 Click a case file to open it, or build your own case in the dashed card.', '👆 点一个案卷就能打开；或者在虚线卡片里自己组一个案子。'],
  s4hint: ['👆 Words marked ⓘ explain themselves: hover over them or tap them.', '👆 带 ⓘ 的词会自己解释：把鼠标放上去，或点一下。'],
  s5hint: ['👆 Click any lead to investigate it next.', '👆 点任意一条线索，接着往下查。'],
  s3: ['What to measure?', '测量什么？'],
  s4: ['The answer', '答案'],
  s5: ['Follow the clues', '找线索'],
  s6: ['Close the case', '结案'],
  catalogTitle: ['Data sources: where every number comes from, and what is missing', '数据来源：每个数字从哪来、缺了什么'],
  stop: ['Stop', '停止'],
};
