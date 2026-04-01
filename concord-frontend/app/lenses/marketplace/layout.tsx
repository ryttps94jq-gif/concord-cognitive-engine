import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace — Concord OS',
  description: 'Browse and trade beats, samples, presets, and creative DTU artifacts on the Concord OS marketplace.',
  openGraph: {
    type: 'website',
    title: 'Marketplace — Concord OS',
    description: 'Browse and trade beats, samples, presets, and creative DTU artifacts on the Concord OS marketplace.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Concord OS Marketplace' }],
    siteName: 'Concord OS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Marketplace — Concord OS',
    description: 'Browse and trade beats, samples, presets, and creative DTU artifacts on the Concord OS marketplace.',
    images: ['/og-image.png'],
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
