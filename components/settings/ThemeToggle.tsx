'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: '淺色', icon: Sun },
  { value: 'system', label: '跟隨系統', icon: Monitor },
  { value: 'dark', label: '深色', icon: Moon },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 在 hydrate 完成前顯示佔位，避免 SSR / client mismatch
  if (!mounted) {
    return (
      <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
        {OPTIONS.map((o) => (
          <div
            key={o.value}
            className="flex h-8 items-center gap-1 rounded px-2.5 text-xs text-muted-foreground"
          >
            <o.icon className="h-3.5 w-3.5" />
            {o.label}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-background p-0.5">
      {OPTIONS.map((o) => {
        const active = theme === o.value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            className={cn(
              'flex h-8 items-center gap-1 rounded px-2.5 text-xs transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
