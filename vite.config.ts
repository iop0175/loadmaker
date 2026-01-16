import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // 디버깅용 console.log 유지
        drop_debugger: true, // debugger 제거
      },
      format: {
        comments: false, // 모든 주석 제거
      },
    },
  },
})
