import type { NextConfig } from 'next';

// URL interne de l'API NestJS (jamais exposée au navigateur : les appels passent par /api).
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
// Le relais /api est figé au build : sans API_URL, Vercel enverrait tout vers localhost (erreur 404 DNS_HOSTNAME_RESOLVED_PRIVATE).
if (process.env.VERCEL) {
  console.log(`Relais /api → ${API_URL}`);
  const host = URL.canParse(API_URL) ? new URL(API_URL).hostname : '';
  if (!API_URL.startsWith('https://') || !host.includes('.') || host === 'localhost') {
    throw new Error(`API_URL invalide sur Vercel (« ${process.env.API_URL ?? 'absente'} ») : utilisez l'adresse publique, ex. https://votre-api.onrender.com, puis redéployez.`);
  }
}

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Les images sont déjà déclinées en plusieurs largeurs (API ou CDN Unsplash) : chargeur personnalisé.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },
  async redirects() {
    // Anciennes adresses « occasions » (liens déjà partagés) vers la rubrique Téléphones.
    return [
      // Téléphones et accessoires sont des rayons de la boutique ; les filtres de l'adresse sont conservés.
      { source: '/telephones', destination: '/boutique', permanent: true },
      { source: '/accessoires', destination: '/boutique?rayon=accessoires', permanent: true },
      { source: '/occasions', destination: '/boutique?type=occasions', permanent: true },
      { source: '/occasions/:slug', destination: '/telephones/:slug', permanent: true },
      // Les accessoires ont quitté /boutique (devenue la présentation du magasin) ; le panier est remplacé par WhatsApp.
      { source: '/boutique/:slug', destination: '/accessoires/:slug', permanent: true },
      { source: '/panier', destination: '/boutique', permanent: false },
      { source: '/contact', destination: '/boutique', permanent: true },
    ];
  },
  async rewrites() {
    // Même origine pour le navigateur : cookies de session « first-party », pas de CORS côté client.
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [{ source: '/:path*', headers: security }];
  },
};

export default config;
