/**
 * Google Photos Picker API + OAuth helpers
 * 文件：https://developers.google.com/photos/picker/reference/rest
 *
 * 注意：原本的 Library API（photoslibrary.readonly）已於 2025-03 被 Google 限縮，
 * 未驗證 app 拿不到。改用 Picker API：使用者透過 Google 自家視窗主動挑選照片，
 * 我們只能拿到「他主動選的那幾張」，且 session 最長 7 天。
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1'

export interface PickerMediaItem {
  id: string
  createTime: string
  type: 'PHOTO' | 'VIDEO'
  mediaFile: {
    baseUrl: string
    mimeType: string
    filename: string
    mediaFileMetadata?: {
      width?: number
      height?: number
    }
  }
}

export interface PickerSession {
  id: string
  pickerUri: string
  pollingConfig?: { pollInterval?: string; timeoutIn?: string }
  expireTime: string
  mediaItemsSet: boolean
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
    prompt: 'consent',
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
  if (expiresAt > Date.now() + 60_000) {
    return auth.access_token
  }

  if (!auth.refresh_token) return null

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

// ====================================================
// Picker API
// ====================================================

export async function createPickerSession(accessToken: string): Promise<PickerSession> {
  const res = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    throw new Error(`Create session failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as PickerSession
}

export async function getPickerSession(
  accessToken: string,
  sessionId: string,
): Promise<PickerSession> {
  const res = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Get session failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as PickerSession
}

export async function deletePickerSession(
  accessToken: string,
  sessionId: string,
): Promise<void> {
  await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function listPickedMediaItems(
  accessToken: string,
  sessionId: string,
): Promise<PickerMediaItem[]> {
  const items: PickerMediaItem[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({ sessionId, pageSize: '100' })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(`${PICKER_API_BASE}/mediaItems?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      throw new Error(`List items failed: ${res.status} ${await res.text()}`)
    }
    const data = (await res.json()) as {
      mediaItems?: PickerMediaItem[]
      nextPageToken?: string
    }
    items.push(...(data.mediaItems ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return items
}

export function thumbnailUrl(baseUrl: string, size = 400): string {
  return `${baseUrl}=w${size}-h${size}`
}

export function fullSizeUrl(baseUrl: string, maxDim = 1920): string {
  return `${baseUrl}=w${maxDim}-h${maxDim}`
}
