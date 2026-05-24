import type { Metadata } from 'next';
import './globals.css';
import { THEME_INIT_SCRIPT } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'Malenia',
  description: 'Единая система мониторинга трафика, лидов и эффективности контентных проектов',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
