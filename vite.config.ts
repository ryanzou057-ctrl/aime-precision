import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Dynamically find all HTML files in the root directory to use as entry points
  const root = process.cwd();
  const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
  const input = htmlFiles.reduce((acc, file) => {
    const name = file.replace('.html', '');
    acc[name] = path.resolve(root, file);
    return acc;
  }, {} as Record<string, string>);

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: input, // Explicitly include all HTML files
      },
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
