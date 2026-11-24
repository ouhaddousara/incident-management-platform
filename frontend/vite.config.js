import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le proxy évite les problèmes de CORS : le front appelle /api/... sur son propre port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
