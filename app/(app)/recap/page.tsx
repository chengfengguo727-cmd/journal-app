import { RecapView } from '@/components/recap/RecapView'

export default function RecapPage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const now = new Date()
  const defaultYear =
    parseInt(searchParams.year ?? '', 10) || now.getFullYear() - 1
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="mb-6 text-2xl font-bold">年度回顧</h1>
      <RecapView defaultYear={defaultYear} />
    </div>
  )
}
