'use client'

import { MOOD_EMOJIS, MOOD_LABELS, type MoodScore } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  value: MoodScore | null | undefined
  onChange: (value: MoodScore | null) => void
}

export function MoodSelector({ value, onChange }: Props) {
  const scores: MoodScore[] = [1, 2, 3, 4, 5]
  return (
    <div className="flex items-center gap-1.5">
      {scores.map((score) => {
        const active = value === score
        return (
          <button
            key={score}
            type="button"
            onClick={() => onChange(active ? null : score)}
            title={MOOD_LABELS[score]}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full text-xl transition-all',
              active
                ? 'bg-primary/15 ring-2 ring-primary scale-110'
                : 'opacity-60 hover:opacity-100 hover:bg-accent',
            )}
          >
            {MOOD_EMOJIS[score]}
          </button>
        )
      })}
      {value != null && (
        <span className="ml-2 text-xs text-muted-foreground">
          {MOOD_LABELS[value]}
        </span>
      )}
    </div>
  )
}
