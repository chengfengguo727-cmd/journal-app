export type MoodScore = 1 | 2 | 3 | 4 | 5

export interface JournalEntry {
  id: string
  user_id: string
  date: string
  title?: string | null
  content: string
  content_html?: string | null
  mood_score?: MoodScore | null
  mood_tags: string[]
  custom_tags: string[]
  people_tags: string[]
  weather?: string | null
  location?: string | null
  location_lat?: number | null
  location_lng?: number | null
  word_count: number
  is_favorite: boolean
  ai_summary?: string | null
  created_at: string
  updated_at: string
  photos?: JournalPhoto[]
  voice_memos?: VoiceMemo[]
}

export interface JournalPhoto {
  id: string
  entry_id?: string | null
  date: string
  source: 'upload' | 'google_photos'
  photo_url: string
  original_url?: string | null
  google_photo_id?: string | null
  caption?: string | null
  taken_at?: string | null
}

export interface VoiceMemo {
  id: string
  entry_id?: string | null
  date: string
  audio_url: string
  transcript?: string | null
  duration_seconds?: number | null
}

export interface EntryUpsertPayload {
  date: string
  title?: string
  content: string
  mood_score?: MoodScore | null
  mood_tags?: string[]
  custom_tags?: string[]
  people_tags?: string[]
  location?: string
  location_lat?: number
  location_lng?: number
}

export const MOOD_LABELS: Record<MoodScore, string> = {
  1: '很差',
  2: '不好',
  3: '普通',
  4: '不錯',
  5: '很好',
}

export const MOOD_EMOJIS: Record<MoodScore, string> = {
  1: '😔',
  2: '😐',
  3: '🙂',
  4: '😊',
  5: '🌟',
}

export const PRESET_MOOD_TAGS = [
  '開心', '感恩', '興奮', '平靜',
  '疲憊', '焦慮', '難過', '憤怒',
  '無聊', '思念', '期待', '滿足',
] as const
