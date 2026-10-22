import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // API + rendered media come from the Express server (npm run server)
    proxy: {
      '/api': 'http://localhost:3001',
      '/media': 'http://localhost:3001',
    },
  },
})
