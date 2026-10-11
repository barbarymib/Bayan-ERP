import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// أسماء ملفات تعريف الارتباط المرآة للرموز (تُضبط في lib/api.ts و lib/global.ts).
const AUTH_COOKIE = 'bayan_auth';
const GLOBAL_COOKIE = 'bayan_global';

// كل مسارات التطبيق المحمية (المجموعة (app)).
const PROTECTED = [
  '/dashboard',
  '/approvals',
  '/archives',
  '/audit-logs',
  '/backups',
  '/branches',
  '/brands',
  '/categories',
  '/collections',
  '/customers',
  '/geo',
  '/items',
  '/notifications',
  '/prices',
  '/purchase-orders',
  '/purchases',
  '/quotations',
  '/reports',
  '/reps',
  '/returns',
  '/special-prices',
  '/statements',
  '/stocktakes',
  '/supplier-returns',
  '/suppliers',
  '/targets',
  '/transfers',
  '/treasury',
  '/users',
  '/visit-plans',
  '/warehouses',
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // لوحة المشرف العام للبيئة لها رمزcookie مختلف.
  if (matches(pathname, '/global/admin')) {
    if (!request.cookies.has(GLOBAL_COOKIE)) {
      return NextResponse.redirect(new URL('/global/login', request.url));
    }
    return NextResponse.next();
  }

  if (PROTECTED.some((prefix) => matches(pathname, prefix)) && !request.cookies.has(AUTH_COOKIE)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml|webmanifest)$).*)',
  ],
};
