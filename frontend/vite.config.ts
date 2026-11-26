import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/runs': 'http://127.0.0.1:8000',
      '/agents': 'http://127.0.0.1:8000',
      '/tools': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/concepts': 'http://127.0.0.1:8000',
      '/config': 'http://127.0.0.1:8000',
      '/auth': 'http://127.0.0.1:8000',
    }
  }
})

