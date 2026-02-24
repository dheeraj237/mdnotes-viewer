import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables for the current mode (including .env, .env.production, etc.)
  const env = loadEnv(mode, process.cwd(), '');
  // Use VITE_BASE_PATH when provided, otherwise default to '/' (dev)
  const base = env.VITE_BASE_PATH || '/';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  // For GitHub Pages: set to '/repo-name/' for project pages, or '/' for user/org pages
    // Defaults to '/' for local development. Provide VITE_BASE_PATH to override.
    base,
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      port: 3000,
      open: true,
    },
  };
});
