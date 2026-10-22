import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const cairo = Cairo({
  variable: '--font-cairo',
  subsets: ['arabic', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'بيان — نظام مبيعات وتوريدات الحديد والبويات',
  description: 'نظام ERP متكامل لإدارة مبيعات وتوريدات الحديد والصلب والبويات — تطوير MiB Technology',
  icons: {
    icon: [
      { url: '/brand/favicon.ico' },
      { url: '/brand/bayan-mark.svg', type: 'image/svg+xml' },
      { url: '/brand/bayan-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
