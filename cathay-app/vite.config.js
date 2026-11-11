import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Python itinerary service (server/) listens on 127.0.0.1:8000. The browser only talks to
// /api/itinerary on this origin, so the Poe, Tavily and Google keys stay on the server.
const itineraryService = 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api/itinerary': { target: itineraryService, changeOrigin: true } } },
  preview: { proxy: { '/api/itinerary': { target: itineraryService, changeOrigin: true } } },
});
