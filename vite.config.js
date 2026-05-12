import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    // Forward /api/* to the Node backend during development so the frontend
    // can call `/api/simplify` directly without dealing with CORS or hard-
    // coding a localhost URL. The backend lives in /server.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
