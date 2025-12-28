import type { Metadata } from 'next';
import ThemeRegistry from '@/components/ThemeRegistry';
import AppShell from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: '簿記2級 学習チェック',
  description: '商業簿記・工業簿記の学習計画と毎日のチェックを支援するWebアプリ',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <ThemeRegistry>
          <AppShell>{children}</AppShell>
        </ThemeRegistry>
      </body>
    </html>
  );
}
