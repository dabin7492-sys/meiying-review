import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MeiYing-review',
  description: '리뷰 모집 관리 플랫폼',
  openGraph: {
    title: 'MeiYing-review',
    description: '리뷰 모집 관리 플랫폼',
    images: [{ url: '/blank.png', width: 1, height: 1, alt: '' }],
  },
  twitter: {
    card: 'summary',
    images: ['/blank.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:image" content="" />
        <meta name="kakao:image" content="" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
