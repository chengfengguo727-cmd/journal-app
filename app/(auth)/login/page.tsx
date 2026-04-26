'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, NotebookPen } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setSent(true)
      toast.success('登入連結已寄出，請檢查信箱')
    } catch (err) {
      const message = err instanceof Error ? err.message : '寄送失敗'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <NotebookPen className="h-6 w-6" />
          </div>
          <CardTitle>私人日誌</CardTitle>
          <CardDescription>
            輸入你的 Email，我們會寄送一個登入連結給你
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-2 text-center text-sm text-muted-foreground">
              <p>📬 已將登入連結寄至</p>
              <p className="font-medium text-foreground">{email}</p>
              <p>請在同一個瀏覽器點擊信件中的連結完成登入。</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? '寄送中…' : '寄送登入連結'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
