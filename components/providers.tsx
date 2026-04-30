'use client'

import { ThemeProvider } from 'next-themes'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { OfflineQueueFlusher } from '@/components/pwa/OfflineQueueFlusher'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <ServiceWorkerRegister />
      <OfflineQueueFlusher />
    </ThemeProvider>
  )
}
