import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy 설정
    proxy: {
      // '/api'로 시작하는 요청을 백엔드 서버로 전달
      '/api': {
        target: 'http://localhost:5000', // 백엔드 서버 주소 (포트 변경 필요)
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, ''), // 필요 시 경로 재작성
      },
    },
  },
})
