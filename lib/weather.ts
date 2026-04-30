/**
 * WMO weather code → emoji + 中文標籤
 * 對照表：https://open-meteo.com/en/docs (Weather variable documentation)
 */

export interface WeatherInfo {
  code: number
  emoji: string
  label: string
}

const TABLE: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '☀️', label: '晴' },
  1: { emoji: '🌤️', label: '大致晴朗' },
  2: { emoji: '⛅', label: '局部多雲' },
  3: { emoji: '☁️', label: '陰' },
  45: { emoji: '🌫️', label: '霧' },
  48: { emoji: '🌫️', label: '霧凇' },
  51: { emoji: '🌦️', label: '毛毛雨' },
  53: { emoji: '🌦️', label: '毛毛雨' },
  55: { emoji: '🌧️', label: '毛毛雨' },
  56: { emoji: '🌧️', label: '凍毛毛雨' },
  57: { emoji: '🌧️', label: '凍毛毛雨' },
  61: { emoji: '🌧️', label: '小雨' },
  63: { emoji: '🌧️', label: '雨' },
  65: { emoji: '🌧️', label: '大雨' },
  66: { emoji: '🌧️', label: '凍雨' },
  67: { emoji: '🌧️', label: '凍雨' },
  71: { emoji: '🌨️', label: '小雪' },
  73: { emoji: '🌨️', label: '雪' },
  75: { emoji: '❄️', label: '大雪' },
  77: { emoji: '🌨️', label: '雪粒' },
  80: { emoji: '🌦️', label: '陣雨' },
  81: { emoji: '🌧️', label: '陣雨' },
  82: { emoji: '⛈️', label: '強陣雨' },
  85: { emoji: '🌨️', label: '陣雪' },
  86: { emoji: '❄️', label: '強陣雪' },
  95: { emoji: '⛈️', label: '雷雨' },
  96: { emoji: '⛈️', label: '雷雨夾冰雹' },
  99: { emoji: '⛈️', label: '雷雨夾冰雹' },
}

export function describeWeather(code: number): WeatherInfo {
  const hit = TABLE[code]
  return {
    code,
    emoji: hit?.emoji ?? '🌡️',
    label: hit?.label ?? '不明',
  }
}

/** 預設手動選單（picker 上的快捷選項） */
export const PRESET_WEATHER: WeatherInfo[] = [
  describeWeather(0),
  describeWeather(2),
  describeWeather(3),
  describeWeather(45),
  describeWeather(63),
  describeWeather(95),
  describeWeather(73),
]

/** 「☀️ 晴 23°C」這種 display 字串 */
export function formatWeather(info: WeatherInfo, tempC?: number | null): string {
  if (tempC == null || !Number.isFinite(tempC)) {
    return `${info.emoji} ${info.label}`
  }
  return `${info.emoji} ${info.label} ${Math.round(tempC)}°C`
}
