import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base は相対パスにしておく。GitHub Pages の
// https://<user>.github.io/<repo>/ でも、独自ドメインのルート配置でもそのまま動く。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
});
