import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  plugins: [react(), tailwindcss()]
});