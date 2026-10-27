import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Must match PORT in server/.env (5001). Override with VITE_API_TARGET.
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // Ensure all routes fall back to index.html so React Router handles them
  preview: {
    port: 4173,
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendor libraries into a separate chunk for better browser caching
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
