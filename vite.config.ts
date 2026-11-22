import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: { '/api': 'http://localhost:8080' },
      },
      plugins: [react()],
      define: {
        // The Gemini key is deliberately absent: it lives on the server only.
        'process.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL || ''),
        'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
        'process.env.SUPABASE_KEY': JSON.stringify(env.SUPABASE_KEY),
        'process.env.COMMIT_SHA': JSON.stringify(env.COMMIT_SHA || 'dev'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
    };
});
