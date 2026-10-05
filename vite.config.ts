/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // The dataset (src/data) goes in its own file: it rarely changes, so
            // the browser reuses it from its cache even when the code changes.
            // HSK 5 stays out: only Today's Word loads it, on demand.
            { name: 'dataset', test: /[\\/]src[\\/]data[\\/](?!hsk5[\\/])/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
