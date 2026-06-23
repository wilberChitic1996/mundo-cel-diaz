import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['icon-180.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'PraxisGT — Sistema de Gestión',
        short_name: 'PraxisGT',
        description: 'Sistema de gestión empresarial para negocios en Guatemala',
        theme_color: '#1D9E75',
        background_color: '#1a2535',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Forzar que el Service Worker nuevo tome control de inmediato y borre
        // las cachés viejas (builds anteriores y datos del API cacheados).
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // IMPORTANTE: el API NUNCA se cachea. Este es un sistema 100% online —
        // todas las llamadas a /api/ deben ir SIEMPRE al servidor en vivo.
        // Cachear respuestas del API causaba que se sirvieran datos viejos o
        // vacíos (respaldos incompletos, listas vacías). El Service Worker solo
        // cachea la app (JS/CSS/imágenes), nunca los datos.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\//i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  base: '/',
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
});
