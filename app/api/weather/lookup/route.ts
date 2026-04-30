import { NextResponse } from 'next/server'
import { describeWeather, formatWeather } from '@/lib/weather'

/**
 * GET /api/weather/lookup?lat=...&lng=...
 * 透過 Open-Meteo（免費、無 key）取當下天氣，回 emoji + 中文 + 溫度。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'invalid lat/lng' }, { status: 400 })
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'lat/lng out of range' }, { status: 400 })
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lng))
  url.searchParams.set('current', 'temperature_2m,weather_code')
  url.searchParams.set('timezone', 'auto')

  let res: Response
  try {
    res = await fetch(url.toString(), { cache: 'no-store' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `open-meteo returned ${res.status}` },
      { status: 502 },
    )
  }

  const json = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number }
  }
  const code = json.current?.weather_code ?? -1
  const tempC = json.current?.temperature_2m ?? null
  const info = describeWeather(code)
  return NextResponse.json({
    code: info.code,
    emoji: info.emoji,
    label: info.label,
    temp_c: tempC,
    formatted: formatWeather(info, tempC),
  })
}
