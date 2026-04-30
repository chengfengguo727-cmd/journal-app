'use client'

import { openDB, type IDBPDatabase } from 'idb'

/**
 * 離線寫入佇列：JournalEditor 在 fetch 失敗時 enqueue，
 * 連線恢復後 OfflineQueueFlusher 把 queue 倒回 server。
 *
 * 因為條目以 (user_id, date) UNIQUE，replay 時用 upsert 邏輯，
 * 同一天多個 pending 只保留最新那筆即可。
 */

const DB_NAME = 'journal-offline'
const DB_VERSION = 1
const STORE = 'pending-entries'

export interface PendingEntry {
  /** key = `${date}` — 同一天只留最新版本 */
  date: string
  payload: Record<string, unknown>
  queued_at: number
}

let dbPromise: Promise<IDBPDatabase> | null = null
function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'date' })
        }
      },
    })
  }
  return dbPromise
}

export async function enqueueEntry(payload: Record<string, unknown>) {
  const date = (payload.date as string) ?? null
  if (!date) return
  const d = await db()
  await d.put(STORE, {
    date,
    payload,
    queued_at: Date.now(),
  } satisfies PendingEntry)
}

export async function listPending(): Promise<PendingEntry[]> {
  const d = await db()
  return d.getAll(STORE)
}

export async function removePending(date: string) {
  const d = await db()
  await d.delete(STORE, date)
}

export async function pendingCount(): Promise<number> {
  const d = await db()
  return d.count(STORE)
}
