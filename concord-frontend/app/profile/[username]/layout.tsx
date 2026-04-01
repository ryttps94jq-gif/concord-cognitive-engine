import type { Metadata } from 'next';

interface Props {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const displayName = `@${username}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://concord-os.org';

  return {
    title: `${displayName} — Creator Profile`,
    description: `View ${displayName}'s cognitive profile, DTUs, and contributions on Concord OS.`,
    openGraph: {
      type: 'profile',
      title: `${displayName} — Concord OS Creator`,
      description: `View ${displayName}'s cognitive profile, DTUs, and contributions on Concord OS.`,
      url: `${siteUrl}/profile/${username}`,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${displayName} on Concord OS` }],
      siteName: 'Concord OS',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} — Concord OS Creator`,
      description: `View ${displayName}'s cognitive profile, DTUs, and contributions on Concord OS.`,
      images: ['/og-image.png'],
    },
  };
}

export default function ProfileUsernameLayout({ children }: Props) {
  return <>{children}</>;
}
