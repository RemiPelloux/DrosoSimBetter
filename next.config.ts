import type { NextConfig } from 'next';

/** En-têtes de sécurité appliqués à toutes les pages. */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  // Rendu : composants mis en cache et préchargement partiel des liens (Next.js 16)
  cacheComponents: true,
  partialPrefetching: true,

  // Ne pas révéler la technologie du serveur
  poweredByHeader: false,

  // Images optimisées (logos partenaires) : AVIF puis WebP selon le navigateur
  images: { formats: ['image/avif', 'image/webp'] },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // logos et icônes publics : cache navigateur d'une semaine
      { source: '/partners/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
    ];
  },

  // Tailwind CSS 4 compilé par Turbopack
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};

export default nextConfig;
