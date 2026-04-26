import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar, BottomTabs } from '@/components/Nav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomTabs />
    </div>
  )
}
