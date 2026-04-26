import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: '私人日誌',
  description: '個人私有的雲端日誌系統',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
