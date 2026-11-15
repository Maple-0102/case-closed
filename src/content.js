// Cases, guiding questions, clues and glossary.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
import { t } from './i18n.js?v=20261116l';

export const SITE_NAMES = {
  singapore: ['Singapore', '新加坡'], delhi: ['New Delhi', '新德里'], cairo: ['Cairo', '开罗'],
  london: ['London', '伦敦'], moscow: ['Moscow', '莫斯科'], nuuk: ['Nuuk (Greenland)', '努克（格陵兰）'],
  manaus: ['Manaus (Amazon)', '马瑙斯（亚马孙）'], sydney: ['Sydney', '悉尼'],
};
export const siteName = id => t(...SITE_NAMES[id]);
export const shortSite = id => siteName(id).replace(/\s*[（(].*$/, '');

// Each case is a question the data can answer. expect = what most people would guess.
// brief = the case brief read before guessing; note = the detective's note after the answer
// (what the case teaches about evidence; never a claim about causes).
export const CASES = [
  { id: 'sg', site: 'singapore', variable: 'T2M', expect: 'up',
    title: () => t('Has Singapore got warmer?', '新加坡变热了吗？'),
    sub: () => t('Start at home: an equatorial city that is hot all year.', '从身边开始：赤道城市，常年炎热。'),
    brief: () => t('Singapore sits almost on the equator and is hot all year round. Has it still warmed since 1991, and by how much?', '新加坡几乎就在赤道上，一年到头都热。从 1991 年到现在，它还在变暖吗？变了多少？'),
    note: () => t('A case you can trust: the city’s own weather station at Changi says almost exactly the same as NASA’s model (+0.26 vs +0.24 °C per decade over the same years). Two independent sources agreeing is what makes evidence solid.', '这是一个可以放心的案子：樟宜的气象站和 NASA 模型几乎完全一致（同样年份里每十年 +0.26 对 +0.24 °C）。两套独立的数据说法一致，证据才站得住。') },
  { id: 'moscowfast', site: 'moscow', variable: 'T2M', expect: 'up',
    title: () => t('Is Moscow warming about twice as fast as the planet?', '莫斯科升温速度大约是全球的两倍吗？'),
    sub: () => t('The whole Earth warmed about 0.24 °C per decade. Does one city keep pace?', '整个地球每十年升温约 0.24 °C。一座城市会跟得上吗？'),
    brief: () => t('Since 1991 the whole planet has warmed by about +0.24 °C per decade (NASA GISTEMP). Is Moscow keeping pace with the world, falling behind, or racing ahead?', '从 1991 年起，整个地球每十年升温约 +0.24 °C（NASA GISTEMP）。莫斯科是和全球同步、落在后面，还是遥遥领先？'),
    note: () => t('Moscow’s warming trend is supported: about +0.52 °C per decade since 1991. Its estimated rate is about 2.1 times the global estimate for the same years; that ratio describes the two estimates and was not itself tested. A global average is real, but it hides big differences from place to place.', '莫斯科的升温趋势有证据支持：1991 年以来每十年约 +0.52 °C。它的估计速度大约是同期全球估计值的 2.1 倍；这个倍数只是两个估计值的比较，本身没有做过检验。全球平均是真的，但它把各地的巨大差异都平均掉了。') },
  { id: 'nuukwarm', site: 'nuuk', variable: 'T2M', expect: 'up',
    title: () => t('Greenland: famous for melting, but is Nuuk’s air proven to be warming?', '格陵兰以融冰闻名，努克的空气真的被证实在变暖吗？'),
    sub: () => t('Being famous is not the same as being proven.', '出名，不等于被证实。'),
    brief: () => t('Greenland is a symbol of climate change. Here we ask a narrower question: has the air around Nuuk warmed in a way that 35 years of data can prove?', '格陵兰是气候变化的标志。这里我们问一个更窄的问题：努克周围的空气变暖了吗？35 年的数据能证明吗？'),
    note: () => t('It looks like warming (+0.27 °C per decade), but Nuuk’s years swing so much that this record alone can’t prove it. Headlines can be right about a region and still not settle every question about one place: check the data before the headline.', '数据看起来在变暖（每十年 +0.27 °C），但努克年份之间起伏太大，单靠这段记录证明不了。新闻对一个地区的说法可能是对的，却回答不了某个具体地方的每个问题：先看数据，再看标题。') },
  { id: 'delhi', site: 'delhi', variable: 'T2M', expect: 'up', mystery: true,
    title: () => t('Mystery: is New Delhi warming or cooling?', '悬案：新德里在变暖，还是在变冷？'),
    sub: () => t('Two data sources give two different answers. Make your guess, then follow the clues.', '两套数据，两个不同的答案。先猜，再跟着线索查。'),
    brief: () => t('NASA’s model and the city’s own thermometer have both watched New Delhi for more than 30 years. Make your guess, then see whether they agree.', 'NASA 的模型和城里的温度计都盯着新德里看了 30 多年。先猜一猜，再看它们说法是否一致。'),
    note: () => t('When two good sources disagree, the honest answer is “we don’t know yet”. A detective follows the leads (sunlight, haze, soil moisture) instead of picking the source that fits their guess.', '两套可靠的数据意见相反时，诚实的答案是"我们还不知道"。侦探会跟着线索（阳光、雾霾、土壤湿度）查下去，而不是挑一个符合自己猜测的数据。') },
  { id: 'manaus', site: 'manaus', variable: 'T2M', expect: 'up',
    title: () => t('Can we be sure the Amazon is heating up?', '能确定亚马孙在变热吗？'),
    sub: () => t('Sometimes the honest answer is “not sure yet”.', '有时候诚实的答案是"还说不准"。'),
    brief: () => t('The Amazon rainforest is often in the climate news. Does 35 years of data prove that the air around Manaus has warmed?', '亚马孙雨林常常出现在气候新闻里。35 年的数据能证明马瑙斯周围的空气变暖了吗？'),
    note: () => t('The numbers lean warm (+0.29 °C per decade), but the years swing too much to be sure. “Not proven” is a real finding, not a failure: more years or another dataset could settle it.', '数字偏向变暖（每十年 +0.29 °C），但年份间起伏太大，还不能确定。"证据不足"是真正的发现，不是失败：更多年份或另一套数据也许就能下结论。') },
  { id: 'delhisun', site: 'delhi', variable: 'SUN', expect: 'down',
    title: () => t('Is less sunlight reaching the ground in New Delhi?', '新德里照到地面的阳光变少了吗？'),
    sub: () => t('A clue in the New Delhi mystery: haze and clouds can block the Sun.', '新德里悬案的一条线索：雾霾和云会挡住太阳。'),
    brief: () => t('Haze and clouds can dim the Sun. Over New Delhi, does less sunlight reach the ground today than in 1991?', '雾霾和云会让阳光变暗。在新德里，如今照到地面的阳光比 1991 年少了吗？'),
    note: () => t('This one holds up: about −5.4 W/m² per decade, the strongest sunlight trend among our eight cities. What is dimming it is a separate question; this tool shows what changed, not why.', '这个结论站得住：每十年约 −5.4 W/m²，是 8 个城市里最强的阳光趋势。是什么让阳光变暗，是另一个问题；这个工具只回答变了什么，不回答为什么。') },
  { id: 'london', site: 'london', variable: 'SUN', expect: 'down',
    title: () => t('Foggy London: is less sunlight reaching the ground?', '"雾都"伦敦，照到地面的阳光变少了吗？'),
    sub: () => t('New Delhi is getting less sunlight. What about London?', '新德里的阳光在变少。伦敦呢？'),
    brief: () => t('London was once famous for its smog. New Delhi’s sunlight is falling; is London’s going the same way?', '伦敦曾经以烟雾闻名。新德里的阳光在变少，伦敦也一样吗？'),
    note: () => t('Opposite directions in two cities: London now gets more sunlight (about +1.9 W/m² per decade) while New Delhi gets less. The same variable can tell different stories in different places, so never generalise from one city.', '两座城市方向相反：伦敦的阳光在变多（每十年约 +1.9 W/m²），新德里却在变少。同一个变量在不同地方会讲出不同的故事，所以不能拿一座城市以偏概全。') },
  { id: 'cairohaze', site: 'cairo', variable: 'AOD', expect: 'down',
    title: () => t('Is the haze over Cairo thinning?', '开罗上空的雾霾在变薄吗？'),
    sub: () => t('A satellite measures haze in the whole column of air, not street-level air quality. Then try the slider.', '卫星测的是整层大气里的雾霾，不是街上的空气质量。看完再试试滑块。'),
    brief: () => t('A NASA satellite has measured the haze over Cairo since 2001: how much the dust, smoke and pollution in the whole column of air dim the sunlight. That is not the same as the air you breathe at street level. Is the haze thinning? After the answer, try the slider.', 'NASA 卫星从 2001 年起一直在测开罗上空的雾霾：整层大气里的灰尘、烟和污染颗粒让阳光变暗了多少。这和街上呼吸的空气不是一回事。雾霾在变薄吗？看完答案，再试试滑块。'),
    note: () => t('Over all the years (2001–2025): not proven. From 2009 the decline is supported. Both are true. The mistake is quoting the 2009–2025 result as if it covered every year since 2001: a fair claim keeps its years.', '看全部年份（2001–2025）：证据不足。从 2009 年起算，下降有证据支持。两者都对。错误在于把 2009–2025 年的结果说成 2001 年以来一直如此：公平的说法要讲清楚是哪几年。') },
  { id: 'moscowhaze', site: 'moscow', variable: 'AOD', expect: 'down',
    title: () => t('Two satellites: is the haze over Moscow thinning?', '两颗卫星：莫斯科上空的雾霾在变薄吗？'),
    sub: () => t('Same sensor, same city, two satellites. Do they agree?', '同样的仪器，同一座城市，两颗卫星。它们一致吗？'),
    brief: () => t('NASA flies the same haze sensor on two satellites: Terra crosses in the morning, Aqua in the afternoon. Is Moscow’s haze falling? After the answer, compare the two in Clue 3.', 'NASA 把同一种测雾霾的仪器装在两颗卫星上：Terra 上午经过，Aqua 下午经过。莫斯科的雾霾在减少吗？看完答案，到线索 3 比一比两颗卫星。'),
    note: () => t('Both satellites’ estimates point down, but only Aqua’s decline reaches this tool’s threshold for support; Terra’s does not (in the months the satellites can see). Same instrument, same city, different confidence: that is why detectives cross-check.', '两颗卫星的估计值都往下，但只有 Aqua 的下降达到了本工具的统计支持阈值，Terra 的没有（在卫星看得清的月份里）。同样的仪器、同一座城市，把握程度却不同：这就是侦探要交叉核对的原因。') },
  { id: 'cairo', site: 'cairo', variable: 'PRECIP', expect: 'down',
    title: () => t('Is desert Cairo getting less rain?', '沙漠里的开罗，雨变少了吗？'),
    sub: () => t('Only a few tens of millimetres a year. Can it get any less?', '一年只下几十毫米雨。还能更少吗？'),
    brief: () => t('Cairo gets only a few tens of millimetres of rain a year. Is that tiny amount shrinking?', '开罗一年只下几十毫米雨。这么少的雨还在变少吗？'),
    note: () => t('With so little rain, a single wet year changes the total a lot, and that noise hides any trend. Not proven, and the numbers even lean the other way.', '雨这么少，只要有一年多下点雨，全年总量就会变很多，这种起伏把趋势都盖住了。证据不足，而且数字甚至偏向另一个方向。') },
  { id: 'londonrain', site: 'london', variable: 'PRECIP', expect: 'up',
    title: () => t('Rainy London: is it getting wetter?', '多雨的伦敦，雨变多了吗？'),
    sub: () => t('A city famous for rain. Has the yearly total changed?', '一座以下雨出名的城市。全年雨量变了吗？'),
    brief: () => t('London has a reputation for rain. Has its yearly rainfall changed since 1991?', '伦敦以多雨著称。从 1991 年起，它的全年降雨量变了吗？'),
    note: () => t('London’s rain has hardly moved (about +1 mm per decade, nowhere near proof), and none of our eight cities shows a rain trend we can trust, whether we ask the model or the satellite. Rain is simply very noisy from year to year.', '伦敦的降雨几乎没变（每十年约 +1 毫米，远远谈不上证据）；而且不管看模型还是卫星，8 个城市没有一个的降雨趋势站得住。降雨本来就年年起伏很大。') },
  { id: 'nuukgreen', site: 'nuuk', variable: 'NDVI', expect: 'up',
    title: () => t('Are Nuuk’s summers getting greener?', '努克的夏天在变绿吗？'),
    sub: () => t('Satellite views of the land around Nuuk, Greenland, in July–September.', '卫星看到的格陵兰努克周边陆地，只看 7–9 月。'),
    brief: () => t('Greenland’s ice is melting, so you might expect plants to spread. A NASA satellite has watched Nuuk’s summers since 2000.', '格陵兰的冰在融化，你可能会以为植物在扩张。NASA 卫星从 2000 年起一直在看努克的夏天。'),
    note: () => t('No proven greening here: summer greenness has barely moved (about −0.003 per decade). An expectation is a hypothesis, not evidence; test it against the data.', '这里没有被证实的变绿：夏季绿度几乎没动（每十年约 −0.003）。预期只是假设，不是证据；要拿数据来检验。') },
];

export const TOPICS = [
  { id: 'heat', icon: '🌡️', name: () => t('Heat', '热') },
  { id: 'water', icon: '💧', name: () => t('Water', '水') },
  { id: 'air', icon: '🌫️', name: () => t('Air', '空气') },
  { id: 'plant', icon: '🌱', name: () => t('Plants', '植物') },
];
export const PLACE_TYPES = [
  { id: 'city', name: () => t('Big city', '大城市'), sites: ['delhi', 'london', 'moscow'] },
  { id: 'desert', name: () => t('Desert', '沙漠'), sites: ['cairo'] },
  { id: 'forest', name: () => t('Rainforest', '雨林'), sites: ['manaus'] },
  { id: 'polar', name: () => t('Polar', '极地'), sites: ['nuuk'] },
  { id: 'coast', name: () => t('Coast', '海边'), sites: ['singapore', 'sydney'] },
];

// Clue 2: other variables worth checking at the same place, with the reason to look.
export const CLUES = {
  delhi: [
    ['SUN', () => t('Lead 1: in the model, is less sunlight reaching the ground? Less sun means a cooler surface.', '线索 1：模型里，照到地面的阳光变少了吗？阳光少，地面就凉。')],
    ['AOD', () => t('Lead 2: haze blocks sunlight. Do satellites see more haze over the region?', '线索 2：雾霾会挡住阳光。卫星看到这片区域的雾霾变多了吗？')],
    ['SOIL', () => t('Lead 3: the model’s 110 km region takes in large areas of irrigated farmland, which stays wet and cool; the station sits in the growing city. Is the soil getting wetter?', '线索 3：模型的 110 公里区域里有大片灌溉农田，又湿又凉；气象站却在不断扩张的城市里。土壤在变湿吗？')],
  ],
  london: [
    ['AOD', () => t('Cleaner air lets more sunlight through. Is haze decreasing?', '空气变干净，阳光就能更多地照下来。雾霾在变少吗？')],
    ['T2M', () => t('With more sunlight, is it also getting warmer?', '阳光多了，气温也在升吗？')],
    ['PRECIP', () => t('Clouds and rain block sunlight too. Is there less rain?', '云和雨也会挡阳光。雨变少了吗？')],
  ],
  manaus: [
    ['PRECIP', () => t('Is the rainforest getting drier?', '雨林在变干吗？')],
    ['SOIL', () => t('Is the soil as wet as before?', '土壤还一样湿吗？')],
    ['NDVI', () => t('Is the forest as green as before?', '森林还一样绿吗？')],
  ],
  cairo: [
    ['T2M', () => t('Is the desert getting hotter?', '沙漠在变得更热吗？')],
    ['SOIL', () => t('Is the soil getting drier?', '土壤在变干吗？')],
    ['NDVI', () => t('Are farms along the Nile getting greener?', '尼罗河两岸的农田更绿了吗？')],
  ],
};
export const DEFAULT_CLUES = [
  ['T2M', () => t('Is the temperature changing?', '气温在变吗？')],
  ['PRECIP', () => t('Has rain changed too?', '降水也在变吗？')],
  ['SUN', () => t('Has the sunlight reaching the ground changed?', '照到地面的阳光变了吗？')],
];

export const GLOSSARY = {
  trend: () => t('Trend: a change that keeps going the same way (up or down) over many years, not a one-off jump.', '趋势：很多年里一直朝同一个方向变（一直升或一直降），而不是某一年突然变。'),
  significant: () => t('Significant: a change this steady would be very unlikely if the years were just bouncing around at random. We check with the Mann-Kendall test.', '显著：如果只是年份之间随机起伏，很难碰巧出现这么稳定的变化。我们用 Mann-Kendall 检验来判断。'),
  decade: () => t('Per decade: how much it changes, on average, every 10 years.', '每十年：平均每过 10 年变化多少。'),
  range: () => t('Likely range (95%): allowing for year-to-year ups and downs, the true rate is very likely inside this range. If it crosses zero, even the direction is uncertain.', '很可能的范围（95%）：考虑到年份间的起伏，真实的变化速度很可能落在这个范围里。范围跨过 0，说明连方向都还不确定。'),
  unsure: () => t('Not sure yet: the years jump around too much to tell. That is not the same as “no change” — a longer record might settle it.', '还说不准：年份之间起伏太大，还判断不了。这不等于"没有变化"，更长的记录可能就能下结论。'),
  typical: () => t('Typical year: the value the trend line gives for that year, ignoring one-off high or low years.', '普通年份：按趋势线算出的那一年的典型值，去掉了偶然偏高或偏低的年份。'),
  model: () => t('Model data: a computer model (MERRA-2) combines many satellite and ground observations into gap-free values everywhere on Earth.', '模型数据：计算机模型（MERRA-2）把大量卫星和地面观测合在一起，算出全球每个地方没有空缺的数值。'),
  satellite: () => t('Satellite data: measured from space by instruments such as MODIS (haze) or the GPM satellites (rain).', '卫星数据：卫星上的仪器从太空测量，比如 MODIS 测雾霾、GPM 卫星测降水。'),
  ndvi: () => t('NDVI (vegetation index): how green the ground looks from space, from about 0 (bare ground, city, snow) to about 0.9 (thick forest). It comes from comparing red and near-infrared light.', 'NDVI（植被指数）：从太空看地面有多绿，从约 0（裸地、城市、雪）到约 0.9（茂密森林）。它是比较红光和近红外光算出来的。'),
  startYear: () => t('Start year: the first year you count from. The end stays the same. Choosing a convenient start year is a common way to make a trend look bigger, smaller or reversed.', '起始年份：从哪一年开始算。终点不变。挑一个"方便"的起始年份，是让趋势看起来更大、更小甚至反过来的常见手法。'),
  qvalue: () => t('q-value: like a p-value, but adjusted because we test eight cities at once. Test enough places and one will look significant by luck; the q-value guards against that. Below 0.05 = trend supported.', 'q 值：类似 p 值，但因为同时检验 8 个城市而做了校正。检验的地方一多，总有一个会碰巧看起来显著；q 值就是防这个的。低于 0.05 = 趋势有证据支持。'),
  region: () => t('Region: an area of about 1° × 1° (roughly 110 × 110 km) centred on the city, averaged together.', '区域：以城市为中心约 1°×1°（大约 110×110 公里）的范围，取整体平均。'),
};
