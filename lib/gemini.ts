import { GoogleGenAI } from '@google/genai'

/**
 * Gemini 客戶端 — 用於 AI 摘要、年度回顧。
 * 需要 GEMINI_API_KEY 環境變數（在 Google AI Studio 取得）。
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-pro'

let _client: GoogleGenAI | null = null
function client(): GoogleGenAI {
  if (_client) return _client
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set')
  }
  _client = new GoogleGenAI({ apiKey })
  return _client
}

export interface GenerateOptions {
  /** system 提示（角色、風格指引） */
  system?: string
  /** 限制輸出最大 token 數 */
  maxOutputTokens?: number
  /** 溫度 0–2，預設 0.7 */
  temperature?: number
}

export async function generateText(
  prompt: string,
  options: GenerateOptions = {},
): Promise<string> {
  const res = await client().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: options.system,
      maxOutputTokens: options.maxOutputTokens,
      temperature: options.temperature ?? 0.7,
    },
  })
  const text = res.text
  if (!text) {
    throw new Error('Gemini returned empty response')
  }
  return text.trim()
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}
