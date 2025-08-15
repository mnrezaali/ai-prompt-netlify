import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.', // project root
  build: {
    outDir: 'dist', // Cloudflare expects this
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});