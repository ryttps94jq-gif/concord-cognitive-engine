import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feed — Concord OS',
  description: 'Explore the latest DTUs, posts, and creative works shared by the Concord OS community.',
  openGraph: {
    type: 'website',
    title: 'Feed — Concord OS',
    description: 'Explore the latest DTUs, posts, and creative works shared by the Concord OS community.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Concord OS Feed' }],
    siteName: 'Concord OS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Feed — Concord OS',
    description: 'Explore the latest DTUs, posts, and creative works shared by the Concord OS community.',
    images: ['/og-image.png'],
  },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
