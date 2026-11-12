import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api/planner': { target: 'http://127.0.0.1:8000', proxyTimeout: 305000 } } },
});
