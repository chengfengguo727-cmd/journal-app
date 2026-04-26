'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Loader2, Square } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  date: string
  onTranscript: (text: string) => void
}

type State = 'idle' | 'recording' | 'transcribing' | 'denied'

export function VoiceRecorder({ date, onTranscript }: Props) {
  const [state, setState] = useState<State>('idle')
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => void handleStop()
      recorder.start(250)
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setSeconds(0)
      setState('recording')
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 250)
    } catch (err) {
      const name = (err as DOMException | undefined)?.name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setState('denied')
        toast.error('需要麥克風權限才能錄音')
      } else {
        toast.error('無法啟動錄音：' + (err instanceof Error ? err.message : ''))
      }
      cleanup()
    }
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  async function handleStop() {
    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000)
    const mimeType = recorderRef.current?.mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    cleanup()

    if (blob.size < 1024 || durationSec < 1) {
      toast.error('錄音太短')
      setState('idle')
      return
    }

    setState('transcribing')
    try {
      const form = new FormData()
      form.append('audio', blob, 'recording')
      form.append('date', date)
      form.append('duration', String(durationSec))

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || '辨識失敗')
      }
      const { transcript } = (await res.json()) as { transcript: string }
      if (transcript && transcript.trim()) {
        onTranscript(transcript)
        toast.success('已轉成文字並插入日誌')
      } else {
        toast('沒辨識出文字（音檔已保留可重聽）')
      }
      window.dispatchEvent(
        new CustomEvent('voice-memo-added', { detail: { date } }),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '辨識失敗')
    } finally {
      setState('idle')
    }
  }

  useEffect(() => () => cleanup(), [])

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  if (state === 'recording') {
    return (
      <button
        type="button"
        onClick={stop}
        className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1 text-sm text-red-600"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative h-2 w-2 rounded-full bg-red-500" />
        </span>
        <Square className="h-3 w-3" />
        {fmt(seconds)}
      </button>
    )
  }

  if (state === 'transcribing') {
    return (
      <span className="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        辨識中…
      </span>
    )
  }

  if (state === 'denied') {
    return (
      <button
        type="button"
        title="麥克風被拒，點擊重試"
        onClick={start}
        className="flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-accent"
      >
        <MicOff className="h-4 w-4" />
      </button>
    )
  }

  return (
    <button
      type="button"
      title="錄音轉文字"
      onClick={start}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Mic className="h-4 w-4" />
    </button>
  )
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
  ]
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}
