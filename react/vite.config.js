import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext' // 또는 'chrome96', 'safari15' 등 최신 브라우저
  }
})
