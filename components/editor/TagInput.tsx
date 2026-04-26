'use client'

import { useState, type KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  presets?: readonly string[]
  className?: string
}

export function TagInput({ value, onChange, placeholder = '新增標籤…', presets, className }: Props) {
  const [input, setInput] = useState('')

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (!trimmed || value.includes(trimmed)) {
      setInput('')
      return
    }
    onChange([...value, trimmed])
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full p-0.5 opacity-60 hover:opacity-100"
              aria-label={`移除 ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="inline-flex items-center">
          <Plus className="h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => input && addTag(input)}
            placeholder={placeholder}
            className="ml-1 w-24 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {presets
            .filter((p) => !value.includes(p))
            .slice(0, 12)
            .map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => addTag(preset)}
                className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-solid hover:text-foreground"
              >
                {preset}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
