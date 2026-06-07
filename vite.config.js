import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',         // Rutas relativas — necesario para Electron
  server: {
    port: 3000,
    strictPort: true, // Siempre usar el mismo puerto
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Aumentar límite de advertencia de tamaño (tenemos todo en un archivo)
    chunkSizeWarningLimit: 1000,
  },
});
