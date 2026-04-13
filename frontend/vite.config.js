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
    chunkSizeWarningLimit: 2000,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          // Separate heavy charting library
          if (id.includes('recharts')) {
            return 'charts-vendor';
          }

          if (id.includes('d3-')) {
            return 'd3-vendor';
          }

          // Separate data/auth libraries
          if (id.includes('axios') || id.includes('@supabase')) {
            return 'data-vendor';
          }

          // Separate UI libraries
          if (id.includes('lucide-react') || id.includes('framer-motion')) {
            return 'ui-vendor';
          }

          // General vendor chunk for other node_modules
          return 'vendor';
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
