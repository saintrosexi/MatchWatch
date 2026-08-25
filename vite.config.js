import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devServerApi } from './devServerApi.js';

export default defineConfig({
  // Локально серверлес-функции из api/ обслуживает плагин, на проде — Vercel.
  plugins: [react(), devServerApi()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * Supabase SDK меняется реже кода приложения — отдельным чанком,
         * чтобы деплой не сбрасывал его из кэша браузера.
         */
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          react: ['react', 'react-dom'],
          ui: ['lucide-react', 'canvas-confetti'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
