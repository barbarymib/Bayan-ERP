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
  title: 'بيان — نظام مبيعات الحديد والبويات',
  description: 'نظام بيانات أسعار وإدارة مبيعات الحديد والبويات للمكتب والمناديب',
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
