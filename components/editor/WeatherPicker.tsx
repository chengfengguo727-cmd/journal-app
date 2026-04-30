'use client'

import { useState } from 'react'
import { Loader2, MapPin, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PRESET_WEATHER } from '@/lib/weather'

interface Props {
  value: string | null
  onChange: (value: string | null) => void
}

export function WeatherPicker({ value, onChange }: Props) {
  const [loading, setLoading] = useState(false)

  async function autoDetect() {
    if (!('geolocation' in navigator)) {
      toast.error('瀏覽器不支援定位')
      return
    }
    setLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 5 * 60 * 1000,
        })
      })
      const { latitude, longitude } = pos.coords
      const res = await fetch(
        `/api/weather/lookup?lat=${latitude}&lng=${longitude}`,
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || '抓天氣失敗')
      }
      onChange(body.formatted as string)
      toast.success(`已記錄 ${body.formatted}`)
    } catch (err) {
      const msg =
        err instanceof GeolocationPositionError
          ? geoErrorMsg(err)
          : err instanceof Error
            ? err.message
            : '抓天氣失敗'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={autoDetect}
        disabled={loading}
        className={cn(
          'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors',
          'hover:bg-accent disabled:opacity-50',
        )}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <MapPin className="h-3 w-3" />
        )}
        自動偵測
      </button>

      <span className="mx-1 text-xs text-muted-foreground">或</span>

      {PRESET_WEATHER.map((w) => {
        const active = value?.startsWith(w.emoji)
        return (
          <button
            key={w.code}
            type="button"
            onClick={() => onChange(active ? null : `${w.emoji} ${w.label}`)}
            title={w.label}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-base transition-all',
              active
                ? 'bg-primary/15 ring-2 ring-primary'
                : 'opacity-60 hover:opacity-100 hover:bg-accent',
            )}
          >
            {w.emoji}
          </button>
        )
      })}

      {value && (
        <>
          <span className="ml-2 text-sm">{value}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            title="清除"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

function geoErrorMsg(err: GeolocationPositionError): string {
  switch (err.code) {
    case 1:
      return '需要允許定位才能自動偵測天氣'
    case 2:
      return '無法取得目前位置'
    case 3:
      return '定位逾時'
    default:
      return '定位失敗'
  }
}
