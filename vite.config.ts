/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * Dev proxy (plan D1a).
 *
 * The backend runs zero CORS on every service (HKP-CORS-1), so the browser has
 * to see a single origin. Each service keeps its own prefix rather than hiding
 * behind one `/api` mount: there is no gateway (`service-gty` does not exist),
 * and a shared prefix would make it impossible to tell which service failed.
 * Targets are `127.0.0.1`, not `localhost` — service-ai binds 127.0.0.1 only,
 * and `localhost` can resolve to ::1 first.
 */
const SERVICE_TARGETS: Record<string, string> = {
  '/plt': 'http://127.0.0.1:7201',
  '/ai': 'http://127.0.0.1:7301',
  '/bkt': 'http://127.0.0.1:7401',
  // mnd speaks gRPC on 7101; 7102 is the HTTP mux that will host the JSON
  // facade (HKP-MND-1). Nothing app-side may call it until that facade exists.
  '/mnd': 'http://127.0.0.1:7102',
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/stratfolio-app/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: Object.fromEntries(
      Object.entries(SERVICE_TARGETS).map(([prefix, target]) => [
        prefix,
        {
          target,
          changeOrigin: false,
          rewrite: (urlPath: string) => urlPath.slice(prefix.length),
        },
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
