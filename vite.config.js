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
        // Cambiar cacheId fuerza nombres de caché nuevos — el SW viejo
        // detecta las cachés como obsoletas y cede el control al nuevo.
        cacheId: 'praxisgt-v2',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\//i,
            handler: 'NetworkOnly',
          },
          {
            // HTML de navegación: NetworkFirst para siempre recibir el deploy más reciente
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'praxisgt-v2-navigate',
              networkTimeoutSeconds: 5,
            },
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
