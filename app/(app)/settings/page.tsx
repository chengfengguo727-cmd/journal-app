import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { GooglePhotosConnect } from '@/components/settings/GooglePhotosConnect'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-2xl font-bold">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">帳號</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user?.email}</dd>
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="font-mono text-xs">{user?.id}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Google Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <GooglePhotosConnect />
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        通知、推播、備份等功能將於 Phase 5 開放。
      </p>
    </div>
  )
}
