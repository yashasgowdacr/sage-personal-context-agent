import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false,
    proxy: {
      '/orchestrator': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/tasks': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/demo': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/memory': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
