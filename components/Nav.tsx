'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NotebookPen, CalendarDays, Image, BarChart3, Search, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/', label: '今日', icon: NotebookPen, exact: true },
  { href: '/timeline', label: '時間軸', icon: CalendarDays },
  { href: '/search', label: '搜尋', icon: Search },
  { href: '/gallery', label: '相片', icon: Image },
  { href: '/stats', label: '統計', icon: BarChart3 },
  { href: '/settings', label: '設定', icon: Settings },
]

export function Sidebar({ email }: { email?: string | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-muted/30">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <NotebookPen className="h-5 w-5" />
        <span className="font-semibold">私人日誌</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href || pathname.startsWith('/journal')
            : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-3">
        {email && (
          <div className="mb-2 truncate px-3 text-xs text-muted-foreground" title={email}>
            {email}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          登出
        </Button>
      </div>
    </aside>
  )
}

export function BottomTabs() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href || pathname.startsWith('/journal')
          : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
