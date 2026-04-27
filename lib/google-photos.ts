/**
 * Google Photos Library API + OAuth helpers
 * 文件：https://developers.google.com/photos/library/reference/rest
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const SCOPE = 'https://www.googleapis.com/auth/photoslibrary.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const PHOTOS_API_BASE = 'https://photoslibrary.googleapis.com/v1'

export interface GoogleMediaItem {
  id: string
  productUrl: string
  baseUrl: string
  mimeType: string
  filename: string
  mediaMetadata?: {
    creationTime?: string
    width?: string
    height?: string
  }
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
}

export function getRedirectUri(origin: string): string {
  return `${origin}/api/photos/google/callback`
}

export function buildAuthorizeUrl(origin: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getRedirectUri(origin),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',  // 強制每次都回傳 refresh_token
    include_granted_scopes: 'true',
  })
  if (state) params.set('state', state)
  return `${AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string, origin: string) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: getRedirectUri(origin),
    grant_type: 'authorization_code',
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  }
  const tok = (await res.json()) as TokenResponse
  return {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? null,
    expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: 'refresh_token',
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
  }
  const tok = (await res.json()) as TokenResponse
  return {
    access_token: tok.access_token,
    expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
  }
}

/**
 * 取得目前有效的 access token，必要時自動 refresh 並更新資料庫。
 * 回傳 null 表示尚未連結 Google Photos。
 */
export async function getValidAccessToken(
  userId: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data: auth } = await supabase
    .from('google_photos_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!auth) return null

  const expiresAt = auth.expires_at ? new Date(auth.expires_at).getTime() : 0
  // 提前 60 秒 refresh，避免邊界 race
  if (expiresAt > Date.now() + 60_000) {
    return auth.access_token
  }

  if (!auth.refresh_token) {
    // 沒 refresh token，token 已過期 → 需要使用者重連
    return null
  }

  const refreshed = await refreshAccessToken(auth.refresh_token)
  await supabase
    .from('google_photos_auth')
    .update({
      access_token: refreshed.access_token,
      expires_at: refreshed.expires_at,
    })
    .eq('user_id', userId)

  return refreshed.access_token
}

export async function searchPhotosByDate(
  accessToken: string,
  isoDate: string,
): Promise<GoogleMediaItem[]> {
  const [y, m, d] = isoDate.split('-').map(Number)
  const res = await fetch(`${PHOTOS_API_BASE}/mediaItems:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filters: {
        dateFilter: {
          dates: [{ year: y, month: m, day: d }],
        },
      },
      pageSize: 100,
    }),
  })
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { mediaItems?: GoogleMediaItem[] }
  return data.mediaItems ?? []
}

export async function batchGetMediaItems(
  accessToken: string,
  ids: string[],
): Promise<Record<string, GoogleMediaItem>> {
  if (ids.length === 0) return {}
  // batchGet supports up to 50 IDs
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 50) {
    chunks.push(ids.slice(i, i + 50))
  }

  const result: Record<string, GoogleMediaItem> = {}
  for (const chunk of chunks) {
    const params = new URLSearchParams()
    chunk.forEach((id) => params.append('mediaItemIds', id))
    const res = await fetch(`${PHOTOS_API_BASE}/mediaItems:batchGet?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      // 部分失敗不要整個壞掉
      continue
    }
    const data = (await res.json()) as {
      mediaItemResults?: Array<{
        mediaItem?: GoogleMediaItem
        status?: { code: number; message: string }
      }>
    }
    data.mediaItemResults?.forEach((r) => {
      if (r.mediaItem) result[r.mediaItem.id] = r.mediaItem
    })
  }
  return result
}

export function thumbnailUrl(baseUrl: string, size = 400): string {
  return `${baseUrl}=w${size}-h${size}`
}

export function fullSizeUrl(baseUrl: string, maxDim = 1920): string {
  return `${baseUrl}=w${maxDim}-h${maxDim}`
}
