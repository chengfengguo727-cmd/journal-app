import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { StatsView } from '@/components/stats/StatsView'

export default function StatsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">統計分析</h1>
        <Link
          href="/recap"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          年度回顧
        </Link>
      </div>
      <StatsView />
    </div>
  )
}
