import { Suspense } from 'react'
import { SearchView } from '@/components/search/SearchView'

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="mb-6 text-2xl font-bold">搜尋日誌</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">載入中…</p>}>
        <SearchView />
      </Suspense>
    </div>
  )
}
