/**
 * OpenAI Whisper API 包裝
 * 文件：https://platform.openai.com/docs/api-reference/audio/createTranscription
 */

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'

export interface TranscribeOptions {
  /** 音檔 Blob 或 File */
  audio: Blob
  /** 檔名（含副檔名，Whisper 用以判斷格式） */
  filename: string
  /** 語言代碼，預設 zh（中文） */
  language?: string
  /** 提示詞，可幫助 Whisper 校正特殊用詞 */
  prompt?: string
}

export async function transcribeAudio({
  audio,
  filename,
  language = 'zh',
  prompt,
}: TranscribeOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const form = new FormData()
  form.append('file', audio, filename)
  form.append('model', 'whisper-1')
  form.append('language', language)
  form.append('response_format', 'json')
  if (prompt) form.append('prompt', prompt)

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Whisper API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as { text?: string }
  return data.text ?? ''
}
