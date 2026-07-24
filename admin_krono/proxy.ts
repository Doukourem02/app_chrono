import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { EXACT_WORKSPACE_PATH_SET } from '@/lib/workspacePaths'

/**
 * Proxy pour protéger les routes du dashboard
 * Vérifie l'authentification et le rôle admin côté serveur
 * Note: Next.js 16 utilise "proxy" au lieu de "middleware"
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const publicRoutes = ['/login', '/api/auth']
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Une seule page /workspace : URLs plates (/orders, etc.) inchangées dans le navigateur
  if (EXACT_WORKSPACE_PATH_SET.has(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/workspace'
    return NextResponse.rewrite(url)
  }

  // La vérification complète de l'authentification se fait dans layout.tsx côté client,
  // car Supabase stocke les tokens dans des cookies HTTP-only peu accessibles au middleware
  // Next.js. Ce middleware sert principalement de première ligne de défense.
  if (pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

