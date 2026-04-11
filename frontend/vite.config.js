import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const devApiTarget = process.env.VITE_API_URL
  ? process.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
  : 'https://restaurent-backend-448t.onrender.com';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts-vendor';
          }

          if (id.includes('axios') || id.includes('@supabase')) {
            return 'data-vendor';
          }

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
