'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import {
  Bold, Italic, List, ListOrdered, Quote, Minus, Heading2, Loader2, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { MoodSelector } from './MoodSelector'
import { TagInput } from './TagInput'
import { VoiceRecorder } from './VoiceRecorder'
import { PRESET_MOOD_TAGS, type JournalEntry, type MoodScore } from '@/types'
import { cn, countWords } from '@/lib/utils'

const SAVE_DEBOUNCE_MS = 2000

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  date: string
  initialEntry: JournalEntry | null
}

export function JournalEditor({ date, initialEntry }: Props) {
  const [moodScore, setMoodScore] = useState<MoodScore | null>(
    initialEntry?.mood_score ?? null,
  )
  const [moodTags, setMoodTags] = useState<string[]>(initialEntry?.mood_tags ?? [])
  const [customTags, setCustomTags] = useState<string[]>(initialEntry?.custom_tags ?? [])
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [wordCount, setWordCount] = useState<number>(initialEntry?.word_count ?? 0)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestState = useRef({
    content: initialEntry?.content ?? '',
    content_html: initialEntry?.content_html ?? '',
    moodScore,
    moodTags,
    customTags,
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: '今天過得如何？寫點什麼吧…' }),
      CharacterCount.configure(),
    ],
    content: initialEntry?.content_html ?? '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-[40vh] md:min-h-[50vh] focus:outline-none text-base leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const text = editor.getText()
      latestState.current.content = text
      latestState.current.content_html = html
      setWordCount(countWords(text))
      scheduleSave()
    },
  })

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setStatus('saving')
    saveTimer.current = setTimeout(() => {
      void save()
    }, SAVE_DEBOUNCE_MS)
  }

  async function save() {
    const { content, content_html } = latestState.current
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          content,
          content_html,
          mood_score: latestState.current.moodScore,
          mood_tags: latestState.current.moodTags,
          custom_tags: latestState.current.customTags,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '儲存失敗')
      }
      setStatus('saved')
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : '儲存失敗'
      toast.error(msg)
    }
  }

  // 把 latest state 同步到 ref 並排程儲存（mood / tags 改變時）
  useEffect(() => {
    latestState.current.moodScore = moodScore
    latestState.current.moodTags = moodTags
    latestState.current.customTags = customTags
    if (editor && !editor.isEmpty) scheduleSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moodScore, moodTags, customTags])

  // 卸載前若還有 pending 變更 → flush
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        void save()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!editor) return null

  return (
    <div className="flex flex-col">
      <Toolbar
        editor={editor}
        rightSlot={
          <VoiceRecorder
            date={date}
            onTranscript={(text) =>
              editor.chain().focus().insertContent(text + ' ').run()
            }
          />
        }
      />

      <div className="border-y bg-muted/20 px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">心情</span>
            <MoodSelector value={moodScore} onChange={setMoodScore} />
          </div>
          <SaveIndicator status={status} />
        </div>
        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-3">
            <span className="mt-1 w-12 shrink-0 text-sm text-muted-foreground">情緒</span>
            <TagInput
              value={moodTags}
              onChange={setMoodTags}
              presets={PRESET_MOOD_TAGS}
              placeholder="情緒…"
              className="flex-1"
            />
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 w-12 shrink-0 text-sm text-muted-foreground">標籤</span>
            <TagInput
              value={customTags}
              onChange={setCustomTags}
              placeholder="自訂標籤…"
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6">
        <EditorContent editor={editor} />
      </div>

      <div className="sticky bottom-16 border-t bg-background/80 px-4 py-2 text-right text-xs text-muted-foreground backdrop-blur md:bottom-0 md:px-6">
        字數：{wordCount}
      </div>
    </div>
  )
}

function Toolbar({
  editor,
  rightSlot,
}: {
  editor: ReturnType<typeof useEditor>
  rightSlot?: React.ReactNode
}) {
  if (!editor) return null
  const items = [
    {
      icon: Heading2,
      title: '標題',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () => editor.isActive('heading', { level: 2 }),
    },
    {
      icon: Bold,
      title: '粗體',
      action: () => editor.chain().focus().toggleBold().run(),
      active: () => editor.isActive('bold'),
    },
    {
      icon: Italic,
      title: '斜體',
      action: () => editor.chain().focus().toggleItalic().run(),
      active: () => editor.isActive('italic'),
    },
    {
      icon: List,
      title: '項目清單',
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: () => editor.isActive('bulletList'),
    },
    {
      icon: ListOrdered,
      title: '編號清單',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: () => editor.isActive('orderedList'),
    },
    {
      icon: Quote,
      title: '引用',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      active: () => editor.isActive('blockquote'),
    },
    {
      icon: Minus,
      title: '分隔線',
      action: () => editor.chain().focus().setHorizontalRule().run(),
      active: () => false,
    },
  ]
  return (
    <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-2 md:px-6">
      <div className="flex items-center gap-1">
        {items.map(({ icon: Icon, title, action, active }) => (
          <button
            key={title}
            type="button"
            title={title}
            onClick={action}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
              active() && 'bg-accent text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      {rightSlot}
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        儲存中…
      </div>
    )
  }
  if (status === 'saved') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3 w-3 text-green-600" />
        已儲存
      </div>
    )
  }
  if (status === 'error') {
    return <div className="text-xs text-destructive">儲存失敗</div>
  }
  return null
}
