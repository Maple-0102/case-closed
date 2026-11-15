// Variables shown in the tool: plain-language names, definitions, units and how a year is summarised.
// Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.
import { t } from './i18n.js?v=20261116x';

// annual: 'mean' or 'total' (mean daily rate x days in year). scale converts units for display.
// dp: decimals shown. kind: 'model' | 'satellite'. seasonal: may fall back to observable months.
export const VARIABLES = [
  { id: 'T2M', topic: 'heat', icon: '🌡️', kind: 'model', product: 'MERRA-2', unit: '°C', dp: 2, annual: 'mean',
    name: () => t('Air temperature', '气温'), short: () => t('air temperature', '气温'),
    def: () => t('How warm the air is about 2 m above the ground.', '离地约 2 米处空气有多热。'),
    up: () => t('Got warmer', '变暖了'), down: () => t('Got cooler', '变冷了'),
    goingUp: () => t('it’s warming', '在变暖'), goingDown: () => t('it’s cooling', '在降温') },
  { id: 'PRECIP', topic: 'water', icon: '🌧️', kind: 'model', product: 'MERRA-2', unit: 'mm', dp: 0, annual: 'total',
    name: () => t('Rain & snow', '降水'), short: () => t('rain and snow', '降水'),
    def: () => t('How much rain and snow falls in a year, as a depth of water — like a rain gauge.', '一年下了多少雨雪，用水深（毫米）表示，就像雨量筒。'),
    up: () => t('More rain', '雨变多了'), down: () => t('Less rain', '雨变少了'),
    goingUp: () => t('rain is increasing', '雨在变多'), goingDown: () => t('rain is decreasing', '雨在变少') },
  { id: 'IMERG', topic: 'water', icon: '🛰️', kind: 'satellite', product: 'GPM IMERG', unit: 'mm', dp: 0, annual: 'total',
    name: () => t('Rain (satellite)', '卫星降水'), short: () => t('satellite rainfall', '卫星降水'),
    def: () => t('Rain measured from space by the GPM satellites, calibrated with rain gauges.', 'GPM 卫星从太空测的降水，并用地面雨量计校准过。'),
    up: () => t('More rain', '雨变多了'), down: () => t('Less rain', '雨变少了'),
    goingUp: () => t('rain is increasing', '雨在变多'), goingDown: () => t('rain is decreasing', '雨在变少') },
  { id: 'SOIL', topic: 'water', icon: '🟫', kind: 'model', product: 'MERRA-2', unit: '%', dp: 1, annual: 'mean', scale: 100, notFor: ['nuuk'],
    name: () => t('Soil moisture', '土壤湿度'), short: () => t('soil moisture', '土壤湿度'),
    def: () => t('How wet the soil is where plant roots live: 0% = bone dry, 100% = soaked.', '植物根系那层土有多湿：0% 干透，100% 湿透。'),
    up: () => t('Soil got wetter', '土变湿了'), down: () => t('Soil got drier', '土变干了'),
    goingUp: () => t('the soil is getting wetter', '土壤在变湿'), goingDown: () => t('the soil is getting drier', '土壤在变干') },
  { id: 'SUN', topic: 'air', icon: '☀️', kind: 'model', product: 'MERRA-2', unit: 'W/m²', dp: 1, annual: 'mean',
    name: () => t('Sunlight at the ground', '照到地面的阳光'), short: () => t('sunlight at the ground', '照到地面的阳光'),
    def: () => t('How much of the Sun’s energy gets through clouds and haze to the ground.', '太阳的能量穿过云和雾霾后，真正照到地面的有多少。'),
    up: () => t('More sunlight', '阳光变多了'), down: () => t('Less sunlight', '阳光变少了'),
    goingUp: () => t('more sunlight is reaching the ground', '照到地面的阳光在变多'), goingDown: () => t('less sunlight is reaching the ground', '照到地面的阳光在变少') },
  { id: 'AOD', topic: 'air', icon: '🌫️', kind: 'satellite', product: 'MODIS Terra', unit: 'AOD', dp: 3, annual: 'mean', seasonal: true,
    name: () => t('Haze (aerosols)', '雾霾（气溶胶）'), short: () => t('haze', '雾霾'),
    def: () => t('How much dust, smoke and pollution is in the air, measured by how much sunlight it blocks (0.1 clear, above 1 very hazy).', '空气里的灰尘、烟和污染颗粒有多少，用它们挡住多少阳光来衡量（0.1 清澈，1 以上很浑浊）。'),
    up: () => t('More haze', '雾霾变多了'), down: () => t('Less haze', '雾霾变少了'),
    goingUp: () => t('haze is increasing', '雾霾在变多'), goingDown: () => t('haze is decreasing', '雾霾在变少') },
  { id: 'NDVI', topic: 'plant', icon: '🌱', kind: 'satellite', product: 'MODIS Terra', unit: 'NDVI', dp: 3, annual: 'mean', seasonal: true,
    name: () => t('Plant greenness', '植被绿度'), short: () => t('plant greenness', '植被绿度'),
    def: () => t('How green the ground looks from space (NDVI): about 0.1 for bare ground or city, 0.8 for thick forest. Cloudy or snowy months are left out.', '从太空看地面有多绿（NDVI）：裸地或城市约 0.1，茂密森林约 0.8。多云或积雪的月份不计入。'),
    up: () => t('Got greener', '变绿了'), down: () => t('Got less green', '变黄了'),
    goingUp: () => t('it’s getting greener', '在变绿'), goingDown: () => t('it’s getting less green', '绿色在减少') },
];

// Second datasets used only to cross-check a main variable (clue 3).
export const CHECKS = {
  T2M: { id: 'T2M_STATION', label: () => t('the city’s weather station (NOAA GHCN-Monthly)', '城里的气象站（NOAA GHCN-Monthly）'), annual: 'mean', station: true },
  PRECIP: { id: 'IMERG', label: () => t('GPM satellite rain', 'GPM 卫星降水'), annual: 'total' },
  IMERG: { id: 'PRECIP', label: () => t('MERRA-2 model rain', 'MERRA-2 模型降水'), annual: 'total' },
  AOD: { id: 'AOD_AQUA', label: () => t('MODIS on the Aqua satellite', 'Aqua 卫星上的 MODIS'), annual: 'mean', seasonal: true },
};

export const VAR = id => VARIABLES.find(v => v.id === id);
