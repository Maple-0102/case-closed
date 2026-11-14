// Cases, guiding questions, clues and glossary.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
import { t } from './i18n.js';

export const SITE_NAMES = {
  singapore: ['Singapore', '新加坡'], delhi: ['New Delhi', '新德里'], cairo: ['Cairo', '开罗'],
  london: ['London', '伦敦'], moscow: ['Moscow', '莫斯科'], nuuk: ['Nuuk (Greenland)', '努克（格陵兰）'],
  manaus: ['Manaus (Amazon)', '马瑙斯（亚马孙）'], sydney: ['Sydney', '悉尼'],
};
export const siteName = id => t(...SITE_NAMES[id]);
export const shortSite = id => siteName(id).replace(/\s*[（(].*$/, '');

// Each case is a question the data can answer. expect = what most people would guess.
export const CASES = [
  { id: 'sg', site: 'singapore', variable: 'T2M', expect: 'up',
    title: () => t('Has Singapore got warmer?', '新加坡变热了吗？'),
    sub: () => t('Start at home: an equatorial city that is hot all year.', '从身边开始：赤道城市，常年炎热。') },
  { id: 'delhi', site: 'delhi', variable: 'T2M', expect: 'up', mystery: true,
    title: () => t('Mystery: is New Delhi warming or cooling?', '悬案：新德里在变暖，还是在变冷？'),
    sub: () => t('Two data sources give two different answers. Make your guess, then follow the clues.', '两套数据，两个不同的答案。先猜，再跟着线索查。') },
  { id: 'delhisun', site: 'delhi', variable: 'SUN', expect: 'down',
    title: () => t('Is less sunlight reaching the ground in New Delhi?', '新德里照到地面的阳光变少了吗？'),
    sub: () => t('A clue in the New Delhi mystery: haze and clouds can block the Sun.', '新德里悬案的一条线索：雾霾和云会挡住太阳。') },
  { id: 'london', site: 'london', variable: 'SUN', expect: 'down',
    title: () => t('Foggy London: is less sunlight reaching the ground?', '"雾都"伦敦，照到地面的阳光变少了吗？'),
    sub: () => t('New Delhi is getting less sunlight. What about London?', '新德里的阳光在变少。伦敦呢？') },
  { id: 'manaus', site: 'manaus', variable: 'T2M', expect: 'up',
    title: () => t('Can we be sure the Amazon is heating up?', '能确定亚马孙在变热吗？'),
    sub: () => t('Sometimes the honest answer is “not sure yet”.', '有时候诚实的答案是"还说不准"。') },
  { id: 'cairo', site: 'cairo', variable: 'PRECIP', expect: 'down',
    title: () => t('Is desert Cairo getting less rain?', '沙漠里的开罗，雨变少了吗？'),
    sub: () => t('Only a few tens of millimetres a year. Can it get any less?', '一年只下几十毫米雨。还能更少吗？') },
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
  region: () => t('Region: an area of about 1° × 1° (roughly 110 × 110 km) centred on the city, averaged together.', '区域：以城市为中心约 1°×1°（大约 110×110 公里）的范围，取整体平均。'),
};
