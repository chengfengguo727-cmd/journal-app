'use client'

import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { Camera, ImagePlus, X, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { JournalPhoto } from '@/types'

interface Props {
  date: string
  userId: string
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
}

export function PhotoAttach({ date, userId }: Props) {
  const [photos, setPhotos] = useState<JournalPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void load()
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as { date?: string } | undefined
      if (detail?.date === date) void load()
    }
    window.addEventListener('journal-photo-added', handler)
    return () => window.removeEventListener('journal-photo-added', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/photos?date=${date}`)
      if (!res.ok) throw new Error('讀取失敗')
      setPhotos(await res.json())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '讀取照片失敗')
    } finally {
      setLoading(false)
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const supabase = createClient()
    const uploaded: JournalPhoto[] = []

    for (const file of Array.from(files)) {
      try {
        // 壓縮
        let blob: Blob = file
        if (file.type.startsWith('image/') && file.size > 200 * 1024) {
          blob = await imageCompression(file, COMPRESSION_OPTIONS)
        }

        // 上傳至 Supabase Storage
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
        const filename = `${crypto.randomUUID()}.${ext}`
        const storagePath = `${userId}/${date}/${filename}`

        const { error: uploadErr } = await supabase.storage
          .from('journal-photos')
          .upload(storagePath, blob, {
            contentType: blob.type,
            upsert: false,
          })
        if (uploadErr) throw uploadErr

        // 寫資料庫
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, storage_path: storagePath }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.error || '儲存照片紀錄失敗')
        }
        uploaded.push(await res.json())
      } catch (err) {
        const msg = err instanceof Error ? err.message : '上傳失敗'
        toast.error(`${file.name}: ${msg}`)
      }
    }

    if (uploaded.length > 0) {
      setPhotos((prev) => [...uploaded, ...prev])
      toast.success(`上傳 ${uploaded.length} 張照片`)
    }
    setUploading(false)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (libraryInputRef.current) libraryInputRef.current.value = ''
  }

  async function handleDelete(photo: JournalPhoto) {
    if (!confirm('確定刪除這張照片？')) return
    try {
      const res = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('刪除失敗')
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      setLightboxIdx(null)
      toast.success('已刪除')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '刪除失敗')
    }
  }

  return (
    <section className="border-t bg-background px-4 py-4 md:px-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          照片 {photos.length > 0 && <span>· {photos.length}</span>}
        </h2>
        <div className="flex items-center gap-1.5">
          {uploading ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              上傳中…
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Camera className="h-3.5 w-3.5" />
                拍照
              </button>
              <button
                type="button"
                onClick={() => libraryInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                從相簿
              </button>
            </>
          )}
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-muted-foreground">載入中…</div>
      ) : photos.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          還沒有照片。點上方「加入照片」上傳，或在手機上直接拍。
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
          {photos.map((photo, idx) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxIdx(idx)}
              className="group relative aspect-square overflow-hidden rounded-md bg-muted"
            >
              <img
                src={photo.photo_url}
                alt={photo.caption ?? ''}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxIdx != null && photos[lightboxIdx] && (
        <Lightbox
          photo={photos[lightboxIdx]}
          onClose={() => setLightboxIdx(null)}
          onDelete={() => handleDelete(photos[lightboxIdx])}
          onPrev={
            lightboxIdx > 0 ? () => setLightboxIdx(lightboxIdx - 1) : undefined
          }
          onNext={
            lightboxIdx < photos.length - 1
              ? () => setLightboxIdx(lightboxIdx + 1)
              : undefined
          }
        />
      )}
    </section>
  )
}

interface LightboxProps {
  photo: JournalPhoto
  onClose: () => void
  onDelete: () => void
  onPrev?: () => void
  onNext?: () => void
}

function Lightbox({ photo, onClose, onDelete, onPrev, onNext }: LightboxProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
      if (e.key === 'ArrowRight' && onNext) onNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-3 text-white">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          aria-label="刪除"
        >
          <Trash2 className="h-4 w-4" />
          刪除
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
          aria-label="關閉"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center px-4 pb-4"
        onClick={onClose}
      >
        <img
          src={photo.original_url ?? photo.photo_url}
          alt={photo.caption ?? ''}
          referrerPolicy="no-referrer"
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {onPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          aria-label="上一張"
        >
          ‹
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          aria-label="下一張"
        >
          ›
        </button>
      )}
    </div>
  )
}
