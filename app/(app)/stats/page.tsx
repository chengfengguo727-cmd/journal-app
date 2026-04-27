import { StatsView } from '@/components/stats/StatsView'

export default function StatsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="mb-6 text-2xl font-bold">統計分析</h1>
      <StatsView />
    </div>
  )
}
