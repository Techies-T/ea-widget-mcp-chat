import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5192,
    proxy: {
      '/api/mcp': {
        target: 'http://localhost:8092',
        changeOrigin: true
      }
    }
  }
});
